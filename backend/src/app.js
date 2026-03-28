const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const albumRoutes = require("./routes/albumRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const publicRoutes = require("./routes/publicRoutes");
const guestSectionRoutes = require("./routes/guestSectionRoutes");
const tenantRoutes = require("./routes/tenantRoutes");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://dreamweddingsgallery.netlify.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS nuk lejohet për këtë domain: " + origin));
      }
    },
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
app.use("/api/guest-sections", guestSectionRoutes);
app.use("/api/tenants", tenantRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route nuk ekziston"
  });
});

app.use((err, req, res, next) => {
  console.error("Server Error:", err);

  res.status(500).json({
    message: "Server error",
    error: err.message
  });
});

module.exports = app;