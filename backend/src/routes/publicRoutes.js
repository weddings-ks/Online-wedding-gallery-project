const express = require("express");
const router = express.Router();

const upload = require("../middlewares/uploadMiddleware");

const {
  getPublicGallery,
  getPublicAlbumMedia,
  verifyGalleryPassword,
  downloadWholeEventZip,
  getGuestSectionBySlug,
  uploadGuestMedia
} = require("../controllers/publicController");

router.get("/gallery/:slug", getPublicGallery);
router.post("/gallery/:slug/verify-password", verifyGalleryPassword);
router.get("/gallery/:slug/download", downloadWholeEventZip);
router.get("/albums/:albumId/media", getPublicAlbumMedia);

router.get("/guest-section/:slug", getGuestSectionBySlug);

router.post(
  "/guest-upload/:slug",
  upload.array("files", 20),
  uploadGuestMedia
);

module.exports = router;