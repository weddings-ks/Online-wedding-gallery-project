const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const {
  createGuestSection,
  getGuestSectionsByEvent,
  updateGuestSection,
  deleteGuestSection
} = require("../controllers/guestSectionController");

router.post(
  "/",
  authMiddleware,
  roleMiddleware("super_admin", "studio_admin"),
  createGuestSection
);

router.get(
  "/event/:eventId",
  authMiddleware,
  roleMiddleware("super_admin", "studio_admin"),
  getGuestSectionsByEvent
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("super_admin", "studio_admin"),
  updateGuestSection
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("super_admin", "studio_admin"),
  deleteGuestSection
);

module.exports = router;