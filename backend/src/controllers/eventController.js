const pool = require("../config/db");
const slugify = require("../utils/slugify");
const archiver = require("archiver");
const axios = require("axios");
const crypto = require("crypto");
const {
  uploadBufferToSpaces,
  buildSpacesObjectKey,
  generateSignedUrl,
  deleteObjectFromSpaces
} = require("../config/spaces");

const sharp = require("sharp");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const EVENT_DOWNLOAD_LIMIT_DEFAULT = 2;
const ALBUM_DOWNLOAD_LIMIT_DEFAULT = 2;

function parseBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function parseNonNegativeInt(value, fallback = 2) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(0, parsed);
}

function sanitizeFileName(value = "file") {
  return (
    value
      .toString()
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^\.+|\.+$/g, "")
      .toLowerCase() || "file"
  );
}

function generateGuestToken() {
  return crypto.randomBytes(24).toString("hex");
}

function buildGuestUrl(token) {
  const frontendUrl =
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    "http://localhost:5173";

  return `${frontendUrl.replace(/\/$/, "")}/guest/${token}`;
}

async function createUniqueGuestToken(client) {
  let guestToken = generateGuestToken();
  let exists = true;

  while (exists) {
    const check = await client.query(
      `
      SELECT id
      FROM events
      WHERE guest_token = $1
      LIMIT 1
      `,
      [guestToken]
    );

    if (check.rows.length === 0) {
      exists = false;
    } else {
      guestToken = generateGuestToken();
    }
  }

  return guestToken;
}

async function uploadEventCoverToWasabi({
  file,
  tenantId,
  eventIdHint = "cover"
}) {
  if (!file) {
    throw new Error("Cover file mungon.");
  }

  const inputPath = file.path || null;
  const inputBuffer =
    file.buffer && Buffer.isBuffer(file.buffer) && file.buffer.length > 0
      ? file.buffer
      : null;

  let bufferToUpload = null;
  let finalMimeType = file.mimetype || "application/octet-stream";
  let finalExtension =
    path.extname(file.originalname || "").replace(".", "") || "jpg";

  try {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      let sharpInput = null;

      if (inputBuffer) {
        sharpInput = inputBuffer;
      } else if (inputPath) {
        sharpInput = inputPath;
      } else {
        throw new Error("Cover image input mungon.");
      }

      const image = sharp(sharpInput).rotate();
      await image.metadata();

      bufferToUpload = await image
        .resize({
          width: 2000,
          withoutEnlargement: true,
          fit: "inside"
        })
        .webp({
          quality: 82,
          effort: 4
        })
        .toBuffer();

      finalMimeType = "image/webp";
      finalExtension = "webp";
    } else {
      if (inputBuffer) {
        bufferToUpload = inputBuffer;
      } else if (inputPath) {
        bufferToUpload = await fsp.readFile(inputPath);
      } else {
        throw new Error("Cover file input mungon.");
      }
    }

    const finalKey = buildSpacesObjectKey({
      tenantId,
      eventId: eventIdHint,
      albumId: "cover",
      originalName: `cover.${finalExtension}`,
      index: 0
    });

    const uploaded = await uploadBufferToSpaces({
      buffer: bufferToUpload,
      key: finalKey,
      mimetype: finalMimeType
    });

    return {
      url: uploaded.url,
      key: uploaded.key,
      bytes: Number(bufferToUpload.length || 0),
      storageProvider: "wasabi"
    };
  } finally {
    try {
      if (inputPath && fs.existsSync(inputPath)) {
        await fsp.unlink(inputPath);
      }
    } catch {}
  }
}

async function attachSignedCoverToEvent(event) {
  if (!event) return event;

  let coverSignedUrl = null;

  if (event.cover_image_public_id) {
    try {
      coverSignedUrl = await generateSignedUrl(
        event.cover_image_public_id,
        60 * 60
      );
    } catch (error) {
      console.error(
        `Gabim në signed URL për cover të eventit ${event.id}:`,
        error.message
      );
    }
  }

  return {
    ...event,
    cover_image_signed_url: coverSignedUrl
  };
}

