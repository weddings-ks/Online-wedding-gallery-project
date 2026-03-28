const pool = require("../config/db");
const generateGuestSectionSlug = require("../utils/generateGuestSectionSlug");

function parseBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function parseNonNegativeInt(value, fallback = 0) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

/* =========================
   CREATE GUEST SECTION
========================= */
const createGuestSection = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      event_id,
      title,
      description,
      is_active,
      sort_order,
      section_image_url,
      tenant_id,
      max_upload_photos
    } = req.body;

    if (!event_id || !title) {
      return res.status(400).json({
        message: "event_id dhe title janë të detyrueshme."
      });
    }

    const tenantId =
      req.user.role === "super_admin"
        ? tenant_id || null
        : req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: "tenant_id mungon."
      });
    }

    const eventCheck = await client.query(
      `SELECT id, tenant_id FROM events WHERE id = $1 LIMIT 1`,
      [event_id]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Eventi nuk u gjet."
      });
    }

    if (eventCheck.rows[0].tenant_id !== tenantId) {
      return res.status(403).json({
        message: "Nuk ke qasje në këtë event."
      });
    }

    /* ===== UNIQUE SLUG ===== */
    let slug = generateGuestSectionSlug(title);

    let exists = await client.query(
      `SELECT id FROM guest_sections WHERE slug = $1 LIMIT 1`,
      [slug]
    );

    while (exists.rows.length > 0) {
      slug = generateGuestSectionSlug(title);
      exists = await client.query(
        `SELECT id FROM guest_sections WHERE slug = $1 LIMIT 1`,
        [slug]
      );
    }

    const safeIsActive = parseBoolean(is_active, true);
    const safeSortOrder = parseNonNegativeInt(sort_order, 0);
    const safeMaxUploadPhotos = parseNonNegativeInt(max_upload_photos, 50);

    const guestAlbumTitle = "Fotot nga Dasmorët";

    /* ===== CREATE OR GET GUEST ALBUM ===== */
    let albumResult = await client.query(
      `SELECT id, title FROM albums WHERE event_id = $1 AND title = $2 LIMIT 1`,
      [event_id, guestAlbumTitle]
    );

    let albumId = albumResult.rows[0]?.id;

    if (!albumId) {
      const createdAlbum = await client.query(
        `INSERT INTO albums (tenant_id, event_id, title)
         VALUES ($1, $2, $3)
         RETURNING id, title`,
        [tenantId, event_id, guestAlbumTitle]
      );

      albumId = createdAlbum.rows[0].id;
      albumResult = createdAlbum;
    }

    /* ===== INSERT SECTION ===== */
    const result = await client.query(
      `INSERT INTO guest_sections (
        tenant_id,
        event_id,
        album_id,
        title,
        description,
        slug,
        is_active,
        sort_order,
        section_image_url,
        max_upload_photos,
        uploaded_photos_count
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0)
      RETURNING *`,
      [
        tenantId,
        event_id,
        albumId,
        title,
        description || null,
        slug,
        safeIsActive,
        safeSortOrder,
        section_image_url || null,
        safeMaxUploadPhotos
      ]
    );

    return res.status(201).json({
      message: "Guest section u krijua me sukses.",
      section: result.rows[0],
      guest_album: {
        id: albumId,
        title: albumResult.rows[0]?.title || guestAlbumTitle
      }
    });
  } catch (error) {
    console.error("createGuestSection error:", error);
    return res.status(500).json({
      message: "Gabim gjatë krijimit të guest section.",
      error: error.message
    });
  } finally {
    client.release();
  }
};

/* =========================
   GET BY EVENT
========================= */
const getGuestSectionsByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const eventCheck = await pool.query(
      `SELECT id, tenant_id FROM events WHERE id = $1 LIMIT 1`,
      [eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Eventi nuk u gjet."
      });
    }

    if (
      req.user.role !== "super_admin" &&
      eventCheck.rows[0].tenant_id !== req.user.tenantId
    ) {
      return res.status(403).json({
        message: "Nuk ke qasje në këtë event."
      });
    }

    const result = await pool.query(
      `SELECT *
       FROM guest_sections
       WHERE event_id = $1
       ORDER BY sort_order ASC, created_at DESC`,
      [eventId]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("getGuestSectionsByEvent error:", error);
    return res.status(500).json({
      message: "Gabim gjatë marrjes së guest sections.",
      error: error.message
    });
  }
};

/* =========================
   UPDATE
========================= */
const updateGuestSection = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      is_active,
      sort_order,
      section_image_url,
      max_upload_photos
    } = req.body;

    const existing = await pool.query(
      `SELECT gs.*, e.tenant_id AS event_tenant_id
       FROM guest_sections gs
       JOIN events e ON e.id = gs.event_id
       WHERE gs.id = $1
       LIMIT 1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        message: "Guest section nuk u gjet."
      });
    }

    const section = existing.rows[0];

    if (
      req.user.role !== "super_admin" &&
      section.event_tenant_id !== req.user.tenantId
    ) {
      return res.status(403).json({
        message: "Nuk ke qasje në këtë guest section."
      });
    }

    const updated = await pool.query(
      `UPDATE guest_sections
       SET
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        is_active = COALESCE($4, is_active),
        sort_order = COALESCE($5, sort_order),
        section_image_url = COALESCE($6, section_image_url),
        max_upload_photos = COALESCE($7, max_upload_photos),
        updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        title ?? null,
        description ?? null,
        is_active !== undefined ? parseBoolean(is_active, true) : null,
        sort_order !== undefined
          ? parseNonNegativeInt(sort_order, 0)
          : null,
        section_image_url ?? null,
        max_upload_photos !== undefined
          ? parseNonNegativeInt(max_upload_photos, 50)
          : null
      ]
    );

    return res.status(200).json({
      message: "Guest section u përditësua me sukses.",
      section: updated.rows[0]
    });
  } catch (error) {
    console.error("updateGuestSection error:", error);
    return res.status(500).json({
      message: "Gabim gjatë përditësimit të guest section.",
      error: error.message
    });
  }
};

/* =========================
   DELETE
========================= */
const deleteGuestSection = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query(
      `SELECT gs.id, e.tenant_id
       FROM guest_sections gs
       JOIN events e ON e.id = gs.event_id
       WHERE gs.id = $1
       LIMIT 1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        message: "Guest section nuk u gjet."
      });
    }

    if (
      req.user.role !== "super_admin" &&
      existing.rows[0].tenant_id !== req.user.tenantId
    ) {
      return res.status(403).json({
        message: "Nuk ke qasje në këtë guest section."
      });
    }

    await pool.query(`DELETE FROM guest_sections WHERE id = $1`, [id]);

    return res.status(200).json({
      message: "Guest section u fshi me sukses."
    });
  } catch (error) {
    console.error("deleteGuestSection error:", error);
    return res.status(500).json({
      message: "Gabim gjatë fshirjes së guest section.",
      error: error.message
    });
  }
};

module.exports = {
  createGuestSection,
  getGuestSectionsByEvent,
  updateGuestSection,
  deleteGuestSection
};