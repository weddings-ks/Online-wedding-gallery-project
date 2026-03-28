const pool = require("../config/db");
const archiver = require("archiver");
const axios = require("axios");
const {
  uploadBufferToSpaces,
  buildSpacesObjectKey,
  generateSignedUrl
} = require("../config/spaces");

const EVENT_DOWNLOAD_LIMIT_DEFAULT = 2;
const MAX_CONCURRENT_DOWNLOADS = 5;

const sanitizeFileName = (value) => {
  return (value || "file")
    .toString()
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase();
};

const getExtensionFromUrl = (url, fallback = "jpg") => {
  try {
    const cleanUrl = url.split("?")[0];
    const parts = cleanUrl.split(".");
    const ext = parts[parts.length - 1];

    if (!ext || ext.length > 5) return fallback;
    return ext.toLowerCase();
  } catch {
    return fallback;
  }
};

async function signMediaItem(item) {
  const signedFileUrl = item.provider_file_id
    ? await generateSignedUrl(item.provider_file_id)
    : item.file_url || null;

  return {
    ...item,
    file_url: signedFileUrl,
    thumbnail_url: signedFileUrl
  };
}

async function signAlbumItem(album) {
  const signedCoverUrl = album.cover_image_public_id
    ? await generateSignedUrl(album.cover_image_public_id)
    : album.cover_image_url || null;

  return {
    ...album,
    cover_image_url: signedCoverUrl
  };
}

async function signEventItem(event) {
  const signedCoverUrl = event.cover_image_public_id
    ? await generateSignedUrl(event.cover_image_public_id)
    : event.cover_image_url || null;

  const signedStudioLogoUrl = event.logo_public_id
    ? await generateSignedUrl(event.logo_public_id)
    : event.studio_logo_url || null;

  return {
    ...event,
    cover_image_url: signedCoverUrl,
    studio_logo_url: signedStudioLogoUrl
  };
}

const mapAlbumsWithMedia = (albums, mediaItems) => {
  return albums.map((album) => {
    const albumMedia = mediaItems.filter((item) => item.album_id === album.id);

    const previewImage =
      albumMedia.length > 0
        ? albumMedia[0].thumbnail_url || albumMedia[0].file_url
        : album.cover_image_url || null;

    return {
      ...album,
      cover_image_url: album.cover_image_url || null,
      preview_image: previewImage,
      media_count: albumMedia.length
    };
  });
};

const buildPublicEventResponse = (
  event,
  albumsWithMedia,
  mediaCount,
  protectedMode = false,
  guestSections = []
) => {
  return {
    protected: protectedMode,
    event: {
      ...event,
      gallery_password: undefined,
      album_count: albumsWithMedia.length,
      media_count: mediaCount,

      studio_name: event.studio_name,
      studio_slug: event.studio_slug,
      studio_logo_url: event.studio_logo_url,
      primary_color: event.primary_color,
      secondary_color: event.secondary_color,
      accent_color: event.accent_color,
      footer_text: event.footer_text,
      contact_email: event.contact_email,
      contact_phone: event.contact_phone,
      contact_instagram: event.contact_instagram,
      contact_facebook: event.contact_facebook,
      website_url: event.website_url
    },
    albums: albumsWithMedia,
    guest_sections: guestSections
  };
};

const getPublicEventWithTenant = async (slug) => {
  return await pool.query(
    `
    SELECT
      e.*,
      t.name AS studio_name,
      t.slug AS studio_slug,
      t.logo_url AS studio_logo_url,
      t.logo_public_id,
      t.primary_color,
      t.secondary_color,
      t.accent_color,
      t.footer_text,
      t.contact_email,
      t.contact_phone,
      t.contact_instagram,
      t.contact_facebook,
      t.website_url
    FROM events e
    LEFT JOIN tenants t ON e.tenant_id = t.id
    WHERE e.slug = $1
      AND e.is_public = true
    LIMIT 1
    `,
    [slug]
  );
};

