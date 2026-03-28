import { useEffect, useState } from "react";
import "../styles/forms.css";

const API_URL = import.meta.env.VITE_API_URL;

export default function TenantSettingsPage() {
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#17171b");
  const [secondaryColor, setSecondaryColor] = useState("#ffffff");
  const [accentColor, setAccentColor] = useState("#c9a227");
  const [footerText, setFooterText] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactInstagram, setContactInstagram] = useState("");
  const [contactFacebook, setContactFacebook] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState(null);

  useEffect(() => {
    const fetchTenantSettings = async () => {
      try {
        setLoading(true);
        setError("");
        setMessage("");

        const res = await fetch(`${API_URL}/api/tenants/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Gabim në marrjen e settings.");
        }

        setName(data.name || "");
        setPrimaryColor(data.primary_color || "#17171b");
        setSecondaryColor(data.secondary_color || "#ffffff");
        setAccentColor(data.accent_color || "#c9a227");
        setFooterText(data.footer_text || "");
        setContactEmail(data.contact_email || "");
        setContactPhone(data.contact_phone || "");
        setContactInstagram(data.contact_instagram || "");
        setContactFacebook(data.contact_facebook || "");
        setWebsiteUrl(data.website_url || "");
        setLogoUrl(data.logo_url || "");
      } catch (err) {
        setError(err.message || "Gabim në ngarkim.");
      } finally {
        setLoading(false);
      }
    };

    fetchTenantSettings();
  }, [token]);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoFile(file);
    setLogoUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const formData = new FormData();
      formData.append("name", name);
      formData.append("primary_color", primaryColor);
      formData.append("secondary_color", secondaryColor);
      formData.append("accent_color", accentColor);
      formData.append("footer_text", footerText);
      formData.append("contact_email", contactEmail);
      formData.append("contact_phone", contactPhone);
      formData.append("contact_instagram", contactInstagram);
      formData.append("contact_facebook", contactFacebook);
      formData.append("website_url", websiteUrl);

      if (logoFile) {
        formData.append("logo", logoFile);
      }

      const res = await fetch(`${API_URL}/api/tenants/me`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Gabim në ruajtjen e settings.");
      }

      setMessage("Tenant settings u ruajtën me sukses.");
      setLogoFile(null);

      if (data?.tenant?.logo_url) {
        setLogoUrl(data.tenant.logo_url);
      }
    } catch (err) {
      setError(err.message || "Gabim në ruajtje.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <h2>Tenant Branding Settings</h2>
        <div className="section-box">Duke u ngarkuar...</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <h2>Tenant Branding Settings</h2>
      <p style={{ color: "#a1a1aa", marginTop: "-8px", marginBottom: "24px" }}>
        Logo, ngjyrat, footer dhe kontaktet e studios.
      </p>

      <form className="admin-form" onSubmit={handleSubmit}>
        <div>
          <label>Studio Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Emri i studios"
          />
        </div>

        <div>
          <label>Logo</label>
          <input type="file" accept="image/*" onChange={handleLogoChange} />
          {logoUrl && (
            <div style={{ marginTop: "14px" }}>
              <img
                src={logoUrl}
                alt="Studio Logo"
                style={{
                  width: "90px",
                  height: "90px",
                  objectFit: "cover",
                  borderRadius: "50%",
                  border: "1px solid #2a2a2a"
                }}
              />
            </div>
          )}
        </div>

        <div className="color-grid">
          <div>
            <label>Primary Color</label>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
            />
          </div>

          <div>
            <label>Secondary Color</label>
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
            />
          </div>

          <div>
            <label>Accent Color</label>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label>Footer Text</label>
          <textarea
            rows="4"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder="Përshkrim i studios ose tekst për footer"
          />
        </div>

        <div>
          <label>Contact Email</label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </div>

        <div>
          <label>Contact Phone</label>
          <input
            type="text"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+383..."
          />
        </div>

        <div>
          <label>Instagram</label>
          <input
            type="text"
            value={contactInstagram}
            onChange={(e) => setContactInstagram(e.target.value)}
            placeholder="@studio ose link"
          />
        </div>

        <div>
          <label>Facebook</label>
          <input
            type="text"
            value={contactFacebook}
            onChange={(e) => setContactFacebook(e.target.value)}
            placeholder="Facebook page ose link"
          />
        </div>

        <div>
          <label>Website</label>
          <input
            type="text"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        {message && <div className="success-box">{message}</div>}
        {error && <div className="error-box">{error}</div>}

        <button type="submit" disabled={saving}>
          {saving ? "Duke ruajtur..." : "Ruaj Settings"}
        </button>
      </form>

      <div className="section-box" style={{ marginTop: "30px" }}>
        <h3 style={{ marginTop: 0 }}>Preview</h3>

        <div
          style={{
            background: primaryColor,
            color: secondaryColor,
            border: "1px solid #2a2a2a",
            padding: "24px",
            borderRadius: "18px"
          }}
        >
          {logoUrl && (
            <img
              src={logoUrl}
              alt={name || "Logo"}
              style={{
                width: "72px",
                height: "72px",
                objectFit: "cover",
                borderRadius: "50%",
                marginBottom: "14px"
              }}
            />
          )}

          <h3 style={{ margin: "0 0 10px" }}>{name || "Studio Name"}</h3>
          <p style={{ margin: "0 0 14px", opacity: 0.85 }}>
            {footerText || "Teksti i footer-it do shfaqet këtu."}
          </p>

          <button
            type="button"
            style={{
              background: accentColor,
              color: "#fff",
              border: "none",
              padding: "12px 18px",
              borderRadius: "999px",
              fontWeight: "700",
              cursor: "pointer"
            }}
          >
            Preview Button
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: "22px",
          textAlign: "center",
          color: "#70707a",
          fontSize: "12px",
          letterSpacing: "0.08em",
          textTransform: "uppercase"
        }}
      >
        Powered by Bardh Dajaku
      </div>
    </div>
  );
}