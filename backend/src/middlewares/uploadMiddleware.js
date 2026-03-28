const multer = require("multer");

const MAX_FILE_SIZE_MB = 200; // 200MB per file
const MAX_FILES_PER_REQUEST = 50;

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm"
]);

function fileFilter(req, file, cb) {
  if (allowedMimeTypes.has(file.mimetype)) {
    return cb(null, true);
  }

  return cb(
    new Error(
      `Format file nuk lejohet për "${file.originalname}". Lejohen vetëm JPG, PNG, WEBP, HEIC, HEIF, MP4, MOV, WEBM.`
    ),
    false
  );
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files: MAX_FILES_PER_REQUEST
  }
});

module.exports = upload;