exports.createEvent = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      title,
      description,
      event_date,
      cover_image_url,
      client_name,
      tenant_id,
      allow_event_download,
      event_download_limit,
      album_download_limit,
      gallery_password,
      auto_delete_enabled
    } = req.body;

    if (!title) {
      return res.status(400).json({
        message: "Titulli i eventit është i detyrueshëm."
      });
    }

    const tenantId =
      req.user.role === "super_admin" ? tenant_id || null : req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: "tenant_id është i detyrueshëm."
      });
    }

    const tenantResult = await client.query(
      `
      SELECT id, storage_used_bytes
      FROM tenants
      WHERE id = $1
      LIMIT 1
      `,
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        message: "Studio/Tenant nuk u gjet."
      });
    }

    const baseSlug = slugify(title);
    let slug = baseSlug;

    const existingEvent = await client.query(
      `SELECT id FROM events WHERE slug = $1 LIMIT 1`,
      [slug]
    );

    if (existingEvent.rows.length > 0) {
      slug = `${baseSlug}-${Date.now()}`;
    }

    let finalCoverImageUrl = cover_image_url || null;
    let finalCoverImagePublicId = null;
    let finalCoverImageSizeBytes = 0;
    const selectedStorageProvider = "wasabi";

    if (req.file) {
      const uploaded = await uploadEventCoverToWasabi({
        file: req.file,
        tenantId,
        eventIdHint: slug || "cover"
      });

      finalCoverImageUrl = uploaded.url;
      finalCoverImagePublicId = uploaded.key;
      finalCoverImageSizeBytes = uploaded.bytes;
    }

    const safeAllowEventDownload = parseBoolean(allow_event_download, true);
    const safeEventDownloadLimit = parseNonNegativeInt(
      event_download_limit,
      EVENT_DOWNLOAD_LIMIT_DEFAULT
    );
    const safeAlbumDownloadLimit = parseNonNegativeInt(
      album_download_limit,
      ALBUM_DOWNLOAD_LIMIT_DEFAULT
    );
    const safeAutoDeleteEnabled = parseBoolean(auto_delete_enabled, true);
    const guestToken = await createUniqueGuestToken(client);

    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO events (
        tenant_id,
        title,
        slug,
        client_name,
        event_date,
        cover_image_url,
        cover_image_public_id,
        cover_image_size_bytes,
        description,
        is_public,
        download_enabled,
        status,
        allow_event_download,
        event_download_limit,
        album_download_limit,
        zip_download_count,
        zip_download_last_at,
        gallery_password,
        storage_provider,
        auto_delete_enabled,
        expires_at,
        guest_token
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        true, false, 'active', $10, $11, $12, 0, NULL, $13, $14, $15,
        CASE
          WHEN $5::date IS NOT NULL THEN ($5::date + INTERVAL '1 year')
          ELSE NULL
        END,
        $16
      )
      RETURNING *
      `,
      [
        tenantId,
        title,
        slug,
        client_name || null,
        event_date || null,
        finalCoverImageUrl,
        finalCoverImagePublicId,
        finalCoverImageSizeBytes,
        description || null,
        safeAllowEventDownload,
        safeEventDownloadLimit,
        safeAlbumDownloadLimit,
        gallery_password || null,
        selectedStorageProvider,
        safeAutoDeleteEnabled,
        guestToken
      ]
    );

    const newEvent = result.rows[0];

    if (finalCoverImageSizeBytes > 0) {
      await client.query(
        `
        UPDATE tenants
        SET storage_used_bytes = COALESCE(storage_used_bytes, 0) + $1
        WHERE id = $2
        `,
        [finalCoverImageSizeBytes, tenantId]
      );
    }

    await client.query("COMMIT");

    const signedEvent = await attachSignedCoverToEvent(newEvent);

    res.status(201).json({
      message: "Eventi u krijua me sukses.",
      event: {
        ...signedEvent,
        guest_url: signedEvent.guest_token
          ? buildGuestUrl(signedEvent.guest_token)
          : null,
        guest_section: null,
        guest_album: null
      }
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("ROLLBACK ERROR:", rollbackError);
    }

    console.error("CREATE EVENT ERROR:", error);
    res.status(500).json({
      message: "Gabim në krijimin e eventit.",
      error: error.message
    });
  } finally {
    client.release();
  }
};

exports.getEvents = async (req, res) => {
  try {
    const { search } = req.query;

    let baseQuery = `
      SELECT
        e.*,
        gs.id AS guest_section_id,
        e.guest_token,
        gs.is_active AS guest_section_active
      FROM events e
      LEFT JOIN guest_sections gs ON gs.event_id = e.id
      WHERE 1=1
    `;

    const values = [];
    let index = 1;

    // 🔐 tenant filter
    if (req.user.role !== "super_admin") {
      baseQuery += ` AND e.tenant_id = $${index}`;
      values.push(req.user.tenantId);
      index++;
    }

    // 🔍 SEARCH (title + client_name)
    if (search && search.trim() !== "") {
      baseQuery += ` AND (
        LOWER(e.title) LIKE LOWER($${index})
        OR LOWER(e.client_name) LIKE LOWER($${index})
      )`;
      values.push(`%${search}%`);
      index++;
    }

    baseQuery += ` ORDER BY e.created_at DESC`;

    const result = await pool.query(baseQuery, values);

    const events = await Promise.all(
      result.rows.map(async (event) => {
        const signedEvent = await attachSignedCoverToEvent(event);

        return {
          ...signedEvent,
          guest_url: signedEvent.guest_token
            ? buildGuestUrl(signedEvent.guest_token)
            : null
        };
      })
    );

    res.json(events);
  } catch (error) {
    console.error("GET EVENTS ERROR:", error);
    res.status(500).json({
      message: "Gabim në marrjen e eventeve.",
      error: error.message
    });
  }
};

exports.getGuestSectionByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `
      SELECT
        gs.id AS guest_section_id,
        gs.event_id,
        gs.is_active,
        e.id,
        e.tenant_id,
        e.title,
        e.slug,
        e.description,
        e.event_date,
        e.cover_image_url,
        e.cover_image_public_id,
        e.client_name,
        e.is_public,
        e.status,
        e.guest_token
      FROM events e
      LEFT JOIN guest_sections gs ON gs.event_id = e.id
      WHERE e.guest_token = $1
      LIMIT 1
      `,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Guest link nuk u gjet."
      });
    }

    const guestEvent = result.rows[0];

    if (guestEvent.guest_section_id && !guestEvent.is_active) {
      return res.status(403).json({
        message: "Guest section nuk është aktive."
      });
    }

    const signedGuestEvent = await attachSignedCoverToEvent(guestEvent);

    return res.json({
      message: "Guest section u gjet me sukses.",
      guest: {
        guest_section_id: signedGuestEvent.guest_section_id,
        event_id: signedGuestEvent.event_id || signedGuestEvent.id,
        guest_token: signedGuestEvent.guest_token,
        guest_url: buildGuestUrl(signedGuestEvent.guest_token),
        is_active:
          signedGuestEvent.is_active === undefined ||
          signedGuestEvent.is_active === null
            ? true
            : signedGuestEvent.is_active,
        event: {
          id: signedGuestEvent.id,
          tenant_id: signedGuestEvent.tenant_id,
          title: signedGuestEvent.title,
          slug: signedGuestEvent.slug,
          description: signedGuestEvent.description,
          event_date: signedGuestEvent.event_date,
          cover_image_url: signedGuestEvent.cover_image_url,
          cover_image_public_id: signedGuestEvent.cover_image_public_id,
          cover_image_signed_url: signedGuestEvent.cover_image_signed_url,
          client_name: signedGuestEvent.client_name,
          is_public: signedGuestEvent.is_public,
          status: signedGuestEvent.status
        }
      }
    });
  } catch (error) {
    console.error("GET GUEST SECTION BY TOKEN ERROR:", error);
    return res.status(500).json({
      message: "Gabim në marrjen e guest section.",
      error: error.message
    });
  }
};

exports.regenerateGuestToken = async (req, res) => {
  try {
    const { id } = req.params;

    let eventCheck;

    if (req.user.role === "super_admin") {
      eventCheck = await pool.query(
        `
        SELECT e.*, gs.id AS guest_section_id
        FROM events e
        LEFT JOIN guest_sections gs ON gs.event_id = e.id
        WHERE e.id = $1
        LIMIT 1
        `,
        [id]
      );
    } else {
      eventCheck = await pool.query(
        `
        SELECT e.*, gs.id AS guest_section_id
        FROM events e
        LEFT JOIN guest_sections gs ON gs.event_id = e.id
        WHERE e.id = $1 AND e.tenant_id = $2
        LIMIT 1
        `,
        [id, req.user.tenantId]
      );
    }

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Eventi nuk u gjet."
      });
    }

    const guestToken = await createUniqueGuestToken(pool);

    const result = await pool.query(
      `
      UPDATE events
      SET guest_token = $1
      WHERE id = $2
      RETURNING *
      `,
      [guestToken, id]
    );

    const signedEvent = await attachSignedCoverToEvent(result.rows[0]);

    return res.json({
      message: "Guest token u rigjenerua me sukses.",
      event: {
        ...signedEvent,
        guest_url: buildGuestUrl(signedEvent.guest_token)
      }
    });
  } catch (error) {
    console.error("REGENERATE GUEST TOKEN ERROR:", error);
    return res.status(500).json({
      message: "Gabim në rigjenerimin e guest token.",
      error: error.message
    });
  }
};

exports.toggleGuestSection = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    let eventCheck;

    if (req.user.role === "super_admin") {
      eventCheck = await pool.query(
        `
        SELECT e.*, gs.id AS guest_section_id, e.guest_token
        FROM events e
        LEFT JOIN guest_sections gs ON gs.event_id = e.id
        WHERE e.id = $1
        LIMIT 1
        `,
        [id]
      );
    } else {
      eventCheck = await pool.query(
        `
        SELECT e.*, gs.id AS guest_section_id, e.guest_token
        FROM events e
        LEFT JOIN guest_sections gs ON gs.event_id = e.id
        WHERE e.id = $1 AND e.tenant_id = $2
        LIMIT 1
        `,
        [id, req.user.tenantId]
      );
    }

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Eventi nuk u gjet."
      });
    }

    const event = eventCheck.rows[0];

    if (!event.guest_section_id) {
      return res.status(404).json({
        message: "Guest section nuk u gjet për këtë event."
      });
    }

    const safeIsActive = parseBoolean(is_active, true);

    const result = await pool.query(
      `
      UPDATE guest_sections
      SET is_active = $1
      WHERE id = $2
      RETURNING *
      `,
      [safeIsActive, event.guest_section_id]
    );

    return res.json({
      message: "Guest section u përditësua me sukses.",
      guest_section: {
        ...result.rows[0],
        guest_token: event.guest_token,
        guest_url: buildGuestUrl(event.guest_token)
      }
    });
  } catch (error) {
    console.error("TOGGLE GUEST SECTION ERROR:", error);
    return res.status(500).json({
      message: "Gabim në përditësimin e guest section.",
      error: error.message
    });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      event_date,
      cover_image_url,
      client_name,
      allow_event_download,
      event_download_limit,
      album_download_limit,
      gallery_password
    } = req.body;

    let eventCheck;

    if (req.user.role === "super_admin") {
      eventCheck = await pool.query(
        `SELECT * FROM events WHERE id = $1 LIMIT 1`,
        [id]
      );
    } else {
      eventCheck = await pool.query(
        `SELECT * FROM events WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [id, req.user.tenantId]
      );
    }

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Eventi nuk u gjet."
      });
    }

    const currentEvent = eventCheck.rows[0];

    const newTitle = title?.trim() || currentEvent.title;
    const newDescription =
      description !== undefined ? description : currentEvent.description;
    const newEventDate =
      event_date !== undefined ? event_date : currentEvent.event_date;
    const newClientName =
      client_name !== undefined ? client_name : currentEvent.client_name;

    const newAllowEventDownload =
      allow_event_download !== undefined
        ? parseBoolean(allow_event_download, true)
        : currentEvent.allow_event_download;

    const newEventDownloadLimit =
      event_download_limit !== undefined
        ? parseNonNegativeInt(
            event_download_limit,
            EVENT_DOWNLOAD_LIMIT_DEFAULT
          )
        : currentEvent.event_download_limit;

    const newAlbumDownloadLimit =
      album_download_limit !== undefined
        ? parseNonNegativeInt(
            album_download_limit,
            ALBUM_DOWNLOAD_LIMIT_DEFAULT
          )
        : currentEvent.album_download_limit;

    const newGalleryPassword =
      gallery_password !== undefined
        ? gallery_password || null
        : currentEvent.gallery_password;

    let newCoverImageUrl =
      cover_image_url !== undefined
        ? cover_image_url
        : currentEvent.cover_image_url;

    let newCoverImagePublicId = currentEvent.cover_image_public_id || null;
    let newCoverImageSizeBytes = Number(
      currentEvent.cover_image_size_bytes || 0
    );

    if (req.file) {
      if (currentEvent.cover_image_public_id) {
        try {
          await deleteObjectFromSpaces(currentEvent.cover_image_public_id);
        } catch (deleteError) {
          console.error(
            "Gabim në fshirjen e cover-it të vjetër nga Wasabi:",
            deleteError.message
          );
        }
      }

      const uploaded = await uploadEventCoverToWasabi({
        file: req.file,
        tenantId: currentEvent.tenant_id,
        eventIdHint: currentEvent.slug || id || "cover"
      });

      const oldCoverSize = Number(currentEvent.cover_image_size_bytes || 0);
      const newCoverSize = Number(uploaded.bytes || 0);
      const diffBytes = newCoverSize - oldCoverSize;

      if (diffBytes !== 0) {
        await pool.query(
          `
          UPDATE tenants
          SET storage_used_bytes = GREATEST(COALESCE(storage_used_bytes, 0) + $1, 0)
          WHERE id = $2
          `,
          [diffBytes, currentEvent.tenant_id]
        );
      }

      newCoverImageUrl = uploaded.url;
      newCoverImagePublicId = uploaded.key;
      newCoverImageSizeBytes = uploaded.bytes;
    }

    let newSlug = currentEvent.slug;

    if (newTitle !== currentEvent.title) {
      const baseSlug = slugify(newTitle);
      newSlug = baseSlug;

      const existingEvent = await pool.query(
        `SELECT id FROM events WHERE slug = $1 AND id != $2 LIMIT 1`,
        [newSlug, id]
      );

      if (existingEvent.rows.length > 0) {
        newSlug = `${baseSlug}-${Date.now()}`;
      }
    }

    const result = await pool.query(
      `
      UPDATE events
      SET title = $1,
          slug = $2,
          client_name = $3,
          description = $4,
          cover_image_url = $5,
          cover_image_public_id = $6,
          cover_image_size_bytes = $7,
          event_date = $8,
          expires_at = CASE
            WHEN $8::date IS NOT NULL THEN ($8::date + INTERVAL '1 year')
            ELSE NULL
          END,
          allow_event_download = $9,
          event_download_limit = $10,
          album_download_limit = $11,
          gallery_password = $12,
          storage_provider = 'wasabi'
      WHERE id = $13
      RETURNING *
      `,
      [
        newTitle,
        newSlug,
        newClientName,
        newDescription,
        newCoverImageUrl,
        newCoverImagePublicId,
        newCoverImageSizeBytes,
        newEventDate,
        newAllowEventDownload,
        newEventDownloadLimit,
        newAlbumDownloadLimit,
        newGalleryPassword,
        id
      ]
    );

    const guestSectionResult = await pool.query(
      `
      SELECT *
      FROM guest_sections
      WHERE event_id = $1
      LIMIT 1
      `,
      [id]
    );

    const guestSection = guestSectionResult.rows[0] || null;
    const signedEvent = await attachSignedCoverToEvent(result.rows[0]);

    res.json({
      message: "Eventi u përditësua me sukses.",
      event: {
        ...signedEvent,
        guest_url: signedEvent.guest_token
          ? buildGuestUrl(signedEvent.guest_token)
          : null,
        guest_section: guestSection
          ? {
              ...guestSection,
              guest_token: signedEvent.guest_token,
              guest_url: signedEvent.guest_token
                ? buildGuestUrl(signedEvent.guest_token)
                : null
            }
          : null
      }
    });
  } catch (error) {
    console.error("UPDATE EVENT ERROR:", error);
    res.status(500).json({
      message: "Gabim në përditësimin e eventit.",
      error: error.message
    });
  }
};

