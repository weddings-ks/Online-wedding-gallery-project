import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/public-gallery.css";

const API_URL = import.meta.env.VITE_API_URL;
const MEDIA_PAGE_LIMIT = 24;
const SWIPE_THRESHOLD = 50;
const SLIDESHOW_DELAY = 3000;

function getSafeImage(url) {
  if (!url || typeof url !== "string") return "";
  return url;
}

function SmartImage({
  src,
  alt,
  className = "",
  loading = "lazy",
  decoding = "async",
  fetchPriority,
  onClick,
  onError,
  eager = false
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return null;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} image-fade ${loaded ? "loaded" : ""}`}
      loading={eager ? "eager" : loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      onLoad={() => setLoaded(true)}
      onError={(e) => {
        setFailed(true);
        if (onError) onError(e);
      }}
      onClick={onClick}
    />
  );
}

export default function PublicGalleryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [gallery, setGallery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState("");
  const [scrollY, setScrollY] = useState(0);
  const [slideshowPlaying, setSlideshowPlaying] = useState(false);

  const [galleryPassword, setGalleryPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const [albumMedia, setAlbumMedia] = useState([]);
  const [loadingAlbumMedia, setLoadingAlbumMedia] = useState(false);
  const [loadingMoreAlbumMedia, setLoadingMoreAlbumMedia] = useState(false);
  const [albumMediaPage, setAlbumMediaPage] = useState(1);
  const [albumMediaHasMore, setAlbumMediaHasMore] = useState(false);
  const [albumMediaTotal, setAlbumMediaTotal] = useState(0);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const albumSectionRef = useRef(null);
  const albumsSliderRef = useRef(null);
  const scrollRafRef = useRef(null);
  const closeLightboxTimerRef = useRef(null);
  const swipeTimerRef = useRef(null);
  const slideshowTimerRef = useRef(null);
  const lightboxVideoRef = useRef(null);
  const mountedRef = useRef(true);

  const sessionKey = `gallery_password_${slug}`;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      if (closeLightboxTimerRef.current) clearTimeout(closeLightboxTimerRef.current);
      if (swipeTimerRef.current) clearTimeout(swipeTimerRef.current);
      if (slideshowTimerRef.current) clearTimeout(slideshowTimerRef.current);
    };
  }, []);

  const applyGalleryData = useCallback((data) => {
    if (!mountedRef.current) return;

    setGallery(data);

    if (data?.albums?.length > 0) {
      setSelectedAlbumId((prev) => prev || data.albums[0].id);
    } else {
      setSelectedAlbumId(null);
    }
  }, []);

  const fetchGallery = useCallback(async () => {
    const controller = new AbortController();

    try {
      setLoading(true);
      setError("");
      setPasswordError("");

      const res = await fetch(`${API_URL}/api/public/gallery/${slug}`, {
        signal: controller.signal
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Gabim në ngarkimin e galerisë");
      }

      if (data?.protected) {
        const savedPassword = sessionStorage.getItem(sessionKey);

        if (savedPassword) {
          const verifyRes = await fetch(
            `${API_URL}/api/public/gallery/${slug}/verify-password`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ password: savedPassword }),
              signal: controller.signal
            }
          );

          const verifyData = await verifyRes.json();

          if (verifyRes.ok && verifyData?.success) {
            setGalleryPassword(savedPassword);
            applyGalleryData(verifyData);
            return () => controller.abort();
          }

          sessionStorage.removeItem(sessionKey);
        }
      }

      applyGalleryData(data);
    } catch (err) {
      if (err.name === "AbortError") return;
      if (!mountedRef.current) return;
      setError(err.message || "Gabim në ngarkimin e galerisë");
    } finally {
      if (mountedRef.current) setLoading(false);
    }

    return () => controller.abort();
  }, [slug, sessionKey, applyGalleryData]);

  useEffect(() => {
    let cleanup;

    (async () => {
      cleanup = await fetchGallery();
    })();

    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [fetchGallery]);

  useEffect(() => {
    const onScroll = () => {
      if (scrollRafRef.current) return;

      scrollRafRef.current = window.requestAnimationFrame(() => {
        setScrollY(window.scrollY || 0);
        scrollRafRef.current = null;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedMedia) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedMedia]);

  useEffect(() => {
    const elements = document.querySelectorAll(
      ".scroll-reveal, .masonry-item, .album-cover-top-block, .album-header"
    );

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -60px 0px",
        threshold: 0.08
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [currentMediaKey(selectedAlbumId, albumMediaPage, albumMedia.length)]);

  const handleUnlockGallery = async (e) => {
    e.preventDefault();

    const trimmedPassword = galleryPassword.trim();

    if (!trimmedPassword) {
      setPasswordError("Shkruaje password-in.");
      return;
    }

    try {
      setUnlocking(true);
      setPasswordError("");

      const res = await fetch(
        `${API_URL}/api/public/gallery/${slug}/verify-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            password: trimmedPassword
          })
        }
      );

      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data.message || "Password i pasaktë.");
      }

      sessionStorage.setItem(sessionKey, trimmedPassword);
      applyGalleryData(data);
    } catch (err) {
      setPasswordError(err.message || "Password i pasaktë.");
    } finally {
      if (mountedRef.current) setUnlocking(false);
    }
  };

  const selectedAlbum = useMemo(() => {
    if (!gallery?.albums?.length || !selectedAlbumId) return null;
    return gallery.albums.find((album) => album.id === selectedAlbumId) || null;
  }, [gallery, selectedAlbumId]);

  const guestSections = useMemo(() => {
    if (!gallery?.guest_sections || !Array.isArray(gallery.guest_sections)) {
      return [];
    }

    return [...gallery.guest_sections].sort((a, b) => {
      const sortA = Number(a?.sort_order ?? 0);
      const sortB = Number(b?.sort_order ?? 0);

      if (sortA !== sortB) return sortA - sortB;
      return String(a?.title || "").localeCompare(String(b?.title || ""));
    });
  }, [gallery]);

  const fetchAlbumMedia = useCallback(
    async (albumId, page = 1, append = false) => {
      if (!albumId) {
        setAlbumMedia([]);
        setAlbumMediaPage(1);
        setAlbumMediaHasMore(false);
        setAlbumMediaTotal(0);
        return () => {};
      }

      const controller = new AbortController();

      try {
        if (page === 1 && !append) {
          setLoadingAlbumMedia(true);
        } else {
          setLoadingMoreAlbumMedia(true);
        }

        const savedPassword = sessionStorage.getItem(sessionKey) || "";
        const query = new URLSearchParams({
          page: String(page),
          limit: String(MEDIA_PAGE_LIMIT)
        });

        if (savedPassword) {
          query.set("password", savedPassword);
        }

        const res = await fetch(
          `${API_URL}/api/public/albums/${albumId}/media?${query.toString()}`,
          { signal: controller.signal }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data?.message || "Gabim në marrjen e medias së albumit."
          );
        }

        const mediaList = Array.isArray(data?.media) ? data.media : [];

        if (!mountedRef.current) return () => controller.abort();

        setAlbumMedia((prev) => (append ? [...prev, ...mediaList] : mediaList));
        setAlbumMediaPage(data?.page || page);
        setAlbumMediaHasMore(Boolean(data?.hasMore));
        setAlbumMediaTotal(Number(data?.total || 0));
      } catch (err) {
        if (err.name === "AbortError") return () => controller.abort();

        console.error("fetchAlbumMedia error:", err);

        if (!mountedRef.current) return () => controller.abort();

        setAlbumMedia([]);
        setAlbumMediaPage(1);
        setAlbumMediaHasMore(false);
        setAlbumMediaTotal(0);
      } finally {
        if (mountedRef.current) {
          setLoadingAlbumMedia(false);
          setLoadingMoreAlbumMedia(false);
        }
      }

      return () => controller.abort();
    },
    [sessionKey]
  );

  useEffect(() => {
    let cleanup;

    if (!selectedAlbumId) {
      setAlbumMedia([]);
      setAlbumMediaPage(1);
      setAlbumMediaHasMore(false);
      setAlbumMediaTotal(0);
      setSelectedMedia(null);
      setLightboxVisible(false);
      setSwipeDirection("");
      setSlideshowPlaying(false);
      return;
    }

    setSelectedMedia(null);
    setLightboxVisible(false);
    setSwipeDirection("");
    setSlideshowPlaying(false);

    (async () => {
      cleanup = await fetchAlbumMedia(selectedAlbumId, 1, false);
    })();

    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [selectedAlbumId, fetchAlbumMedia]);

  const currentMediaList = useMemo(() => albumMedia, [albumMedia]);

  const currentMediaIndex = useMemo(() => {
    if (!selectedMedia || !currentMediaList.length) return -1;
    return currentMediaList.findIndex((item) => item.id === selectedMedia.id);
  }, [selectedMedia, currentMediaList]);

  const selectedAlbumCoverImage = useMemo(() => {
    if (!selectedAlbum) return null;
    return getSafeImage(
      selectedAlbum.cover_image_url || selectedAlbum.cover_image || null
    );
  }, [selectedAlbum]);

  const openLightbox = useCallback((item) => {
    setSelectedMedia(item);
    setSwipeDirection("");
    setSlideshowPlaying(false);

    requestAnimationFrame(() => {
      if (mountedRef.current) setLightboxVisible(true);
    });
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxVisible(false);
    setSwipeDirection("");
    setSlideshowPlaying(false);

    if (closeLightboxTimerRef.current) {
      clearTimeout(closeLightboxTimerRef.current);
    }

    if (slideshowTimerRef.current) {
      clearTimeout(slideshowTimerRef.current);
      slideshowTimerRef.current = null;
    }

    closeLightboxTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setSelectedMedia(null);
    }, 220);
  }, []);

  const showNextMedia = useCallback(() => {
    if (!currentMediaList.length) return;

    const safeCurrentIndex = currentMediaIndex >= 0 ? currentMediaIndex : 0;

    const nextIndex =
      safeCurrentIndex >= currentMediaList.length - 1
        ? 0
        : safeCurrentIndex + 1;

    if (swipeTimerRef.current) {
      clearTimeout(swipeTimerRef.current);
    }

    setSwipeDirection("swipe-left");
    setSelectedMedia(currentMediaList[nextIndex]);

    swipeTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setSwipeDirection("");
    }, 260);
  }, [currentMediaIndex, currentMediaList]);

  const showPrevMedia = useCallback(() => {
    if (!currentMediaList.length) return;

    const safeCurrentIndex = currentMediaIndex >= 0 ? currentMediaIndex : 0;

    const prevIndex =
      safeCurrentIndex <= 0
        ? currentMediaList.length - 1
        : safeCurrentIndex - 1;

    if (swipeTimerRef.current) {
      clearTimeout(swipeTimerRef.current);
    }

    setSwipeDirection("swipe-right");
    setSelectedMedia(currentMediaList[prevIndex]);

    swipeTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setSwipeDirection("");
    }, 260);
  }, [currentMediaIndex, currentMediaList]);

  const handleEventSlideshowToggle = useCallback(() => {
    if (!currentMediaList.length) return;

    if (!lightboxVisible || !selectedMedia) {
      setSwipeDirection("");
      setSelectedMedia(currentMediaList[0]);
      setSlideshowPlaying(true);

      requestAnimationFrame(() => {
        if (mountedRef.current) setLightboxVisible(true);
      });
      return;
    }

    setSlideshowPlaying((prev) => !prev);
  }, [currentMediaList, lightboxVisible, selectedMedia]);

  useEffect(() => {
    if (!selectedMedia || !lightboxVisible || !slideshowPlaying) {
      if (slideshowTimerRef.current) {
        clearTimeout(slideshowTimerRef.current);
        slideshowTimerRef.current = null;
      }
      return;
    }

    if (selectedMedia.type === "video") {
      if (slideshowTimerRef.current) {
        clearTimeout(slideshowTimerRef.current);
        slideshowTimerRef.current = null;
      }
      return;
    }

    if (slideshowTimerRef.current) {
      clearTimeout(slideshowTimerRef.current);
    }

    slideshowTimerRef.current = setTimeout(() => {
      showNextMedia();
    }, SLIDESHOW_DELAY);

    return () => {
      if (slideshowTimerRef.current) {
        clearTimeout(slideshowTimerRef.current);
        slideshowTimerRef.current = null;
      }
    };
  }, [
    selectedMedia?.id,
    selectedMedia?.type,
    lightboxVisible,
    slideshowPlaying,
    showNextMedia
  ]);

  const handleLightboxVideoEnded = useCallback(() => {
    if (!slideshowPlaying) return;
    showNextMedia();
  }, [slideshowPlaying, showNextMedia]);

  useEffect(() => {
    if (!selectedMedia || selectedMedia.type !== "video") return;
    if (!lightboxVisible) return;

    const video = lightboxVideoRef.current;
    if (!video) return;

    try {
      video.load();
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    } catch {}
  }, [selectedMedia?.id, selectedMedia?.type, lightboxVisible]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedMedia) return;

      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") showNextMedia();
      if (e.key === "ArrowLeft") showPrevMedia();

      if (e.key === " " && lightboxVisible) {
        e.preventDefault();
        setSlideshowPlaying((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMedia, lightboxVisible, closeLightbox, showNextMedia, showPrevMedia]);

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.changedTouches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e) => {
      touchEndX.current = e.changedTouches[0].clientX;
      const distance = touchStartX.current - touchEndX.current;

      if (Math.abs(distance) < SWIPE_THRESHOLD) return;

      if (distance > 0) showNextMedia();
      else showPrevMedia();
    },
    [showNextMedia, showPrevMedia]
  );

  const scrollAlbums = useCallback((direction) => {
    const container = albumsSliderRef.current;
    if (!container) return;

    container.scrollBy({
      left: direction === "left" ? -300 : 300,
      behavior: "smooth"
    });
  }, []);

  const scrollToAlbumSection = useCallback(() => {
    const section = albumSectionRef.current;
    if (!section) return;

    section.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, []);

  const formatDate = useCallback((dateValue) => {
    if (!dateValue) return "";

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!selectedAlbumId || !albumMediaHasMore || loadingMoreAlbumMedia) return;
    await fetchAlbumMedia(selectedAlbumId, albumMediaPage + 1, true);
  }, [
    selectedAlbumId,
    albumMediaHasMore,
    loadingMoreAlbumMedia,
    fetchAlbumMedia,
    albumMediaPage
  ]);

  const handleDownloadWholeEvent = useCallback(() => {
    if (!slug) return;

    const savedPassword = sessionStorage.getItem(sessionKey) || "";
    const downloadUrl = savedPassword
      ? `${API_URL}/api/public/gallery/${slug}/download?password=${encodeURIComponent(savedPassword)}`
      : `${API_URL}/api/public/gallery/${slug}/download`;

    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }, [slug, sessionKey]);

  const eventCoverOriginal =
    gallery?.event?.cover_image_signed_url ||
    gallery?.event?.cover_image ||
    gallery?.event?.cover_image_url ||
    selectedAlbum?.cover_image_url ||
    selectedAlbum?.cover_image ||
    null;

  const eventCover = useMemo(
    () => getSafeImage(eventCoverOriginal),
    [eventCoverOriginal]
  );

  const branding = useMemo(
    () => ({
      primaryColor: gallery?.event?.primary_color || "#17171b",
      secondaryColor: gallery?.event?.secondary_color || "#ffffff",
      accentColor: gallery?.event?.accent_color || "#c9a227",
      studioName: gallery?.event?.studio_name || "Dream Weddings",
      studioLogo: gallery?.event?.studio_logo_url || "",
      footerText: gallery?.event?.footer_text || "",
      contactEmail: gallery?.event?.contact_email || "",
      contactPhone: gallery?.event?.contact_phone || "",
      contactInstagram: gallery?.event?.contact_instagram || "",
      contactFacebook: gallery?.event?.contact_facebook || "",
      websiteUrl: gallery?.event?.website_url || ""
    }),
    [gallery]
  );

  const pageStyle = useMemo(
    () => ({
      "--brand-primary": branding.primaryColor,
      "--brand-secondary": branding.secondaryColor,
      "--brand-accent": branding.accentColor
    }),
    [branding]
  );

  const heroTextOpacity = Math.max(1 - scrollY / 500, 0);
  const heroTextTranslate = Math.min(scrollY * 0.1, 36);

  if (loading) {
    return (
      <div className="public-gallery-page public-gallery-lux" style={pageStyle}>
        <div className="section-box">
          <p className="loading-text">Po ngarkohet galeria...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-gallery-page public-gallery-lux" style={pageStyle}>
        <div className="section-box">
          <p className="error-text">{error}</p>
        </div>
      </div>
    );
  }

  if (!gallery || !gallery.event) {
    return (
      <div className="public-gallery-page public-gallery-lux" style={pageStyle}>
        <div className="section-box">
          <p className="loading-text">Nuk u gjet galeria.</p>
        </div>
      </div>
    );
  }

  if (gallery.protected) {
    const protectedCoverOriginal =
      gallery?.event?.cover_image_signed_url ||
      gallery?.event?.cover_image ||
      gallery?.event?.cover_image_url ||
      null;

    const protectedCover = getSafeImage(protectedCoverOriginal);

    return (
      <div className="public-gallery-page public-gallery-lux" style={pageStyle}>
        <section className="hero-section hero-section-clean">
          {protectedCover ? (
            <div className="hero-image-wrap">
              <SmartImage
                src={protectedCover}
                alt={gallery.event.title || "Cover"}
                className="hero-image"
                eager
                fetchPriority="high"
              />
              <div className="hero-overlay hero-overlay-soft" />
            </div>
          ) : (
            <div className="hero-empty">
              <div className="hero-empty-box">
                Kjo galeri është e mbrojtur me password.
              </div>
            </div>
          )}

          <div
            className="hero-center-content hero-center-content-clean fade-up"
            style={{
              opacity: heroTextOpacity,
              transform: `translate3d(0, ${heroTextTranslate}px, 0)`,
              willChange: "transform, opacity"
            }}
          >
            <span className="hero-kicker">Private Gallery</span>
            <h1 className="hero-title">{gallery.event.title || "Galeri Private"}</h1>

            {gallery.event.event_date && (
              <p className="hero-date">{formatDate(gallery.event.event_date)}</p>
            )}

            <div className="section-box protected-box protected-box-clean">
              <h3 style={{ marginTop: 0 }}>Hape Galerinë</h3>
              <p className="protected-subtext">
                Shkruani password-in për të parë fotot dhe videot.
              </p>

              <form onSubmit={handleUnlockGallery}>
                <input
                  type="password"
                  value={galleryPassword}
                  onChange={(e) => setGalleryPassword(e.target.value)}
                  placeholder="Shkruaj password-in"
                  className="protected-password-input"
                  autoComplete="current-password"
                />

                {passwordError && (
                  <p className="error-text" style={{ marginTop: 0 }}>
                    {passwordError}
                  </p>
                )}

                <button
                  type="submit"
                  className="hero-button"
                  disabled={unlocking}
                  style={{ width: "100%" }}
                >
                  {unlocking ? "Duke verifikuar..." : "Hape Galerinë"}
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="public-gallery-page public-gallery-lux" style={pageStyle}>
      <section className="hero-section hero-section-clean">
        {eventCover ? (
          <div className="hero-image-wrap">
            <SmartImage
              src={eventCover}
              alt={gallery.event.title || "Cover"}
              className="hero-image"
              eager
              fetchPriority="high"
            />
            <div className="hero-overlay hero-overlay-soft" />
          </div>
        ) : (
          <div className="hero-empty">
            <div className="hero-empty-box">
              Nuk ka cover image për këtë event.
            </div>
          </div>
        )}

        <div
          className="hero-center-content hero-center-content-clean fade-up"
          style={{
            opacity: heroTextOpacity,
            transform: `translate3d(0, ${heroTextTranslate}px, 0)`,
            willChange: "transform, opacity"
          }}
        >
          <span className="hero-kicker">Curated Wedding Story</span>
          <h1 className="hero-title">{gallery.event.title || "Event"}</h1>

          {gallery.event.event_date && (
            <p className="hero-date">{formatDate(gallery.event.event_date)}</p>
          )}

          <div className="hero-actions">
            <button
              type="button"
              className="hero-button"
              onClick={scrollToAlbumSection}
            >
              Shiko Galerinë
            </button>
          </div>
        </div>
      </section>

      {(gallery.albums && gallery.albums.length > 0) || guestSections.length > 0 ? (
        <section className="albums-floating-bar albums-floating-bar-clean">
          <div className="albums-floating-inner">
            <div className="hero-bottom-brand hero-bottom-brand-clean">
              <h3>{gallery.event.title || "Event"}</h3>
              <span>
                {gallery.event.description
                  ? gallery.event.description
                  : branding.studioName}
              </span>
            </div>

            <div className="hero-bottom-nav">
              <button
                className="slider-btn desktop-only"
                type="button"
                onClick={() => scrollAlbums("left")}
              >
                ‹
              </button>

              <div
                className="hero-bottom-albums compact-albums-nav"
                ref={albumsSliderRef}
              >
                {gallery.albums.map((album) => {
                  const isActive = selectedAlbumId === album.id;

                  return (
                    <button
                      key={album.id}
                      type="button"
                      className={`bottom-album-link compact-album-link ${isActive ? "active" : ""}`}
                      onClick={() => {
                        setSelectedAlbumId(album.id);
                        requestAnimationFrame(() => {
                          scrollToAlbumSection();
                        });
                      }}
                    >
                      {album.title || "Album"}
                    </button>
                  );
                })}

                {guestSections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className="bottom-album-link compact-album-link guest-bottom-link"
                    onClick={() => navigate(`/guest-upload/${section.slug}`)}
                  >
                    {section.title || "Fotot nga Dasmorët"}
                  </button>
                ))}
              </div>

              <button
                className="slider-btn desktop-only"
                type="button"
                onClick={() => scrollAlbums("right")}
              >
                ›
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {!gallery.albums || gallery.albums.length === 0 ? (
        <div className="empty-box section-box">Nuk ka albume për këtë event.</div>
      ) : (
        <section
          className="album-section album-section-clean fade-up"
          id="albumSection"
          ref={albumSectionRef}
        >
          {selectedAlbum ? (
            <>
              <div className="album-header album-header-top album-header-clean scroll-reveal">
                <div>
                  <span className="album-kicker">Selected Collection</span>
                  <h2>{selectedAlbum.title || "Album"}</h2>
                  <p className="media-count-text">
                    Totali: {albumMediaTotal || currentMediaList.length || 0} media
                  </p>
                </div>

                <div className="album-actions">
                  <button
                    type="button"
                    className="download-all-btn lightbox-play-toggle event-play-toggle"
                    onClick={handleEventSlideshowToggle}
                  >
                    {lightboxVisible && slideshowPlaying
                      ? "Pause Eventin"
                      : "Play Eventin"}
                  </button>

                  <button
                    type="button"
                    className="download-all-btn secondary-download-btn"
                    onClick={handleDownloadWholeEvent}
                  >
                    Shkarko Eventin
                  </button>
                </div>
              </div>

              {loadingAlbumMedia ? (
                <div className="empty-box">Po ngarkohen mediat...</div>
              ) : (
                <>
                  {selectedAlbumCoverImage && (
                    <div className="album-cover-top-block album-cover-top-block-clean scroll-reveal">
                      <div
                        className="album-cover-hero"
                        style={{ "--album-cover-bg": `url(${selectedAlbumCoverImage})` }}
                      >
                        <SmartImage
                          src={selectedAlbumCoverImage}
                          alt="Album cover"
                          className="album-cover-top-image"
                        />
                      </div>
                    </div>
                  )}

                  {!currentMediaList || currentMediaList.length === 0 ? (
                    !selectedAlbumCoverImage ? (
                      <div className="empty-box">Ky album nuk ka media.</div>
                    ) : null
                  ) : (
                    <>
                      <div className="masonry-gallery premium-masonry-gallery premium-masonry-gallery-tight">
                        {currentMediaList.map((item) => {
                          const thumbSrc = item.file_url;

                          return (
                            <div
                              key={item.id}
                              className={`masonry-item scroll-reveal ${
                                item.type === "video" ? "is-video" : "is-image"
                              }`}
                            >
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
                                    <source src={thumbSrc} />
                                    Shfletuesi yt nuk e mbështet videon.
                                  </video>
                                  <div className="video-play-badge">▶</div>
                                </div>
                              ) : (
                                <SmartImage
                                  src={thumbSrc}
                                  alt={item.title || "Foto"}
                                  className="media-thumb masonry-thumb"
                                  onClick={() => openLightbox(item)}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {albumMediaHasMore && (
                        <div className="load-more-wrap">
                          <button
                            type="button"
                            className="load-more-btn"
                            onClick={handleLoadMore}
                            disabled={loadingMoreAlbumMedia}
                          >
                            {loadingMoreAlbumMedia ? "Duke ngarkuar..." : "Shfaq më shumë"}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="empty-box">Zgjidh një album për të parë fotot.</div>
          )}
        </section>
      )}

      <footer className="public-gallery-footer">
        <div className="public-gallery-footer-inner">
          <div className="public-gallery-footer-brand">
            {branding.studioLogo && (
              <div className="public-gallery-footer-tenant-logo">
                <img
                  src={branding.studioLogo}
                  alt={branding.studioName || "Studio logo"}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            )}

            <h3>{branding.studioName}</h3>
            {branding.footerText && <p>{branding.footerText}</p>}
          </div>

          <div className="public-gallery-footer-contact">
            {branding.contactEmail && <p>Email: {branding.contactEmail}</p>}
            {branding.contactPhone && <p>Tel: {branding.contactPhone}</p>}
            {branding.contactInstagram && <p>Instagram: {branding.contactInstagram}</p>}
            {branding.contactFacebook && <p>Facebook: {branding.contactFacebook}</p>}
            {branding.websiteUrl && <p>Web: {branding.websiteUrl}</p>}
          </div>
        </div>

        <div className="public-gallery-footer-credit">
          <span className="footer-powered-text">Powered by</span>

          <a
            href="https://www.instagram.com/dasmagallery.photo?igsh=b2N0bGM1dmsxeHl4&utm_source=qr"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-powered-logo"
          >
            <img
              src="https://res.cloudinary.com/dmlszpk5l/image/upload/v1774117513/Untitled-1_cnunj3.png"
              alt="DasmaGallery"
              loading="lazy"
              decoding="async"
            />
          </a>
        </div>
      </footer>

      {selectedMedia && (
        <div
          className={`lightbox ${lightboxVisible ? "show" : ""}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLightbox();
          }}
        >
          <div
            className={`lightbox-content ${lightboxVisible ? "show" : ""} ${swipeDirection}`}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
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
              <video
                key={selectedMedia.id}
                ref={lightboxVideoRef}
                controls
                autoPlay
                playsInline
                className="lightbox-video"
                preload="auto"
                onEnded={handleLightboxVideoEnded}
              >
                <source src={selectedMedia.file_url} />
                Shfletuesi yt nuk e mbështet videon.
              </video>
            ) : (
              <img
                key={selectedMedia.id}
                src={selectedMedia.file_url}
                alt={selectedMedia.title || "Preview"}
                className="lightbox-image"
                loading="eager"
                decoding="sync"
                draggable={false}
              />
            )}

            <div className="lightbox-bottom">
              <div className="lightbox-bottom-left">
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
        </div>
      )}
    </div>
  );
}

function currentMediaKey(selectedAlbumId, albumMediaPage, albumMediaLength) {
  return `${selectedAlbumId || "none"}-${albumMediaPage}-${albumMediaLength}`;
}