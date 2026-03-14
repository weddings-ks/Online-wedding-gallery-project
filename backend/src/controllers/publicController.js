const pool = require("../config/db");

const getPublicGallery = async (req, res) => {
  try {
    const { slug } = req.params;

    const eventResult = await pool.query(
      `
      SELECT *
      FROM events
      WHERE slug = $1
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

    const albumsResult = await pool.query(
      `
      SELECT *
      FROM albums
      WHERE event_id = $1
      ORDER BY id DESC
      `,
      [event.id]
    );

    const mediaResult = await pool.query(
      `
      SELECT *
      FROM media
      WHERE event_id = $1
      ORDER BY id DESC
      `,
      [event.id]
    );

    const albumsWithMedia = albumsResult.rows.map((album) => {
      const albumMedia = mediaResult.rows.filter(
        (item) => Number(item.album_id) === Number(album.id)
      );

      return {
        ...album,
        media: albumMedia
      };
    });

    return res.json({
      event,
      albums: albumsWithMedia
    });
  } catch (error) {
    console.error("Gabim në getPublicGallery:", error);
    return res.status(500).json({
      message: "Gabim në server."
    });
  }
};

module.exports = {
  getPublicGallery
};