exports.updateEventDownloadSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      allow_event_download,
      event_download_limit,
      album_download_limit
    } = req.body;

    let eventCheck;

    if (req.user.role === "super_admin") {
      eventCheck = await pool.query(
        `
        SELECT id, tenant_id
        FROM events
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );
    } else {
      eventCheck = await pool.query(
        `
        SELECT id, tenant_id
        FROM events
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [id, req.user.tenantId]
      );
    }

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Eventi nuk u gjet."
      });
    }

    const safeAllowEventDownload = parseBoolean(allow_event_download, true);
    const safeEventLimit = parseNonNegativeInt(
      event_download_limit,
      EVENT_DOWNLOAD_LIMIT_DEFAULT
    );
    const safeAlbumLimit = parseNonNegativeInt(
      album_download_limit,
      ALBUM_DOWNLOAD_LIMIT_DEFAULT
    );

    const result = await pool.query(
      `
      UPDATE events
      SET allow_event_download = $1,
          event_download_limit = $2,
          album_download_limit = $3
      WHERE id = $4
      RETURNING *
      `,
      [safeAllowEventDownload, safeEventLimit, safeAlbumLimit, id]
    );

    return res.json({
      message: "Download settings u përditësuan me sukses.",
      event: result.rows[0]
    });
  } catch (error) {
    console.error("Gabim në updateEventDownloadSettings:", error);
    return res.status(500).json({
      message: "Gabim në server.",
      error: error.message
    });
  }
};

