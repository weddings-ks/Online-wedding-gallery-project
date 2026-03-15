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

const allowedOrigins = [
  "http://localhost:5173",
  "https://dreamweddingsgallery.netlify.app",
  "https://dreamweddingsgalery.netlify.app"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
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