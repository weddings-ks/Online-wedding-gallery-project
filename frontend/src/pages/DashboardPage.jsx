import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function DashboardPage({ events = [], albumsByEvent = [], uploadAlbums = [] }) {
  const [storageStats, setStorageStats] = useState(null);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [storageError, setStorageError] = useState("");

  const token = useMemo(() => localStorage.getItem("token"), []);

  const stats = useMemo(
    () => [
      {
        id: 1,
        value: Array.isArray(events) ? events.length : 0,
        label: "Evente totale"
      },
      {
        id: 2,
        value: Array.isArray(albumsByEvent) ? albumsByEvent.length : 0,
        label: "Albume për eventin e zgjedhur"
      },
      {
        id: 3,
        value: Array.isArray(uploadAlbums) ? uploadAlbums.length : 0,
        label: "Albume të gatshme për upload"
      }
    ],
    [events, albumsByEvent, uploadAlbums]
  );

  const fetchStorageStats = useCallback(
    async (signal) => {
      if (!token) return;

      try {
        setLoadingStorage(true);
        setStorageError("");

        const res = await fetch(`${API_BASE}/api/tenants/storage-stats`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          },
          signal
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data?.message || "Gabim gjatë marrjes së storage stats."
          );
        }

        setStorageStats(data?.storage || null);
      } catch (error) {
        if (error.name === "AbortError") return;

        console.error("Storage error:", error.message);
        setStorageError(
          error.message || "Nuk u morën statistikat e storage."
        );
        setStorageStats(null);
      } finally {
        if (!signal?.aborted) {
          setLoadingStorage(false);
        }
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();
    fetchStorageStats(controller.signal);

    return () => controller.abort();
  }, [token, fetchStorageStats]);

  const storageMeta = useMemo(() => {
    const storagePercent = Number(storageStats?.percent_used || 0);
    const usedGB = Number(storageStats?.used_gb || 0);
    const usedMB = Number(storageStats?.used_mb || 0);

    const limitGB = Number(storageStats?.hard_limit_gb || 1000);
    const limitMB = limitGB * 1024;

    const provider = storageStats?.provider || "wasabi";
    const backendStatus = storageStats?.status || "ok";
    const backendMessage =
      storageStats?.message || "Storage është në gjendje të mirë.";

    return {
      storagePercent,
      usedMB,
      usedGB,
      limitMB,
      limitGB,
      provider,
      backendStatus,
      backendMessage
    };
  }, [storageStats]);

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

        <div className="stat-card storage-card">
          <div className="stat-glow" />

          <h3>
            {loadingStorage
              ? "..."
              : storageStats
              ? `${storageMeta.usedGB.toFixed(2)} GB`
              : "0.00 GB"}
          </h3>

          <p>Storage Used</p>

          {loadingStorage && <small>Duke ngarkuar storage stats...</small>}

          {!loadingStorage && storageError && (
            <small className="storage-error">{storageError}</small>
          )}

          {!loadingStorage && !storageError && storageStats && (
            <>
              <small>
                {storageMeta.usedGB.toFixed(2)} /{" "}
                {storageMeta.limitGB.toFixed(2)} GB
              </small>

              <div className="storage-bar">
                <div
                  className={`storage-fill storage-${storageMeta.backendStatus}`}
                  style={{
                    width: `${Math.min(storageMeta.storagePercent, 100)}%`
                  }}
                />
              </div>

              <small>
                Provider: <strong>{storageMeta.provider}</strong>
              </small>

              <small>
                Përdorimi:{" "}
                <strong>{storageMeta.storagePercent.toFixed(2)}%</strong>
              </small>

              <small
                className={`storage-status storage-status-${storageMeta.backendStatus}`}
              >
                {storageMeta.backendMessage}
              </small>
            </>
          )}
        </div>
      </div>

      <div className="guest-footer dashboard-footer">
        <a
          href="https://www.instagram.com/dasmagallery.photo"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-brand-card"
        >
          <div className="footer-brand-label">Powered by</div>

          <div className="footer-logo-wrap">
            <img
              src="https://res.cloudinary.com/dmlszpk5l/image/upload/v1774117513/Untitled-1_cnunj3.png"
              alt="DasmaGallery"
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className="footer-brand-name">dasmagallery.photo</div>

          <p className="footer-description">
            Platformë moderne për galeri dasmash ku klientët dhe të ftuarit
            mund të ruajnë, shpërndajnë dhe shkarkojnë fotot dhe videot në një
            vend të vetëm.
          </p>
        </a>
      </div>
    </div>
  );
}

export default DashboardPage;