const getPublicGallery = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({
        message: "Slug mungon."
      });
    }

    const eventResult = await getPublicEventWithTenant(slug);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        message: "Eventi nuk u gjet."
      });
    }

    let event = eventResult.rows[0];
    event = await signEventItem(event);

    const guestSectionsResult = await pool.query(
      `
      SELECT
        id,
        event_id,
        album_id,
        title,
        description,
        slug,
        is_active,
        sort_order,
        section_image_url,
        max_upload_photos,
        uploaded_photos_count,
        created_at
      FROM guest_sections
      WHERE event_id = $1
        AND is_active = true
      ORDER BY sort_order ASC, created_at DESC
      `,
      [event.id]
    );

    if (event.gallery_password) {
      return res.json({
        protected: true,
        event: {
          id: event.id,
          title: event.title,
          slug: event.slug,
          description: event.description,
          event_date: event.event_date,
          cover_image_url: event.cover_image_url,
          client_name: event.client_name,
          allow_event_download: event.allow_event_download,
          event_download_limit: event.event_download_limit,
          zip_download_count: event.zip_download_count || 0,

          studio_name: event.studio_name,
          studio_slug: event.studio_slug,
          studio_logo_url: event.studio_logo_url,
          primary_color: event.primary_color,
          secondary_color: event.secondary_color,
          accent_color: event.accent_color,
          footer_text: event.footer_text,
          contact_email: event.contact_email,
          contact_phone: event.contact_phone,
          contact_instagram: event.contact_instagram,
          contact_facebook: event.contact_facebook,
          website_url: event.website_url
        },
        albums: [],
        guest_sections: guestSectionsResult.rows
      });
    }

    let albumsResult = await pool.query(
      `
      SELECT
        id,
        tenant_id,
        event_id,
        title,
        slug,
        sort_order,
        cover_image_url,
        cover_image_public_id,
        created_at
      FROM albums
      WHERE event_id = $1
      ORDER BY sort_order ASC NULLS LAST, created_at DESC, id DESC
      `,
      [event.id]
    );

    let mediaResult = await pool.query(
      `
      SELECT id, album_id, thumbnail_url, file_url, provider_file_id
      FROM media
      WHERE event_id = $1
      ORDER BY sort_order ASC, created_at DESC, id DESC
      `,
      [event.id]
    );

    const signedAlbums = await Promise.all(
      albumsResult.rows.map((album) => signAlbumItem(album))
    );

    const signedMedia = await Promise.all(
      mediaResult.rows.map((item) => signMediaItem(item))
    );

    const albumsWithMedia = mapAlbumsWithMedia(signedAlbums, signedMedia);

    return res.json(
      buildPublicEventResponse(
        event,
        albumsWithMedia,
        signedMedia.length,
        false,
        guestSectionsResult.rows
      )
    );
  } catch (error) {
    console.error("Gabim në getPublicGallery:", error);
    return res.status(500).json({
      message: "Gabim në server."
    });
  }
};

