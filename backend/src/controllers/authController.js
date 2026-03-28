const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const generateToken = require("../utils/generateToken");

exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, role, tenant_id } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "name, email, password dhe role janë të detyrueshme."
      });
    }

    if (!["super_admin", "studio_admin"].includes(role)) {
      return res.status(400).json({
        message: "Role duhet të jetë super_admin ose studio_admin."
      });
    }

    if (role === "studio_admin" && !tenant_id) {
      return res.status(400).json({
        message: "tenant_id është i detyrueshëm për studio_admin."
      });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        message: "Ky email ekziston tashmë."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id, tenant_id, name, email, role, status, created_at`,
      [
        role === "super_admin" ? null : tenant_id,
        name,
        email,
        hashedPassword,
        role
      ]
    );

    const user = result.rows[0];

    const token = generateToken(user);

    res.status(201).json({
      message: "User u krijua me sukses.",
      user,
      token
    });
  } catch (error) {
    res.status(500).json({
      message: "Gabim në register.",
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
      `SELECT id, tenant_id, name, email, password_hash, role, status
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "User nuk u gjet."
      });
    }

    const user = result.rows[0];

    if (user.status !== "active") {
      return res.status(403).json({
        message: "Ky account nuk është aktiv."
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Password i pasaktë."
      });
    }

    const token = generateToken(user);

    res.json({
      message: "Login me sukses.",
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      },
      token
    });
  } catch (error) {
    res.status(500).json({
      message: "Gabim në login.",
      error: error.message
    });
  }
};