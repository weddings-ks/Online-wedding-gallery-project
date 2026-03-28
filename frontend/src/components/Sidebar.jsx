function Sidebar({ activePage, setActivePage }) {
  const menuItems = [
    { key: "dashboard", label: "Dashboard" },
    { key: "events", label: "Events" },
    { key: "albums", label: "Albums" },
    { key: "upload", label: "Upload Media" },
    { key: "tenant-settings", label: "Tenant Settings" }
  ];

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-brand">
        <h1>Wedding Admin</h1>
        <p>Këtu menaxhon evente, albume, media dhe branding-un e studios.</p>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-link ${activePage === item.key ? "active" : ""}`}
            onClick={() => setActivePage(item.key)}
          >
            <span className="sidebar-link-text">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;