const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on("connect", async (client) => {
  try {
    await client.query("SET search_path TO public");
  } catch (err) {
    console.error("Gabim ne SET search_path:", err.message);
  }
});

module.exports = pool;