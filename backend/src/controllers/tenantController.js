const pool = require("../config/db");
const {
  uploadBufferToSpaces,
  deleteObjectFromSpaces
} = require("../config/spaces");

function sanitizeFileName(name = "file") {
  return name
    .toString()
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase();
}

async function uploadTenantLogoToWasabi({ file, tenantId }) {
  const safeName = sanitizeFileName(
    file.originalname?.replace(/\.[^/.]+$/, "") || "logo"
  );
  const ext = (file.originalname?.split(".").pop() || "png").toLowerCase();

  const objectKey = `wedding-gallery/tenant-${tenantId}/branding/${Date.now()}-${safeName}.${ext}`;

  const uploaded = await uploadBufferToSpaces({
    buffer: file.buffer,
    key: objectKey,
    mimetype: file.mimetype
  });

  return {
    url: uploaded.url,
    key: uploaded.key,
    bytes: Number(file.size || 0)
  };
}

exports.getMyTenantSettings = async (req, res) => {
  try {
    const tenantId =
      req.user.role === "super_admin"
        ? req.query.tenant_id || null
        : req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: "tenant_id mungon."
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        slug,
        logo_url,
        logo_public_id,
        primary_color,
        secondary_color,
        accent_color,
        footer_text,
        contact_email,
        contact_phone,
        contact_instagram,
        contact_facebook,
        website_url,
        COALESCE(storage_used_bytes, 0) AS storage_used_bytes,
        created_at
      FROM tenants
      WHERE id = $1
      LIMIT 1
      `,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Studio nuk u gjet."
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("GET TENANT SETTINGS ERROR:", error);
    res.status(500).json({
      message: "Gabim në marrjen e tenant settings.",
      error: error.message
    });
  }
};

exports.updateMyTenantSettings = async (req, res) => {
  try {
    const tenantId =
      req.user.role === "super_admin"
        ? req.body.tenant_id || null
        : req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: "tenant_id mungon."
      });
    }

    const {
      name,
      primary_color,
      secondary_color,
      accent_color,
      footer_text,
      contact_email,
      contact_phone,
      contact_instagram,
      contact_facebook,
      website_url
    } = req.body;

    const tenantCheck = await pool.query(
      `SELECT * FROM tenants WHERE id = $1 LIMIT 1`,
      [tenantId]
    );

    if (tenantCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Studio nuk u gjet."
      });
    }

    const currentTenant = tenantCheck.rows[0];

    let logoUrl = currentTenant.logo_url || null;
    let logoPublicId = currentTenant.logo_public_id || null;
    let logoSizeBytes = Number(currentTenant.logo_size_bytes || 0);

    if (req.file) {
      const oldLogoSize = Number(currentTenant.logo_size_bytes || 0);

      if (currentTenant.logo_public_id) {
        try {
          await deleteObjectFromSpaces(currentTenant.logo_public_id);
        } catch (deleteError) {
          console.error(
            "Gabim në fshirjen e logos së vjetër nga Wasabi:",
            deleteError.message
          );
        }
      }

      const uploaded = await uploadTenantLogoToWasabi({
        file: req.file,
        tenantId
      });

      logoUrl = uploaded.url;
      logoPublicId = uploaded.key;
      logoSizeBytes = uploaded.bytes;

      const diffBytes = Number(logoSizeBytes || 0) - oldLogoSize;

      if (diffBytes !== 0) {
        await pool.query(
          `
          UPDATE tenants
          SET storage_used_bytes = GREATEST(COALESCE(storage_used_bytes, 0) + $1, 0)
          WHERE id = $2
          `,
          [diffBytes, tenantId]
        );
      }
    }

    const result = await pool.query(
      `
      UPDATE tenants
      SET
        name = COALESCE($2, name),
        logo_url = $3,
        logo_public_id = $4,
        logo_size_bytes = $5,
        primary_color = COALESCE($6, primary_color),
        secondary_color = COALESCE($7, secondary_color),
        accent_color = COALESCE($8, accent_color),
        footer_text = COALESCE($9, footer_text),
        contact_email = COALESCE($10, contact_email),
        contact_phone = COALESCE($11, contact_phone),
        contact_instagram = COALESCE($12, contact_instagram),
        contact_facebook = COALESCE($13, contact_facebook),
        website_url = COALESCE($14, website_url),
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        name,
        slug,
        logo_url,
        logo_public_id,
        logo_size_bytes,
        primary_color,
        secondary_color,
        accent_color,
        footer_text,
        contact_email,
        contact_phone,
        contact_instagram,
        contact_facebook,
        website_url,
        COALESCE(storage_used_bytes, 0) AS storage_used_bytes,
        created_at
      `,
      [
        tenantId,
        name || null,
        logoUrl,
        logoPublicId,
        logoSizeBytes,
        primary_color || null,
        secondary_color || null,
        accent_color || null,
        footer_text || null,
        contact_email || null,
        contact_phone || null,
        contact_instagram || null,
        contact_facebook || null,
        website_url || null
      ]
    );

    res.json({
      message: "Tenant settings u përditësuan me sukses.",
      tenant: result.rows[0]
    });
  } catch (error) {
    console.error("UPDATE TENANT SETTINGS ERROR:", error);
    res.status(500).json({
      message: "Gabim në përditësimin e tenant settings.",
      error: error.message
    });
  }
};

exports.getTenantStorageStats = async (req, res) => {
  try {
    const tenantId =
      req.user.role === "super_admin"
        ? req.query.tenant_id || null
        : req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: "tenant_id mungon."
      });
    }

    const tenantResult = await pool.query(
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

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        message: "Studio nuk u gjet."
      });
    }

    const tenant = tenantResult.rows[0];

    const usedBytes = Number(tenant.storage_used_bytes || 0);
    const usedMB = +(usedBytes / (1024 * 1024)).toFixed(2);
    const usedGB = +(usedBytes / (1024 * 1024 * 1024)).toFixed(2);

    const WARNING_LIMIT_GB = 900;
    const DISPLAY_LIMIT_GB = 1000;

    const warningLimitBytes = WARNING_LIMIT_GB * 1024 * 1024 * 1024;
    const displayLimitBytes = DISPLAY_LIMIT_GB * 1024 * 1024 * 1024;

    const percentUsed =
      displayLimitBytes > 0
        ? +((usedBytes / displayLimitBytes) * 100).toFixed(2)
        : 0;

    let status = "ok";
    let message = "Storage është në gjendje të mirë.";

    if (usedBytes >= warningLimitBytes) {
      status = "warning";
      message = "Storage po afrohet te 1TB. Kontrollo përdorimin.";
    }

    return res.json({
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      storage: {
        used_bytes: usedBytes,
        used_mb: usedMB,
        used_gb: usedGB,
        soft_limit_gb: WARNING_LIMIT_GB,
        hard_limit_gb: DISPLAY_LIMIT_GB,
        percent_used: percentUsed,
        provider: "wasabi",
        status,
        message,
        should_upgrade: usedBytes >= warningLimitBytes
      }
    });
  } catch (error) {
    console.error("GET TENANT STORAGE STATS ERROR:", error);
    return res.status(500).json({
      message: "Gabim në marrjen e storage stats.",
      error: error.message
    });
  }
};