const express = require("express");
const router = express.Router();
const multer = require("multer");

const {
  createEvent,
  getEvents,
  getEventBySlug,
  updateEvent,
  deleteEvent
} = require("../controllers/eventController");

const { protect } = require("../middlewares/authMiddleware");

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", protect, upload.single("cover"), createEvent);
router.get("/", protect, getEvents);
router.get("/slug/:slug", getEventBySlug);
router.put("/:id", protect, upload.single("cover"), updateEvent);
router.delete("/:id", protect, deleteEvent);

module.exports = router;