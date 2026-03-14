function DashboardPage({ events, albumsByEvent, uploadAlbums }) {
  const stats = [
    {
      id: 1,
      value: events.length,
      label: "Evente totale",
    },
    {
      id: 2,
      value: albumsByEvent.length,
      label: "Albume për eventin e zgjedhur",
    },
    {
      id: 3,
      value: uploadAlbums.length,
      label: "Albume të gatshme për upload",
    },
  ];

  return (
    <div className="admin-page">
      <div className="page-heading">
        <h2>Dashboard</h2>
        <p>Këtu sheh përmbledhjen e panelit të kompanisë.</p>
      </div>

      <div className="dashboard-grid">
        {stats.map((item) => (
          <div key={item.id} className="stat-card">
            <div className="stat-glow" />
            <h3>{item.value}</h3>
            <p>{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DashboardPage;