const express = require("express");
const router = express.Router();

const { getStorageUsage } = require("../controllers/storageController");

router.get("/usage", getStorageUsage);

module.exports = router;