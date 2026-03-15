const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const albumRoutes = require("./routes/albumRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const publicRoutes = require("./routes/publicRoutes");

const app = express();

app.use(
  cors({
    origin: "https://dreamweddingsgallery.netlify.app",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      message: "API dhe PostgreSQL po funksionojnë 🚀",
      time: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/albums", albumRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/public", publicRoutes);

module.exports = app;