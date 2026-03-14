import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import "../styles/public-gallery.css";

const API_URL = "http://localhost:5000";

export default function PublicGalleryPage() {
  const { slug } = useParams();

  const [gallery, setGallery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);
  const [lightboxVisible, setLightboxVisible] = useState(false);

  const fetchGallery = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_URL}/api/public/gallery/${slug}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Gabim në ngarkimin e galerisë");
      }

      setGallery(data);

      if (data?.albums?.length > 0) {
        setSelectedAlbumId(data.albums[0].id);
      } else {
        setSelectedAlbumId(null);
      }
    } catch (err) {
      setError(err.message || "Gabim në ngarkimin e galerisë");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  const selectedAlbum = useMemo(() => {
    if (!gallery?.albums?.length || !selectedAlbumId) return null;

    return (
      gallery.albums.find(
        (album) => Number(album.id) === Number(selectedAlbumId)
      ) || null
    );
  }, [gallery, selectedAlbumId]);

  const currentMediaList = useMemo(() => {
    return selectedAlbum?.media || [];
  }, [selectedAlbum]);

  const currentMediaIndex = useMemo(() => {
    if (!selectedMedia || !currentMediaList.length) return -1;

    return currentMediaList.findIndex(
      (item) => Number(item.id) === Number(selectedMedia.id)
    );
  }, [selectedMedia, currentMediaList]);

  const openLightbox = (item) => {
    setSelectedMedia(item);
    requestAnimationFrame(() => {
      setLightboxVisible(true);
    });
  };

  const closeLightbox = useCallback(() => {
    setLightboxVisible(false);
    setTimeout(() => {
      setSelectedMedia(null);
    }, 220);
  }, []);

  const showNextMedia = useCallback(() => {
    if (!currentMediaList.length || currentMediaIndex === -1) return;

    const nextIndex =
      currentMediaIndex === currentMediaList.length - 1
        ? 0
        : currentMediaIndex + 1;

    setSelectedMedia(currentMediaList[nextIndex]);
  }, [currentMediaIndex, currentMediaList]);

  const showPrevMedia = useCallback(() => {
    if (!currentMediaList.length || currentMediaIndex === -1) return;

    const prevIndex =
      currentMediaIndex === 0
        ? currentMediaList.length - 1
        : currentMediaIndex - 1;

    setSelectedMedia(currentMediaList[prevIndex]);
  }, [currentMediaIndex, currentMediaList]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedMedia) return;

      if (e.key === "Escape") {
        closeLightbox();
      }

      if (e.key === "ArrowRight") {
        showNextMedia();
      }

      if (e.key === "ArrowLeft") {
        showPrevMedia();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMedia, closeLightbox, showNextMedia, showPrevMedia]);

  const scrollAlbums = (direction) => {
    const container = document.getElementById("albumsSlider");
    if (!container) return;

    container.scrollBy({
      left: direction === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "";

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("sq-AL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="public-gallery-page">
        <div className="section-box">
          <p className="loading-text">Po ngarkohet galeria...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-gallery-page">
        <div className="section-box">
          <p className="error-text">{error}</p>
        </div>
      </div>
    );
  }

  if (!gallery || !gallery.event) {
    return (
      <div className="public-gallery-page">
        <div className="section-box">
          <p className="loading-text">Nuk u gjet galeria.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-gallery-page">
      <section className="hero-section">
        {gallery.event.cover_image ? (
          <div className="hero-image-wrap">
            <img
              src={gallery.event.cover_image}
              alt={gallery.event.title || "Cover"}
              className="hero-image"
              loading="eager"
              decoding="async"
            />
            <div className="hero-overlay" />
          </div>
        ) : (
          <div className="hero-empty">
            <div className="hero-empty-box">
              Nuk ka cover image për këtë event.
            </div>
          </div>
        )}

        <div className="hero-content fade-up">
          <h1>{gallery.event.title || "Event"}</h1>

          {gallery.event.description && <p>{gallery.event.description}</p>}

          {gallery.event.event_date && (
            <span className="event-date">
              Data: {formatDate(gallery.event.event_date)}
            </span>
          )}
        </div>
      </section>

      {!gallery.albums || gallery.albums.length === 0 ? (
        <div className="empty-box section-box">
          Nuk ka albume për këtë event.
        </div>
      ) : (
        <>
          <section className="albums-strip-section fade-up">
            <div className="albums-strip-header">
              <h2>Albumet</h2>
            </div>

            <div className="albums-slider-wrapper">
              <button
                className="slider-btn"
                type="button"
                onClick={() => scrollAlbums("left")}
              >
                ‹
              </button>

              <div className="albums-slider" id="albumsSlider">
  {gallery.albums.map((album) => {
    const isActive = Number(selectedAlbumId) === Number(album.id);

    return (
      <button
        key={album.id}
        type="button"
        className={`album-slide-card text-only-album ${
          isActive ? "active-album" : ""
        }`}
        onClick={() => setSelectedAlbumId(album.id)}
      >
        <div className="album-slide-text-only">
          <h3>{album.title || "Album"}</h3>
          <span>{album.media?.length || 0} media</span>
        </div>
      </button>
    );
  })}
</div>
              <button
                className="slider-btn"
                type="button"
                onClick={() => scrollAlbums("right")}
              >
                ›
              </button>
            </div>
          </section>

          <section className="album-section fade-up">
            {selectedAlbum ? (
              <>
                <div className="album-header">
                  <h2>{selectedAlbum.title || "Album"}</h2>
                  {selectedAlbum.description && (
                    <p>{selectedAlbum.description}</p>
                  )}
                </div>

                {!selectedAlbum.media || selectedAlbum.media.length === 0 ? (
                  <div className="empty-box">Ky album nuk ka media.</div>
                ) : (
                  <div className="masonry-gallery">
                    {selectedAlbum.media.map((item) => (
                      <div key={item.id} className="masonry-item">
                        {item.type === "video" ? (
                          <div
                            className="media-video-wrap"
                            onClick={() => openLightbox(item)}
                          >
                            <video
                              className="media-thumb masonry-thumb"
                              preload="metadata"
                              muted
                              playsInline
                            >
                              <source src={item.file_url} />
                              Shfletuesi yt nuk e mbështet videon.
                            </video>
                            <div className="video-play-badge">▶</div>
                          </div>
                        ) : (
                          <img
                            src={item.thumbnail_url || item.file_url}
                            alt={item.title || "Foto"}
                            className="media-thumb masonry-thumb"
                            loading="lazy"
                            decoding="async"
                            onClick={() => openLightbox(item)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-box">
                Zgjidh një album për të parë fotot.
              </div>
            )}
          </section>
        </>
      )}

      {selectedMedia && (
        <div
          className={`lightbox ${lightboxVisible ? "show" : ""}`}
          onClick={closeLightbox}
        >
          <div
            className={`lightbox-content ${lightboxVisible ? "show" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="lightbox-close"
              onClick={closeLightbox}
            >
              ×
            </button>

            {currentMediaList.length > 1 && (
              <>
                <button
                  type="button"
                  className="lightbox-nav lightbox-prev"
                  onClick={showPrevMedia}
                >
                  ‹
                </button>

                <button
                  type="button"
                  className="lightbox-nav lightbox-next"
                  onClick={showNextMedia}
                >
                  ›
                </button>
              </>
            )}

            {selectedMedia.type === "video" ? (
              <video controls autoPlay className="lightbox-video">
                <source src={selectedMedia.file_url} />
                Shfletuesi yt nuk e mbështet videon.
              </video>
            ) : (
              <img
                src={selectedMedia.file_url}
                alt={selectedMedia.title || "Preview"}
                className="lightbox-image"
              />
            )}

            <div className="lightbox-bottom">
              {selectedMedia.title && (
                <p className="lightbox-caption">{selectedMedia.title}</p>
              )}

              <span className="lightbox-counter">
                {currentMediaIndex >= 0
                  ? `${currentMediaIndex + 1} / ${currentMediaList.length}`
                  : ""}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}