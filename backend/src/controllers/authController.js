const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const generateToken = require("../utils/generateToken");

exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email dhe password janë të detyrueshme."
      });
    }

    const existingAdmin = await pool.query(
      "SELECT * FROM admins WHERE email = $1",
      [email]
    );

    if (existingAdmin.rows.length > 0) {
      return res.status(400).json({
        message: "Ky email ekziston tashmë."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO admins (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name, email, hashedPassword]
    );

    const admin = result.rows[0];

    const token = generateToken({
      id: admin.id,
      email: admin.email,
      role: "admin"
    });

    res.status(201).json({
      message: "Admin u krijua me sukses.",
      admin,
      token
    });
  } catch (error) {
    res.status(500).json({
      message: "Gabim në register admin.",
      error: error.message
    });
  }
};

exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email dhe password janë të detyrueshme."
      });
    }

    const result = await pool.query(
      "SELECT * FROM admins WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Admin nuk u gjet."
      });
    }

    const admin = result.rows[0];

    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Password i pasaktë."
      });
    }

    const token = generateToken({
      id: admin.id,
      email: admin.email,
      role: "admin"
    });

    res.json({
      message: "Login me sukses.",
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email
      },
      token
    });
  } catch (error) {
    res.status(500).json({
      message: "Gabim në login admin.",
      error: error.message
    });
  }
};