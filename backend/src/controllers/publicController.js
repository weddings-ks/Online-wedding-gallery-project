const pool = require("../config/db");
const archiver = require("archiver");
const axios = require("axios");

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

const downloadAlbumZip = async (req, res) => {
  try {
    const { albumId } = req.params;

    const albumResult = await pool.query(
      `
      SELECT id, title
      FROM albums
      WHERE id = $1
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

    const mediaResult = await pool.query(
      `
      SELECT id, title, type, file_url
      FROM media
      WHERE album_id = $1
      ORDER BY id ASC
      `,
      [albumId]
    );

    const mediaItems = mediaResult.rows;

    if (mediaItems.length === 0) {
      return res.status(404).json({
        message: "Albumi nuk ka media."
      });
    }

    const zipName = `${album.title || "album"}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${zipName}"`
    );

    const archive = archiver("zip", {
      zlib: { level: 9 }
    });

    archive.pipe(res);

    for (let i = 0; i < mediaItems.length; i++) {
      const item = mediaItems[i];

      const extension = item.type === "video" ? "mp4" : "jpg";
      const fileName = `${i + 1}-${item.title || "media"}.${extension}`;

      const response = await axios({
        method: "get",
        url: item.file_url,
        responseType: "stream"
      });

      archive.append(response.data, { name: fileName });
    }

    await archive.finalize();
  } catch (error) {
    console.error("Gabim në downloadAlbumZip:", error);

    if (!res.headersSent) {
      res.status(500).json({
        message: "Gabim gjatë krijimit të ZIP."
      });
    }
  }
};

module.exports = {
  getPublicGallery,
  downloadAlbumZip
};