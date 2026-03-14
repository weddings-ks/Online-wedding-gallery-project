const express = require("express");
const router = express.Router();
const {
  registerAdmin,
  loginAdmin
} = require("../controllers/authController");

router.post("/register-admin", registerAdmin);
router.post("/login-admin", loginAdmin);

module.exports = router;