exports.updateEventAutoDeleteSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const { auto_delete_enabled } = req.body;

    let eventCheck;

    if (req.user.role === "super_admin") {
      eventCheck = await pool.query(
        `SELECT * FROM events WHERE id = $1 LIMIT 1`,
        [id]
      );
    } else {
      eventCheck = await pool.query(
        `SELECT * FROM events WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [id, req.user.tenantId]
      );
    }

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Eventi nuk u gjet."
      });
    }

    const safeAutoDeleteEnabled = parseBoolean(auto_delete_enabled, true);

    const result = await pool.query(
      `
      UPDATE events
      SET auto_delete_enabled = $1
      WHERE id = $2
      RETURNING *
      `,
      [safeAutoDeleteEnabled, id]
    );

    return res.json({
      message: "Auto delete u përditësua me sukses.",
      event: result.rows[0]
    });
  } catch (error) {
    console.error("UPDATE EVENT AUTO DELETE ERROR:", error);
    return res.status(500).json({
      message: "Gabim në përditësimin e auto delete.",
      error: error.message
    });
  }
};

exports.downloadEventZip = async (req, res) => {
  try {
    const { id } = req.params;

    let eventCheck;

    if (req.user?.role === "super_admin") {
      eventCheck = await pool.query(
        `SELECT * FROM events WHERE id = $1 LIMIT 1`,
        [id]
      );
    } else if (req.user?.role === "studio_admin") {
      eventCheck = await pool.query(
        `SELECT * FROM events WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [id, req.user.tenantId]
      );
    } else {
      eventCheck = await pool.query(
        `SELECT * FROM events WHERE id = $1 AND is_public = true LIMIT 1`,
        [id]
      );
    }

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Eventi nuk u gjet."
      });
    }

    const event = eventCheck.rows[0];

    if (!event.allow_event_download) {
      return res.status(403).json({
        message: "Download për këtë event nuk lejohet."
      });
    }

    const currentDownloads = Number(event.zip_download_count || 0);
    const limit = Number(event.event_download_limit || 0);

    if (limit === 0) {
      return res.status(403).json({
        message: "Download nuk lejohet për këtë event."
      });
    }

    if (currentDownloads >= limit) {
      return res.status(403).json({
        message: "Ke arritur limitin e shkarkimeve për këtë event."
      });
    }

    const mediaResult = await pool.query(
      `
      SELECT id, file_url, provider_file_id, format, type, title, created_at
      FROM media
      WHERE event_id = $1
      ORDER BY created_at ASC
      `,
      [id]
    );

    const mediaFiles = mediaResult.rows.filter(
      (item) => (item.provider_file_id || item.file_url) && item.type === "image"
    );

    if (mediaFiles.length === 0) {
      return res.status(404).json({
        message: "Nuk ka media për këtë event."
      });
    }

    const zipName = `${sanitizeFileName(event.slug || event.title || "event")}.zip`;

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${zipName}"`
    );
    res.setHeader("Content-Type", "application/zip");

    const archive = archiver("zip", {
      zlib: { level: 9 }
    });

    archive.on("error", (err) => {
      console.error("ARCHIVE ERROR:", err);

      if (!res.headersSent) {
        return res.status(500).json({
          message: "Gabim gjatë krijimit të ZIP.",
          error: err.message
        });
      }

      res.end();
    });

    res.on("close", async () => {
      if (!res.writableEnded) {
        archive.destroy();
      }
    });

    archive.pipe(res);

    for (let i = 0; i < mediaFiles.length; i++) {
      const media = mediaFiles[i];

      const mediaUrl = media.provider_file_id
        ? await generateSignedUrl(media.provider_file_id, 60 * 60)
        : media.file_url;

      if (!mediaUrl) continue;

      const response = await axios({
        method: "GET",
        url: mediaUrl,
        responseType: "stream"
      });

      const extension = media.format || "jpg";
      const safeTitle = sanitizeFileName(
        media.title || `photo-${String(i + 1).padStart(4, "0")}`
      );

      archive.append(response.data, {
        name: `${safeTitle}.${extension}`
      });
    }

    await archive.finalize();

    await pool.query(
      `
      UPDATE events
      SET zip_download_count = COALESCE(zip_download_count, 0) + 1,
          zip_download_last_at = NOW()
      WHERE id = $1
      `,
      [id]
    );
  } catch (error) {
    console.error("DOWNLOAD EVENT ZIP ERROR:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        message: "Gabim gjatë krijimit të ZIP.",
        error: error.message
      });
    }

    res.end();
  }
};