const verifyGalleryPassword = async (req, res) => {
  try {
    const { slug } = req.params;
    const { password } = req.body;

    if (!slug) {
      return res.status(400).json({
        message: "Slug mungon."
      });
    }

    const eventResult = await getPublicEventWithTenant(slug);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        message: "Eventi nuk u gjet."
      });
    }

    let event = eventResult.rows[0];
    event = await signEventItem(event);

    const guestSectionsResult = await pool.query(
      `
      SELECT
        id,
        event_id,
        album_id,
        title,
        description,
        slug,
        is_active,
        sort_order,
        section_image_url,
        max_upload_photos,
        uploaded_photos_count,
        created_at
      FROM guest_sections
      WHERE event_id = $1
        AND is_active = true
      ORDER BY sort_order ASC, created_at DESC
      `,
      [event.id]
    );

    const loadAlbumsAndMedia = async () => {
      const albumsResult = await pool.query(
        `
        SELECT
          id,
          tenant_id,
          event_id,
          title,
          slug,
          sort_order,
          cover_image_url,
          cover_image_public_id,
          created_at
        FROM albums
        WHERE event_id = $1
        ORDER BY sort_order ASC NULLS LAST, created_at DESC, id DESC
        `,
        [event.id]
      );

      const mediaResult = await pool.query(
        `
        SELECT id, album_id, thumbnail_url, file_url, provider_file_id
        FROM media
        WHERE event_id = $1
        ORDER BY sort_order ASC, created_at DESC, id DESC
        `,
        [event.id]
      );

      const signedAlbums = await Promise.all(
        albumsResult.rows.map((album) => signAlbumItem(album))
      );

      const signedMedia = await Promise.all(
        mediaResult.rows.map((item) => signMediaItem(item))
      );

      const albumsWithMedia = mapAlbumsWithMedia(signedAlbums, signedMedia);

      return {
        albumsWithMedia,
        mediaCount: signedMedia.length
      };
    };

    if (!event.gallery_password) {
      const { albumsWithMedia, mediaCount } = await loadAlbumsAndMedia();

      return res.json({
        success: true,
        ...buildPublicEventResponse(
          event,
          albumsWithMedia,
          mediaCount,
          false,
          guestSectionsResult.rows
        )
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password është i detyrueshëm."
      });
    }

    const isMatch = password.trim() === String(event.gallery_password).trim();

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Password i pasaktë."
      });
    }

    const { albumsWithMedia, mediaCount } = await loadAlbumsAndMedia();

    return res.json({
      success: true,
      ...buildPublicEventResponse(
        event,
        albumsWithMedia,
        mediaCount,
        false,
        guestSectionsResult.rows
      )
    });
  } catch (error) {
    console.error("Gabim në verifyGalleryPassword:", error);
    return res.status(500).json({
      message: "Gabim në server."
    });
  }
};

