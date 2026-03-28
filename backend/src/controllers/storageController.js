const pool = require("../config/db");

exports.getStorageUsage = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: "tenantId mungon."
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        COALESCE(storage_used_bytes, 0) AS storage_used_bytes
      FROM tenants
      WHERE id = $1
      LIMIT 1
      `,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Tenant nuk u gjet."
      });
    }

    const tenant = result.rows[0];

    const usedBytes = Number(tenant.storage_used_bytes || 0);
    const usedMB = usedBytes / (1024 * 1024);
    const usedGB = usedBytes / (1024 * 1024 * 1024);

    let status = "ok";

    if (usedGB > 200) status = "critical";   // mundesh me ndryshu limitin
    else if (usedGB > 150) status = "warning";

    return res.json({
      provider: "wasabi",
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      usedMB: Number(usedMB.toFixed(2)),
      usedGB: Number(usedGB.toFixed(2)),
      status
    });
  } catch (error) {
    console.error("getStorageUsage error:", error);

    return res.status(500).json({
      message: "Gabim në marrjen e storage usage.",
      error: error.message
    });
  }
};