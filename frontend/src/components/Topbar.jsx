function Topbar({ handleLogout }) {
  return (
    <header className="topbar">
      <div className="topbar-content">
        <div>
          <h2>Wedding Gallery Admin</h2>
          <p>Panel profesional për menaxhimin e galerive</p>
        </div>

        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}

export default Topbar;