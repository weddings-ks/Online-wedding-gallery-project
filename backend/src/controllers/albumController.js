const pool = require("../config/db");
const slugify = require("../utils/slugify");

exports.createAlbum = async (req, res) => {
  try {
    const { event_id, title, cover_image } = req.body;

    if (!event_id || !title) {
      return res.status(400).json({
        message: "event_id dhe title janë të detyrueshme."
      });
    }

    const eventCheck = await pool.query(
      "SELECT id FROM events WHERE id = $1",
      [event_id]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Eventi nuk u gjet."
      });
    }

    const baseSlug = slugify(title);
    let slug = baseSlug;

    const existingAlbum = await pool.query(
      "SELECT id FROM albums WHERE event_id = $1 AND slug = $2",
      [event_id, slug]
    );

    if (existingAlbum.rows.length > 0) {
      slug = `${baseSlug}-${Date.now()}`;
    }

    const result = await pool.query(
      `INSERT INTO albums (event_id, title, slug, cover_image)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [event_id, title, slug, cover_image || null]
    );

    res.status(201).json({
      message: "Albumi u krijua me sukses.",
      album: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      message: "Gabim në krijimin e albumit.",
      error: error.message
    });
  }
};

exports.getAlbumsByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const result = await pool.query(
      "SELECT * FROM albums WHERE event_id = $1 ORDER BY created_at ASC",
      [eventId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      message: "Gabim në marrjen e albumeve.",
      error: error.message
    });
  }
};

exports.getAlbumBySlug = async (req, res) => {
  try {
    const { eventSlug, albumSlug } = req.params;

    const result = await pool.query(
      `SELECT a.*, e.title AS event_title, e.slug AS event_slug
       FROM albums a
       JOIN events e ON a.event_id = e.id
       WHERE e.slug = $1 AND a.slug = $2`,
      [eventSlug, albumSlug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Albumi nuk u gjet."
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      message: "Gabim në marrjen e albumit.",
      error: error.message
    });
  }
};

exports.updateAlbum = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, cover_image } = req.body;

    const albumCheck = await pool.query(
      "SELECT * FROM albums WHERE id = $1",
      [id]
    );

    if (albumCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Albumi nuk u gjet."
      });
    }

    const currentAlbum = albumCheck.rows[0];
    const newTitle = title?.trim() || currentAlbum.title;
    const newCoverImage =
      cover_image !== undefined ? cover_image : currentAlbum.cover_image;

    let newSlug = currentAlbum.slug;

    if (newTitle !== currentAlbum.title) {
      const baseSlug = slugify(newTitle);
      newSlug = baseSlug;

      const existingAlbum = await pool.query(
        "SELECT id FROM albums WHERE event_id = $1 AND slug = $2 AND id != $3",
        [currentAlbum.event_id, newSlug, id]
      );

      if (existingAlbum.rows.length > 0) {
        newSlug = `${baseSlug}-${Date.now()}`;
      }
    }

    const result = await pool.query(
      `UPDATE albums
       SET title = $1, slug = $2, cover_image = $3
       WHERE id = $4
       RETURNING *`,
      [newTitle, newSlug, newCoverImage, id]
    );

    res.json({
      message: "Albumi u përditësua me sukses.",
      album: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      message: "Gabim në përditësimin e albumit.",
      error: error.message
    });
  }
};

exports.deleteAlbum = async (req, res) => {
  try {
    const { id } = req.params;

    const albumCheck = await pool.query(
      "SELECT * FROM albums WHERE id = $1",
      [id]
    );

    if (albumCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Albumi nuk u gjet."
      });
    }

    const mediaCheck = await pool.query(
      "SELECT id FROM media WHERE album_id = $1 LIMIT 1",
      [id]
    );

    if (mediaCheck.rows.length > 0) {
      return res.status(400).json({
        message: "Fshiji fillimisht fotot/videot e albumit."
      });
    }

    await pool.query(
      "DELETE FROM albums WHERE id = $1",
      [id]
    );

    res.json({
      message: "Albumi u fshi me sukses."
    });
  } catch (error) {
    res.status(500).json({
      message: "Gabim në fshirjen e albumit.",
      error: error.message
    });
  }
};