const pool = require("../config/db");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

function uploadToCloudinary(fileBuffer, folder, resourceType) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
}

exports.uploadMedia = async (req, res) => {
  try {
    const { event_id, album_id, title } = req.body;

    if (!event_id || !album_id) {
      return res.status(400).json({
        message: "event_id dhe album_id janë të detyrueshme."
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "Asnjë file nuk u dërgua."
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

    const albumCheck = await pool.query(
      "SELECT id FROM albums WHERE id = $1 AND event_id = $2",
      [album_id, event_id]
    );

    if (albumCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Albumi nuk u gjet për këtë event."
      });
    }

    const uploadedMedia = [];

    for (const file of req.files) {
      const isVideo = file.mimetype.startsWith("video/");
      const resourceType = isVideo ? "video" : "image";
      const type = isVideo ? "video" : "image";

      const uploaded = await uploadToCloudinary(
        file.buffer,
        `wedding-gallery/event-${event_id}/album-${album_id}`,
        resourceType
      );

      const fileUrl = uploaded.secure_url;
      const publicId = uploaded.public_id;

      let thumbnailUrl = null;

      if (type === "video") {
        thumbnailUrl = cloudinary.url(publicId, {
          resource_type: "video",
          format: "jpg",
          transformation: [{ width: 500, height: 500, crop: "fill" }]
        });
      } else {
        thumbnailUrl = uploaded.secure_url;
      }

      const result = await pool.query(
        `INSERT INTO media (event_id, album_id, type, file_url, public_id, thumbnail_url, title)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          event_id,
          album_id,
          type,
          fileUrl,
          publicId,
          thumbnailUrl,
          title || null
        ]
      );

      uploadedMedia.push(result.rows[0]);
    }

    res.status(201).json({
      message: `${uploadedMedia.length} media u ngarkuan me sukses.`,
      media: uploadedMedia
    });
  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    res.status(500).json({
      message: "Gabim në upload të medias.",
      error: error.message
    });
  }
};

exports.getMediaByAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;

    const result = await pool.query(
      "SELECT * FROM media WHERE album_id = $1 ORDER BY created_at DESC",
      [albumId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      message: "Gabim në marrjen e medias.",
      error: error.message
    });
  }
};

exports.deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;

    const mediaResult = await pool.query(
      "SELECT * FROM media WHERE id = $1",
      [id]
    );

    if (mediaResult.rows.length === 0) {
      return res.status(404).json({
        message: "Media nuk u gjet."
      });
    }

    const media = mediaResult.rows[0];

    if (media.public_id) {
      await cloudinary.uploader.destroy(media.public_id, {
        resource_type: media.type === "video" ? "video" : "image"
      });
    }

    await pool.query(
      "DELETE FROM media WHERE id = $1",
      [id]
    );

    res.json({
      message: "Media u fshi me sukses.",
      deletedMedia: media
    });
  } catch (error) {
    console.error("DELETE MEDIA ERROR:", error);
    res.status(500).json({
      message: "Gabim në fshirjen e medias.",
      error: error.message
    });
  }
};

exports.deleteAllMediaByAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;

    const mediaResult = await pool.query(
      "SELECT * FROM media WHERE album_id = $1",
      [albumId]
    );

    if (mediaResult.rows.length === 0) {
      return res.status(404).json({
        message: "Nuk u gjet asnjë media në këtë album."
      });
    }

    const mediaItems = mediaResult.rows;

    for (const media of mediaItems) {
      if (media.public_id) {
        try {
          await cloudinary.uploader.destroy(media.public_id, {
            resource_type: media.type === "video" ? "video" : "image"
          });
        } catch (cloudinaryError) {
          console.error(
            `Gabim në fshirjen nga Cloudinary për media ID ${media.id}:`,
            cloudinaryError.message
          );
        }
      }
    }

    await pool.query(
      "DELETE FROM media WHERE album_id = $1",
      [albumId]
    );

    res.json({
      message: "Të gjitha mediat e albumit u fshinë me sukses.",
      deletedCount: mediaItems.length
    });
  } catch (error) {
    console.error("DELETE ALL MEDIA ERROR:", error);
    res.status(500).json({
      message: "Gabim në fshirjen e të gjitha mediave.",
      error: error.message
    });
  }
};