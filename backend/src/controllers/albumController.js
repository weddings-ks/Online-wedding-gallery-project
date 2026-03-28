const pool = require("../config/db");
const slugify = require("../utils/slugify");
const {
  uploadBufferToSpaces,
  buildSpacesObjectKey,
  deleteObjectFromSpaces
} = require("../config/spaces");

async function uploadAlbumCoverToWasabi({
  file,
  tenantId,
  eventId,
  albumSlugHint = "album-cover"
}) {
  const objectKey = buildSpacesObjectKey({
    tenantId,
    eventId,
    albumId: albumSlugHint,
    originalName: file.originalname,
    index: 0
  });

  const uploaded = await uploadBufferToSpaces({
    buffer: file.buffer,
    key: objectKey,
    mimetype: file.mimetype
  });

  return {
    url: uploaded.url,
    key: uploaded.key,
    bytes: Number(file.size || 0),
    storageProvider: "wasabi"
  };
}

exports.createAlbum = async (req, res) => {
  try {
    const { event_id, title } = req.body;

    if (!event_id || !title) {
      return res.status(400).json({
        message: "event_id dhe title janë të detyrueshme."
      });
    }

    const eventCheck = await pool.query(
      "SELECT * FROM events WHERE id = $1",
      [event_id]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Eventi nuk u gjet."
      });
    }

    const event = eventCheck.rows[0];

    if (
      req.user.role !== "super_admin" &&
      event.tenant_id !== req.user.tenantId
    ) {
      return res.status(403).json({
        message: "Nuk ke leje për këtë event."
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

    let coverImageUrl = null;
    let coverImagePublicId = null;
    let coverImageSizeBytes = 0;

    if (req.file) {
      const uploaded = await uploadAlbumCoverToWasabi({
        file: req.file,
        tenantId: event.tenant_id,
        eventId: event_id,
        albumSlugHint: slug || "album-cover"
      });

      coverImageUrl = uploaded.url;
      coverImagePublicId = uploaded.key;
      coverImageSizeBytes = uploaded.bytes;
    }

    const result = await pool.query(
      `
      INSERT INTO albums (
        tenant_id,
        event_id,
        title,
        slug,
        cover_image_url,
        cover_image_public_id,
        cover_image_size_bytes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        event.tenant_id,
        event_id,
        title,
        slug,
        coverImageUrl,
        coverImagePublicId,
        coverImageSizeBytes
      ]
    );

    if (coverImageSizeBytes > 0) {
      await pool.query(
        `
        UPDATE tenants
        SET storage_used_bytes = COALESCE(storage_used_bytes, 0) + $1
        WHERE id = $2
        `,
        [coverImageSizeBytes, event.tenant_id]
      );
    }

    res.status(201).json({
      message: "Albumi u krijua me sukses.",
      album: {
        ...result.rows[0],
        storage_provider: "wasabi"
      }
    });
  } catch (error) {
    console.error("CREATE ALBUM ERROR:", error);
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
      `
      SELECT *
      FROM albums
      WHERE event_id = $1
      ORDER BY sort_order ASC, created_at DESC
      `,
      [eventId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("GET ALBUMS BY EVENT ERROR:", error);
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
      `
      SELECT a.*, e.title AS event_title, e.slug AS event_slug
      FROM albums a
      JOIN events e ON a.event_id = e.id
      WHERE e.slug = $1 AND a.slug = $2
      `,
      [eventSlug, albumSlug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Albumi nuk u gjet."
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("GET ALBUM BY SLUG ERROR:", error);
    res.status(500).json({
      message: "Gabim në marrjen e albumit.",
      error: error.message
    });
  }
};

exports.updateAlbum = async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    const albumCheck = await pool.query(
      "SELECT * FROM albums WHERE id = $1",
      [id]
    );

    if (albumCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Albumi nuk u gjet."
      });
    }

    const album = albumCheck.rows[0];

    if (
      req.user.role !== "super_admin" &&
      album.tenant_id !== req.user.tenantId
    ) {
      return res.status(403).json({
        message: "Nuk ke leje për këtë album."
      });
    }

    const newTitle = title?.trim() || album.title;
    let newSlug = album.slug;

    if (newTitle !== album.title) {
      const baseSlug = slugify(newTitle);
      newSlug = baseSlug;

      const existingAlbum = await pool.query(
        "SELECT id FROM albums WHERE event_id = $1 AND slug = $2 AND id != $3",
        [album.event_id, newSlug, id]
      );

      if (existingAlbum.rows.length > 0) {
        newSlug = `${baseSlug}-${Date.now()}`;
      }
    }

    let coverImageUrl = album.cover_image_url;
    let coverImagePublicId = album.cover_image_public_id || null;
    let coverImageSizeBytes = Number(album.cover_image_size_bytes || 0);

    if (req.file) {
      if (album.cover_image_public_id) {
        try {
          await deleteObjectFromSpaces(album.cover_image_public_id);
        } catch (deleteError) {
          console.error(
            "Gabim në fshirjen e cover-it të vjetër nga Wasabi:",
            deleteError.message
          );
        }
      }

      const uploaded = await uploadAlbumCoverToWasabi({
        file: req.file,
        tenantId: album.tenant_id,
        eventId: album.event_id,
        albumSlugHint: newSlug || album.slug || "album-cover"
      });

      const oldCoverSize = Number(album.cover_image_size_bytes || 0);
      const newCoverSize = Number(uploaded.bytes || 0);
      const diffBytes = newCoverSize - oldCoverSize;

      if (diffBytes !== 0) {
        await pool.query(
          `
          UPDATE tenants
          SET storage_used_bytes = GREATEST(COALESCE(storage_used_bytes, 0) + $1, 0)
          WHERE id = $2
          `,
          [diffBytes, album.tenant_id]
        );
      }

      coverImageUrl = uploaded.url;
      coverImagePublicId = uploaded.key;
      coverImageSizeBytes = uploaded.bytes;
    }

    const result = await pool.query(
      `
      UPDATE albums
      SET title = $1,
          slug = $2,
          cover_image_url = $3,
          cover_image_public_id = $4,
          cover_image_size_bytes = $5
      WHERE id = $6
      RETURNING *
      `,
      [
        newTitle,
        newSlug,
        coverImageUrl,
        coverImagePublicId,
        coverImageSizeBytes,
        id
      ]
    );

    res.json({
      message: "Albumi u përditësua me sukses.",
      album: {
        ...result.rows[0],
        storage_provider: "wasabi"
      }
    });
  } catch (error) {
    console.error("UPDATE ALBUM ERROR:", error);
    res.status(500).json({
      message: "Gabim në përditësimin e albumit.",
      error: error.message
    });
  }
};

exports.deleteAlbum = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const albumCheck = await client.query(
      "SELECT * FROM albums WHERE id = $1 LIMIT 1",
      [id]
    );

    if (albumCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Albumi nuk u gjet."
      });
    }

    const album = albumCheck.rows[0];

    if (
      req.user.role !== "super_admin" &&
      album.tenant_id !== req.user.tenantId
    ) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "Nuk ke leje për këtë album."
      });
    }

    let totalDeletedBytes = Number(album.cover_image_size_bytes || 0);

    if (album.cover_image_public_id) {
      try {
        await deleteObjectFromSpaces(album.cover_image_public_id);
      } catch (deleteError) {
        console.error(
          "Gabim në fshirjen e album cover nga Wasabi:",
          deleteError.message
        );
      }
    }

    const mediaResult = await client.query(
      `
      SELECT id, provider_file_id, type, resource_type, size_bytes, bytes
      FROM media
      WHERE album_id = $1
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

    await client.query("DELETE FROM media WHERE album_id = $1", [id]);

    await client.query(
      `
      UPDATE tenants
      SET storage_used_bytes = GREATEST(COALESCE(storage_used_bytes, 0) - $1, 0)
      WHERE id = $2
      `,
      [totalDeletedBytes, album.tenant_id]
    );

    await client.query("DELETE FROM albums WHERE id = $1", [id]);

    await client.query("COMMIT");

    res.json({
      message: "Albumi dhe të gjitha mediat e tij u fshinë me sukses.",
      deletedMediaCount: mediaResult.rows.length
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("DELETE ALBUM ERROR:", error);
    res.status(500).json({
      message: "Gabim në fshirjen e albumit.",
      error: error.message
    });
  } finally {
    client.release();
  }
};