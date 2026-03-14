const express = require("express");
const router = express.Router();
const mediaController = require("../controllers/mediaController");
const { protect } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

router.post(
  "/upload",
  protect,
  upload.array("files", 100),
  mediaController.uploadMedia
);

router.get("/album/:albumId", mediaController.getMediaByAlbum);

router.delete(
  "/album/:albumId/delete-all",
  protect,
  mediaController.deleteAllMediaByAlbum
);

router.delete("/:id", protect, mediaController.deleteMedia);

module.exports = router;