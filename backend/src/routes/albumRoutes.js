const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const {
  createAlbum,
  getAlbumsByEvent,
  getAlbumBySlug,
  updateAlbum,
  deleteAlbum
} = require("../controllers/albumController");

router.post("/", protect, adminOnly, createAlbum);
router.get("/event/:eventId", getAlbumsByEvent);
router.get("/:eventSlug/:albumSlug", getAlbumBySlug);

router.put("/:id", protect, adminOnly, updateAlbum);
router.delete("/:id", protect, adminOnly, deleteAlbum);

module.exports = router;