exports.deleteEvent = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    let eventCheck;

    if (req.user.role === "super_admin") {
      eventCheck = await client.query(
        `SELECT * FROM events WHERE id = $1 LIMIT 1`,
        [id]
      );
    } else {
      eventCheck = await client.query(
        `SELECT * FROM events WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [id, req.user.tenantId]
      );
    }

    if (eventCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Eventi nuk u gjet."
      });
    }

    const event = eventCheck.rows[0];
    let totalDeletedBytes = 0;

    if (event.cover_image_public_id) {
      try {
        await deleteObjectFromSpaces(event.cover_image_public_id);
      } catch (deleteError) {
        console.error(
          "Gabim në fshirjen e cover image nga Wasabi:",
          deleteError.message
        );
      }
    }

    totalDeletedBytes += Number(event.cover_image_size_bytes || 0);

    const mediaResult = await client.query(
      `
      SELECT *
      FROM media
      WHERE event_id = $1
      `,
      [id]
    );

    for (const media of mediaResult.rows) {
      totalDeletedBytes += Number(media.size_bytes || media.bytes || 0);

      const mediaObjectKey = media.provider_file_id || null;

      if (mediaObjectKey) {
        try {
          await deleteObjectFromSpaces(mediaObjectKey);
        } catch (deleteError) {
          console.error(
            `Gabim në fshirjen nga Wasabi për media ID ${media.id}:`,
            deleteError.message
          );
        }
      }
    }

    await client.query(`DELETE FROM guest_sections WHERE event_id = $1`, [id]);
    await client.query(`DELETE FROM media WHERE event_id = $1`, [id]);
    await client.query(`DELETE FROM albums WHERE event_id = $1`, [id]);

    await client.query(
      `
      UPDATE tenants
      SET storage_used_bytes = GREATEST(COALESCE(storage_used_bytes, 0) - $1, 0)
      WHERE id = $2
      `,
      [totalDeletedBytes, event.tenant_id]
    );

    await client.query(`DELETE FROM events WHERE id = $1`, [id]);

    await client.query("COMMIT");

    res.json({
      message:
        "Eventi, guest section, albumet dhe të gjitha mediat u fshinë me sukses.",
      deletedMediaCount: mediaResult.rows.length
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("DELETE EVENT ERROR:", error);
    res.status(500).json({
      message: "Gabim në fshirjen e eventit.",
      error: error.message
    });
  } finally {
    client.release();
  }
};