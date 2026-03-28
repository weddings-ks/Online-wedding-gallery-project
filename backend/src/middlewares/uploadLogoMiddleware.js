const multer = require("multer");

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml"
]);

function fileFilter(req, file, cb) {
  if (allowedMimeTypes.has(file.mimetype)) {
    return cb(null, true);
  }

  return cb(
    new Error(
      `Format file nuk lejohet për "${file.originalname}". Lejohen vetëm JPG, PNG, WEBP, SVG.`
    ),
    false
  );
}

const uploadLogo = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

module.exports = uploadLogo;