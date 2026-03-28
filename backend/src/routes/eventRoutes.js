const express = require("express");
const router = express.Router();

const {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  updateEventDownloadSettings,
  updateEventAutoDeleteSettings,
  downloadEventZip,
  getGuestSectionByToken,
  regenerateGuestToken,
  toggleGuestSection
} = require("../controllers/eventController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const upload = require("../middlewares/uploadMiddleware");

router.get("/", authMiddleware, getEvents);

router.get("/guest/:token", getGuestSectionByToken);

router.post(
  "/",
  authMiddleware,
  roleMiddleware("super_admin", "studio_admin"),
  upload.single("cover"),
  createEvent
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("super_admin", "studio_admin"),
  upload.single("cover"),
  updateEvent
);

router.patch(
  "/:id/download-settings",
  authMiddleware,
  roleMiddleware("super_admin", "studio_admin"),
  updateEventDownloadSettings
);

router.patch(
  "/:id/auto-delete",
  authMiddleware,
  roleMiddleware("super_admin", "studio_admin"),
  updateEventAutoDeleteSettings
);

router.patch(
  "/:id/guest-token/regenerate",
  authMiddleware,
  roleMiddleware("super_admin", "studio_admin"),
  regenerateGuestToken
);

router.patch(
  "/:id/guest-section",
  authMiddleware,
  roleMiddleware("super_admin", "studio_admin"),
  toggleGuestSection
);

router.get(
  "/:id/download",
  authMiddleware,
  roleMiddleware("super_admin", "studio_admin"),
  downloadEventZip
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("super_admin", "studio_admin"),
  deleteEvent
);

module.exports = router;