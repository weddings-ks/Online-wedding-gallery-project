const express = require("express");
const router = express.Router();

const {
  getPublicGallery,
  downloadAlbumZip
} = require("../controllers/publicController");

router.get("/gallery/:slug", getPublicGallery);

/* DOWNLOAD ALBUM ZIP */
router.get("/albums/:albumId/download-zip", downloadAlbumZip);

module.exports = router;