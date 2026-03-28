const pool = require("../config/db");
const {
  uploadBufferToSpaces,
  buildSpacesObjectKey,
  generateSignedUrl,
  deleteObjectFromSpaces
} = require("../config/spaces");

const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobe = require("ffprobe-static");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobe.path);

const UPLOAD_CONCURRENCY = 4;
const IMAGE_MAX_WIDTH = 3000;
const VIDEO_MAX_HEIGHT = 1080;

function chunkArray(items, size) {
  const chunks = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

function sanitizeFileName(name = "file") {
  return name
    .toString()
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase();
}

function getVideoOutputName(originalname = "video.mp4") {
  const base = path.basename(originalname, path.extname(originalname));
  return `${sanitizeFileName(base || "video")}.mp4`;
}

async function signMediaItem(item) {
  const signedUrl = item.provider_file_id
    ? await generateSignedUrl(item.provider_file_id)
    : item.file_url || null;

  return {
    ...item,
    file_url: signedUrl,
    thumbnail_url: signedUrl
  };
}

async function ensureTempDir() {
  const dir = path.join(os.tmpdir(), "wedding-gallery-temp");
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

async function compressImageBuffer(file) {
  const inputBuffer =
    file?.buffer && Buffer.isBuffer(file.buffer) && file.buffer.length > 0
      ? file.buffer
      : null;

  const inputPath = file?.path || null;

  let sharpInput = null;

  if (inputBuffer) {
    sharpInput = inputBuffer;
  } else if (inputPath) {
    sharpInput = inputPath;
  } else {
    throw new Error("Image input mungon ose është invalid.");
  }

  try {
    const image = sharp(sharpInput).rotate();
    const metadata = await image.metadata();

    const buffer = await image
      .resize({
        width: IMAGE_MAX_WIDTH,
        withoutEnlargement: true,
        fit: "inside"
      })
      .webp({
        quality: 90,
        effort: 6
      })
      .toBuffer();

    return {
      buffer,
      mimetype: "image/webp",
      extension: "webp",
      width: metadata.width || null,
      height: metadata.height || null
    };
  } finally {
    try {
      if (inputPath && fs.existsSync(inputPath)) {
        await fsp.unlink(inputPath);
      }
    } catch {}
  }
}

function compressVideoFile(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-vf scale=-2:${VIDEO_MAX_HEIGHT}:force_original_aspect_ratio=decrease`,
        "-c:v libx264",
        "-preset medium",
        "-crf 23",
        "-profile:v high",
        "-level 4.1",
        "-maxrate 8M",
        "-bufsize 16M",
        "-movflags +faststart",
        "-pix_fmt yuv420p",
        "-map_metadata -1",
        "-c:a aac",
        "-b:a 128k",
        "-ac 2"
      ])
      .format("mp4")
      .on("start", (commandLine) => {
        console.log("FFmpeg command:", commandLine);
      })
      .on("end", resolve)
      .on("error", reject)
      .save(outputPath);
  });
}

function getVideoDimensions(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        resolve({ width: null, height: null });
        return;
      }

      const videoStream = data?.streams?.find(
        (stream) => stream.codec_type === "video"
      );

      resolve({
        width: videoStream?.width || null,
        height: videoStream?.height || null
      });
    });
  });
}

async function compressVideoBuffer(file) {
  const tempDir = await ensureTempDir();

  const uniqueBase = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const inputPath = path.join(
    tempDir,
    `input-${uniqueBase}-${getVideoOutputName(file.originalname)}`
  );
  const outputPath = path.join(
    tempDir,
    `output-${uniqueBase}-${getVideoOutputName(file.originalname)}`
  );

  try {
    if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new Error("Video buffer mungon ose është invalid.");
    }

    await fsp.writeFile(inputPath, file.buffer);

    await compressVideoFile(inputPath, outputPath);

    const compressedBuffer = await fsp.readFile(outputPath);
    const dimensions = await getVideoDimensions(outputPath);

    return {
      buffer: compressedBuffer,
      mimetype: "video/mp4",
      extension: "mp4",
      width: dimensions.width,
      height: dimensions.height
    };
  } finally {
    try {
      if (fs.existsSync(inputPath)) {
        await fsp.unlink(inputPath);
      }
    } catch {}

    try {
      if (fs.existsSync(outputPath)) {
        await fsp.unlink(outputPath);
      }
    } catch {}
  }
}

async function compressMediaFile(file) {
  const isVideo = file.mimetype && file.mimetype.startsWith("video/");

  if (isVideo) {
    return compressVideoBuffer(file);
  }

  return compressImageBuffer(file);
}

async function processSingleMediaFile({
  file,
  fileIndex,
  event,
  event_id,
  album_id,
  title
}) {
  let uploaded = null;

  try {
    const isVideo = file.mimetype && file.mimetype.startsWith("video/");
    const type = isVideo ? "video" : "image";
    const resourceType = isVideo ? "video" : "image";

    const compressed = await compressMediaFile(file);
    const finalBytes = Number(compressed.buffer.length || 0);

    const originalExt = path.extname(file.originalname || "");
    const safeBaseName = path.basename(file.originalname || "file", originalExt);
    const normalizedOriginalName = `${safeBaseName}.${compressed.extension}`;

    const objectKey = buildSpacesObjectKey({
      tenantId: event.tenant_id,
      eventId: event_id,
      albumId: album_id,
      originalName: normalizedOriginalName,
      index: fileIndex
    });

    uploaded = await uploadBufferToSpaces({
      buffer: compressed.buffer,
      key: objectKey,
      mimetype: compressed.mimetype
    });

    const fileUrl = uploaded.url;

    const result = await pool.query(
      `
      INSERT INTO media (
        tenant_id,
        event_id,
        album_id,
        type,
        title,
        file_url,
        thumbnail_url,
        provider_file_id,
        resource_type,
        format,
        width,
        height,
        size_bytes,
        bytes,
        sort_order,
        storage_provider
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
      RETURNING *
      `,
      [
        event.tenant_id,
        event_id,
        album_id,
        type,
        title || null,
        fileUrl,
        objectKey,
        resourceType,
        compressed.extension,
        compressed.width,
        compressed.height,
        finalBytes,
        finalBytes,
        fileIndex,
        "wasabi"
      ]
    );

    return {
      row: result.rows[0],
      uploadedBytes: finalBytes,
      index: fileIndex,
      provider: "wasabi"
    };
  } catch (error) {
    console.error("FILE UPLOAD ERROR:", error);

    if (uploaded?.key) {
      try {
        await deleteObjectFromSpaces(uploaded.key);
      } catch (cleanupError) {
        console.error("CLEANUP ERROR:", cleanupError.message);
      }
    }

    return null;
  }
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
      `
      SELECT e.*
      FROM events e
      WHERE e.id = $1
      LIMIT 1
      `,
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

    const albumCheck = await pool.query(
      `
      SELECT *
      FROM albums
      WHERE id = $1 AND event_id = $2
      LIMIT 1
      `,
      [album_id, event_id]
    );

    if (albumCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Albumi nuk u gjet për këtë event."
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

    const indexedFiles = req.files.map((file, index) => ({
      file,
      index
    }));

    const batches = chunkArray(indexedFiles, UPLOAD_CONCURRENCY);
    const uploadedResults = [];

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(({ file, index }) =>
          processSingleMediaFile({
            file,
            fileIndex: index,
            event,
            event_id,
            album_id,
            title
          })
        )
      );

      uploadedResults.push(...batchResults.filter(Boolean));
    }

    uploadedResults.sort((a, b) => a.index - b.index);

    const uploadedMedia = uploadedResults.map((item) => item.row);

    const totalUploadedBytes = uploadedResults.reduce(
      (sum, item) => sum + Number(item.uploadedBytes || 0),
      0
    );

    if (totalUploadedBytes > 0) {
      await pool.query(
        `
        UPDATE tenants
        SET storage_used_bytes = COALESCE(storage_used_bytes, 0) + $1
        WHERE id = $2
        `,
        [totalUploadedBytes, event.tenant_id]
      );
    }

    const signedUploadedMedia = await Promise.all(
      uploadedMedia.map((item) => signMediaItem(item))
    );

    if (signedUploadedMedia.length === 0) {
      return res.status(500).json({
        message: "Asnjë file nuk u ngarkua me sukses."
      });
    }

    res.status(201).json({
      message: `${signedUploadedMedia.length} media u ngarkuan me sukses.`,
      media: signedUploadedMedia,
      uploaded_total_bytes: totalUploadedBytes,
      uploaded_wasabi_bytes: totalUploadedBytes
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

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 24, 1),
      100
    );
    const offset = (page - 1) * limit;

    const albumCheck = await pool.query(
      `SELECT id FROM albums WHERE id = $1 LIMIT 1`,
      [albumId]
    );

    if (albumCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Albumi nuk u gjet."
      });
    }

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM media WHERE album_id = $1`,
      [albumId]
    );

    const total = countResult.rows[0]?.total || 0;

    const result = await pool.query(
      `
      SELECT *
      FROM media
      WHERE album_id = $1
      ORDER BY sort_order ASC, created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [albumId, limit, offset]
    );

    const signedMedia = await Promise.all(
      result.rows.map((item) => signMediaItem(item))
    );

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + result.rows.length < total,
      media: signedMedia
    });
  } catch (error) {
    console.error("GET MEDIA BY ALBUM ERROR:", error);
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
      `SELECT * FROM media WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (mediaResult.rows.length === 0) {
      return res.status(404).json({
        message: "Media nuk u gjet."
      });
    }

    const media = mediaResult.rows[0];

    if (
      req.user.role !== "super_admin" &&
      media.tenant_id !== req.user.tenantId
    ) {
      return res.status(403).json({
        message: "Nuk ke leje për këtë media."
      });
    }

    if (media.provider_file_id) {
      await deleteObjectFromSpaces(media.provider_file_id);
    }

    await pool.query(`DELETE FROM media WHERE id = $1`, [id]);

    const deletedBytes = Number(media.size_bytes || media.bytes || 0);

    if (deletedBytes > 0) {
      await pool.query(
        `
        UPDATE tenants
        SET storage_used_bytes = GREATEST(COALESCE(storage_used_bytes, 0) - $1, 0)
        WHERE id = $2
        `,
        [deletedBytes, media.tenant_id]
      );
    }

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
      `SELECT * FROM media WHERE album_id = $1`,
      [albumId]
    );

    if (mediaResult.rows.length === 0) {
      return res.status(404).json({
        message: "Nuk u gjet asnjë media në këtë album."
      });
    }

    const mediaItems = mediaResult.rows;

    if (
      req.user.role !== "super_admin" &&
      mediaItems[0].tenant_id !== req.user.tenantId
    ) {
      return res.status(403).json({
        message: "Nuk ke leje për këtë album."
      });
    }

    let totalDeletedBytes = 0;

    for (const media of mediaItems) {
      totalDeletedBytes += Number(media.size_bytes || media.bytes || 0);

      if (media.provider_file_id) {
        try {
          await deleteObjectFromSpaces(media.provider_file_id);
        } catch (deleteError) {
          console.error(
            `Gabim në fshirjen nga Wasabi për media ID ${media.id}:`,
            deleteError.message
          );
        }
      }
    }

    await pool.query(`DELETE FROM media WHERE album_id = $1`, [albumId]);

    if (totalDeletedBytes > 0) {
      await pool.query(
        `
        UPDATE tenants
        SET storage_used_bytes = GREATEST(COALESCE(storage_used_bytes, 0) - $1, 0)
        WHERE id = $2
        `,
        [totalDeletedBytes, mediaItems[0].tenant_id]
      );
    }

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