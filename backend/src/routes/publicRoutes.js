const express = require("express");
const router = express.Router();
const { getPublicGallery } = require("../controllers/publicController");

router.get("/gallery/:slug", getPublicGallery);

module.exports = router;