const getPublicAlbumMedia = async (req, res) => {
  try {
    const { albumId } = req.params;
    const password = req.query.password || req.headers["x-gallery-password"];

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 24, 1),
      100
    );
    const offset = (page - 1) * limit;

    const albumResult = await pool.query(
      `
      SELECT
        a.*,
        e.id AS event_id,
        e.is_public,
        e.gallery_password
      FROM albums a
      JOIN events e ON e.id = a.event_id
      WHERE a.id = $1
        AND e.is_public = true
      LIMIT 1
      `,
      [albumId]
    );

    if (albumResult.rows.length === 0) {
      return res.status(404).json({
        message: "Albumi nuk u gjet."
      });
    }

    const album = albumResult.rows[0];

    if (album.gallery_password) {
      if (!password) {
        return res.status(401).json({
          message: "Password i galerisë është i detyrueshëm."
        });
      }

      const isMatch = password.trim() === String(album.gallery_password).trim();

      if (!isMatch) {
        return res.status(401).json({
          message: "Password i galerisë është i pasaktë."
        });
      }
    }

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM media
      WHERE album_id = $1
      `,
      [albumId]
    );

    const total = countResult.rows[0]?.total || 0;

    const mediaResult = await pool.query(
      `
      SELECT *
      FROM media
      WHERE album_id = $1
      ORDER BY sort_order ASC, created_at DESC, id DESC
      LIMIT $2 OFFSET $3
      `,
      [albumId, limit, offset]
    );

    const signedMedia = await Promise.all(
      mediaResult.rows.map((item) => signMediaItem(item))
    );

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + signedMedia.length < total,
      media: signedMedia
    });
  } catch (error) {
    console.error("Gabim në getPublicAlbumMedia:", error);
    return res.status(500).json({
      message: "Gabim në server."
    });
  }
};

const downloadWholeEventZip = async (req, res) => {
  try {
    const { slug } = req.params;
    const password = req.query.password || req.headers["x-gallery-password"];

    if (!slug) {
      return res.status(400).json({
        message: "Slug mungon."
      });
    }

    const eventResult = await pool.query(
      `
      SELECT
        id,
        title,
        slug,
        allow_event_download,
        event_download_limit,
        zip_download_count,
        gallery_password
      FROM events
      WHERE slug = $1
        AND is_public = true
      LIMIT 1
      `,
      [slug]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        message: "Eventi nuk u gjet."
      });
    }

    const event = eventResult.rows[0];

    if (event.gallery_password) {
      if (!password) {
        return res.status(401).json({
          message: "Password i galerisë është i detyrueshëm."
        });
      }

      const isMatch = password.trim() === String(event.gallery_password).trim();

      if (!isMatch) {
        return res.status(401).json({
          message: "Password i galerisë është i pasaktë."
        });
      }
    }

    if (event.allow_event_download === false) {
      return res.status(403).json({
        message: "Shkarkimi i eventit nuk lejohet për këtë galeri."
      });
    }

    const currentCount = Number(event.zip_download_count || 0);
    const maxCount = Number(
      event.event_download_limit || EVENT_DOWNLOAD_LIMIT_DEFAULT
    );

    if (currentCount >= maxCount) {
      return res.status(403).json({
        message: `Limiti i shkarkimeve për këtë event është arritur (${currentCount}/${maxCount}).`
      });
    }

    const albumsResult = await pool.query(
      `
      SELECT id, title
      FROM albums
      WHERE event_id = $1
      ORDER BY created_at ASC, id ASC
      `,
      [event.id]
    );

    const mediaResult = await pool.query(
      `
      SELECT id, album_id, title, type, file_url, provider_file_id
      FROM media
      WHERE event_id = $1
      ORDER BY created_at ASC, id ASC
      `,
      [event.id]
    );

    const albums = albumsResult.rows;
    const mediaItems = mediaResult.rows;

    if (mediaItems.length === 0) {
      return res.status(404).json({
        message: "Ky event nuk ka media."
      });
    }

    const eventFolderName = sanitizeFileName(
      event.title || event.slug || "event"
    );
    const zipName = `${eventFolderName}.zip`;

    const albumMap = {};
    for (const album of albums) {
      albumMap[album.id] = sanitizeFileName(album.title || `album-${album.id}`);
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

    const archive = archiver("zip", {
      zlib: { level: 0 }
    });

    archive.on("warning", (err) => {
      console.warn("Archiver warning:", err.message);
    });

    archive.on("error", (err) => {
      console.error("Archiver error:", err);
      if (!res.headersSent) {
        return res.status(500).json({
          message: "Gabim gjatë krijimit të ZIP të eventit."
        });
      }
      res.end();
    });

    res.on("close", () => {
      if (!res.writableEnded) {
        archive.abort();
      }
    });

    archive.pipe(res);

    let appendedCount = 0;

    for (let i = 0; i < mediaItems.length; i += MAX_CONCURRENT_DOWNLOADS) {
      const chunk = mediaItems.slice(i, i + MAX_CONCURRENT_DOWNLOADS);

      await Promise.all(
        chunk.map(async (item, index) => {
          try {
            const globalIndex = i + index;

            const fallbackExt = item.type === "video" ? "mp4" : "jpg";
            const extension = getExtensionFromUrl(item.file_url || "", fallbackExt);

            const safeTitle = item.title
              ? sanitizeFileName(item.title)
              : "foto";

            const albumFolder = albumMap[item.album_id] || "other";
            const fileNumber = String(globalIndex + 1).padStart(4, "0");
            const fileName = `${fileNumber}-${safeTitle}.${extension}`;
            const zipPath = `${eventFolderName}/${albumFolder}/${fileName}`;

            const signedUrl = item.provider_file_id
              ? await generateSignedUrl(item.provider_file_id, 60 * 30)
              : item.file_url;

            const response = await axios.get(signedUrl, {
              responseType: "stream",
              timeout: 30000,
              maxRedirects: 5
            });

            archive.append(response.data, { name: zipPath });
            appendedCount++;
          } catch (fileError) {
            console.error(
              `Gabim te media ID ${item.id} në event ZIP:`,
              fileError.message
            );
          }
        })
      );
    }

    if (appendedCount === 0) {
      return res.status(500).json({
        message: "Asnjë media nuk u shtua në ZIP të eventit."
      });
    }

    await pool.query(
      `
      UPDATE events
      SET zip_download_count = COALESCE(zip_download_count, 0) + 1,
          zip_download_last_at = NOW()
      WHERE id = $1
      `,
      [event.id]
    );

    return archive.finalize();
  } catch (error) {
    console.error("Gabim në downloadWholeEventZip:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        message: "Gabim gjatë krijimit të ZIP të eventit."
      });
    }
  }
};

const getGuestSectionBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      `
      SELECT
        gs.id,
        gs.tenant_id,
        gs.event_id,
        gs.album_id,
        gs.title,
        gs.description,
        gs.slug,
        gs.is_active,
        gs.sort_order,
        gs.section_image_url,
        gs.max_upload_photos,
        gs.uploaded_photos_count,
        gs.created_at,
        e.slug AS event_slug,
        e.title AS event_title,
        e.description AS event_description,
        e.event_date,
        e.client_name,
        e.cover_image_url,
        e.cover_image_public_id
      FROM guest_sections gs
      JOIN events e ON e.id = gs.event_id
      WHERE gs.slug = $1
      LIMIT 1
      `,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Guest section nuk u gjet."
      });
    }

    const section = result.rows[0];

    if (!section.is_active) {
      return res.status(403).json({
        message: "Ky seksion nuk është aktiv."
      });
    }

    const signedSection = {
      ...section,
      cover_image_url: section.cover_image_public_id
        ? await generateSignedUrl(section.cover_image_public_id)
        : section.cover_image_url
    };

    return res.status(200).json({
      section: signedSection
    });
  } catch (error) {
    console.error("getGuestSectionBySlug error:", error);
    return res.status(500).json({
      message: "Gabim gjatë marrjes së guest section."
    });
  }
};

const uploadGuestMedia = async (req, res) => {
  const client = await pool.connect();

  try {
    const { slug } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "Nuk ka file për upload."
      });
    }

    const invalidFiles = req.files.filter(
      (file) => !file.mimetype || !file.mimetype.startsWith("image/")
    );

    if (invalidFiles.length > 0) {
      return res.status(400).json({
        message: "Lejohen vetëm foto."
      });
    }

    const sectionRes = await client.query(
      `
      SELECT
        id,
        tenant_id,
        event_id,
        album_id,
        slug,
        is_active,
        max_upload_photos,
        uploaded_photos_count
      FROM guest_sections
      WHERE slug = $1
      LIMIT 1
      `,
      [slug]
    );

    if (sectionRes.rows.length === 0) {
      return res.status(404).json({
        message: "Guest section nuk u gjet."
      });
    }

    const section = sectionRes.rows[0];

    if (!section.is_active) {
      return res.status(403).json({
        message: "Ky seksion nuk është aktiv."
      });
    }

    if (!section.album_id) {
      return res.status(400).json({
        message:
          "Ky guest section nuk ka album të lidhur. Lidhe këtë seksion me albumin e saktë."
      });
    }

    const currentCount = Number(section.uploaded_photos_count || 0);
    const maxCount = Number(section.max_upload_photos || 50);
    const newFilesCount = req.files.length;

    if (currentCount >= maxCount) {
      return res.status(400).json({
        message: `Limiti i fotove është arritur (${currentCount}/${maxCount}).`
      });
    }

    if (currentCount + newFilesCount > maxCount) {
      const remaining = Math.max(0, maxCount - currentCount);

      return res.status(400).json({
        message: `Mund të ngarkohen vetëm edhe ${remaining} foto. Limiti është ${maxCount}.`
      });
    }

    const albumRes = await client.query(
      `
      SELECT id, title, event_id
      FROM albums
      WHERE id = $1
      LIMIT 1
      `,
      [section.album_id]
    );

    if (albumRes.rows.length === 0) {
      return res.status(400).json({
        message: "Albumi i lidhur me guest section nuk u gjet."
      });
    }

    const targetAlbum = albumRes.rows[0];

    if (targetAlbum.event_id !== section.event_id) {
      return res.status(400).json({
        message:
          "Albumi i lidhur me guest section nuk i përket këtij eventi."
      });
    }

    await client.query("BEGIN");

    const uploadedMedia = [];

    for (let index = 0; index < req.files.length; index++) {
      const file = req.files[index];

      const objectKey = buildSpacesObjectKey({
        eventId: section.event_id,
        albumId: targetAlbum.id,
        originalName: file.originalname,
        index
      });

      const uploadResult = await uploadBufferToSpaces({
        buffer: file.buffer,
        key: objectKey,
        mimetype: file.mimetype
      });

      const originalName =
        file.originalname?.replace(/\.[^/.]+$/, "").trim() || "Guest Upload";

      const bytes = Number(file.size || 0);

      const insert = await client.query(
        `
        INSERT INTO media (
          tenant_id,
          event_id,
          album_id,
          type,
          title,
          file_url,
          thumbnail_url,
          public_id,
          provider_file_id,
          resource_type,
          format,
          width,
          height,
          size_bytes,
          bytes,
          sort_order,
          storage_provider,
          created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, NULL, $8, $9, $10, NULL, NULL, $11, $12, $13, $14, NOW()
        )
        RETURNING *
        `,
        [
          section.tenant_id,
          section.event_id,
          targetAlbum.id,
          "image",
          originalName,
          uploadResult.url,
          null,
          uploadResult.key,
          "image",
          file.mimetype?.split("/")[1] || "jpg",
          bytes,
          bytes,
          index,
          "wasabi"
        ]
      );

      uploadedMedia.push(insert.rows[0]);
    }

    await client.query(
      `
      UPDATE guest_sections
      SET uploaded_photos_count = COALESCE(uploaded_photos_count, 0) + $1
      WHERE id = $2
      `,
      [uploadedMedia.length, section.id]
    );

    const totalUploadedBytes = uploadedMedia.reduce(
      (sum, item) => sum + Number(item.size_bytes || item.bytes || 0),
      0
    );

    if (totalUploadedBytes > 0) {
      await client.query(
        `
        UPDATE tenants
        SET storage_used_bytes = COALESCE(storage_used_bytes, 0) + $1
        WHERE id = $2
        `,
        [totalUploadedBytes, section.tenant_id]
      );
    }

    await client.query("COMMIT");

    const signedUploadedMedia = await Promise.all(
      uploadedMedia.map((item) => signMediaItem(item))
    );

    return res.status(200).json({
      message: `${signedUploadedMedia.length} foto u ngarkuan me sukses.`,
      media: signedUploadedMedia,
      album_id: targetAlbum.id,
      album_title: targetAlbum.title,
      uploaded_photos_count: currentCount + signedUploadedMedia.length,
      max_upload_photos: maxCount,
      remaining_photos: Math.max(
        0,
        maxCount - (currentCount + signedUploadedMedia.length)
      )
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("uploadGuestMedia error:", error);
    return res.status(500).json({
      message: "Gabim gjatë upload-it.",
      error: error.message
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getPublicGallery,
  getPublicAlbumMedia,
  verifyGalleryPassword,
  downloadWholeEventZip,
  getGuestSectionBySlug,
  uploadGuestMedia
};