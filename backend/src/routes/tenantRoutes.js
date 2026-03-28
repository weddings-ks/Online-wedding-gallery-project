const express = require("express");
const router = express.Router();

const {
  getMyTenantSettings,
  updateMyTenantSettings,
  getTenantStorageStats
} = require("../controllers/tenantController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

// 🔥 ndrysho këtë
const uploadLogo = require("../middlewares/uploadLogoMiddleware");

router.get(
  "/me",
  authMiddleware,
  roleMiddleware("super_admin", "studio_admin"),
  getMyTenantSettings
);

router.put(
  "/me",
  authMiddleware,
  roleMiddleware("super_admin", "studio_admin"),
  uploadLogo.single("logo"), // 🔥 KJO ESHTE FIX
  updateMyTenantSettings
);

router.get(
  "/storage-stats",
  authMiddleware,
  roleMiddleware("super_admin", "studio_admin"),
  getTenantStorageStats
);

module.exports = router;