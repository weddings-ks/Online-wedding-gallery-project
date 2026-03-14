const pool = require("../config/db");
const slugify = require("../utils/slugify");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

function uploadBufferToCloudinary(fileBuffer, folder = "wedding-gallery/event-covers") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
}

exports.createEvent = async (req, res) => {
  try {
    const { title, description, event_date, cover_image } = req.body;

    if (!title) {
      return res.status(400).json({
        message: "Titulli i eventit është i detyrueshëm."
      });
    }

    const baseSlug = slugify(title);
    let slug = baseSlug;

    const existingEvent = await pool.query(
      "SELECT id FROM events WHERE slug = $1",
      [slug]
    );

    if (existingEvent.rows.length > 0) {
      slug = `${baseSlug}-${Date.now()}`;
    }

    let finalCoverImage = cover_image || null;

    if (req.file) {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer);
      finalCoverImage = uploaded.secure_url;
    }

    const result = await pool.query(
      `INSERT INTO events (title, slug, description, cover_image, event_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        title,
        slug,
        description || null,
        finalCoverImage,
        event_date || null,
        req.user.id
      ]
    );

    res.status(201).json({
      message: "Eventi u krijua me sukses.",
      event: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      message: "Gabim në krijimin e eventit.",
      error: error.message
    });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM events ORDER BY created_at DESC"
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      message: "Gabim në marrjen e eventeve.",
      error: error.message
    });
  }
};

exports.getEventBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      "SELECT * FROM events WHERE slug = $1",
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Eventi nuk u gjet."
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      message: "Gabim në marrjen e eventit.",
      error: error.message
    });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, event_date, cover_image } = req.body;

    const eventCheck = await pool.query(
      "SELECT * FROM events WHERE id = $1",
      [id]
    );

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

    let newCoverImage =
      cover_image !== undefined ? cover_image : currentEvent.cover_image;

    if (req.file) {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer);
      newCoverImage = uploaded.secure_url;
    }

    let newSlug = currentEvent.slug;

    if (newTitle !== currentEvent.title) {
      const baseSlug = slugify(newTitle);
      newSlug = baseSlug;

      const existingEvent = await pool.query(
        "SELECT id FROM events WHERE slug = $1 AND id != $2",
        [newSlug, id]
      );

      if (existingEvent.rows.length > 0) {
        newSlug = `${baseSlug}-${Date.now()}`;
      }
    }

    const result = await pool.query(
      `UPDATE events
       SET title = $1,
           slug = $2,
           description = $3,
           cover_image = $4,
           event_date = $5
       WHERE id = $6
       RETURNING *`,
      [newTitle, newSlug, newDescription, newCoverImage, newEventDate, id]
    );

    res.json({
      message: "Eventi u përditësua me sukses.",
      event: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      message: "Gabim në përditësimin e eventit.",
      error: error.message
    });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const eventCheck = await pool.query(
      "SELECT * FROM events WHERE id = $1",
      [id]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Eventi nuk u gjet."
      });
    }

    const albumsCheck = await pool.query(
      "SELECT id FROM albums WHERE event_id = $1 LIMIT 1",
      [id]
    );

    if (albumsCheck.rows.length > 0) {
      return res.status(400).json({
        message: "Fshiji fillimisht albumet e eventit."
      });
    }

    await pool.query("DELETE FROM events WHERE id = $1", [id]);

    res.json({
      message: "Eventi u fshi me sukses."
    });
  } catch (error) {
    res.status(500).json({
      message: "Gabim në fshirjen e eventit.",
      error: error.message
    });
  }
};