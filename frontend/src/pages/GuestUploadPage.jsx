import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import "../styles/guest-upload.css";

const API_URL = import.meta.env.VITE_API_URL;

function normalizePhotos(items = []) {
  return items
    .filter(Boolean)
    .map((item, index) => ({
      id: item.id || `${item.file_url || item.thumbnail_url || "photo"}-${index}`,
      title: item.title || "Foto e ngarkuar",
      file_url: item.file_url || item.thumbnail_url || "",
      thumbnail_url: item.thumbnail_url || item.file_url || ""
    }))
    .filter((item) => item.file_url || item.thumbnail_url);
}

function GuestUploadPage() {
  const { slug } = useParams();
  const fileInputRef = useRef(null);

  const [section, setSection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [albumId, setAlbumId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchAlbumPhotos = async (targetAlbumId) => {
    if (!targetAlbumId) {
      setUploadedPhotos([]);
      return;
    }

    try {
      setLoadingPhotos(true);

      const response = await fetch(
        `${API_URL}/api/public/album/${targetAlbumId}/media?page=1&limit=24`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Gabim gjatë marrjes së fotove.");
      }

      setUploadedPhotos(normalizePhotos(data.media || []));
    } catch (err) {
      console.error("Gabim gjatë marrjes së fotove të albumit:", err);
      setUploadedPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const fetchSectionAndPhotos = async () => {
      try {
        setLoading(true);
        setError("");

        const sectionResponse = await fetch(
          `${API_URL}/api/public/guest-section/${slug}`
        );
        const sectionData = await sectionResponse.json();

        if (!sectionResponse.ok) {
          throw new Error(
            sectionData.message || "Gabim gjatë marrjes së section."
          );
        }

        if (ignore) return;

        const currentSection = sectionData.section;
        setSection(currentSection);

        const targetAlbumId = currentSection?.album_id || null;
        setAlbumId(targetAlbumId);

        if (targetAlbumId) {
          await fetchAlbumPhotos(targetAlbumId);
        } else {
          setUploadedPhotos([]);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Gabim.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchSectionAndPhotos();

    return () => {
      ignore = true;
    };
  }, [slug]);

  const uploadStats = useMemo(() => {
    if (!section) return null;

    const current = Number(section.uploaded_photos_count || 0);
    const max = Number(section.max_upload_photos || 50);
    const remaining = Math.max(0, max - current);

    return { current, max, remaining };
  }, [section]);

  const previewFiles = useMemo(() => {
    return files.map((file) => ({
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      url: URL.createObjectURL(file)
    }));
  }, [files]);

  useEffect(() => {
    return () => {
      previewFiles.forEach((file) => URL.revokeObjectURL(file.url));
    };
  }, [previewFiles]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);

    const imageOnly = selectedFiles.filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageOnly.length !== selectedFiles.length) {
      setError("Lejohen vetëm foto.");
    } else {
      setError("");
    }

    if (uploadStats) {
      if (uploadStats.remaining <= 0) {
        setError("Limiti i fotove është arritur.");
        setFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      if (imageOnly.length > uploadStats.remaining) {
        setError(`Mund të zgjedhësh vetëm edhe ${uploadStats.remaining} foto.`);
        setFiles(imageOnly.slice(0, uploadStats.remaining));
        setMessage("");
        return;
      }
    }

    setFiles(imageOnly);
    setMessage("");
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!files.length) {
      setError("Zgjedh të paktën një foto.");
      return;
    }

    if (uploadStats && uploadStats.remaining <= 0) {
      setError("Limiti i fotove është arritur.");
      return;
    }

    if (uploadStats && files.length > uploadStats.remaining) {
      setError(`Mund të ngarkosh vetëm edhe ${uploadStats.remaining} foto.`);
      return;
    }

    try {
      setUploading(true);
      setError("");
      setMessage("");

      const selectedCount = files.length;
      const formData = new FormData();

      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(`${API_URL}/api/public/guest-upload/${slug}`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Gabim gjatë upload-it.");
      }

      setMessage(data.message || "Fotot u ngarkuan me sukses.");

      const targetAlbumId = data.album_id || albumId || section?.album_id || null;

      if (targetAlbumId) {
        setAlbumId(targetAlbumId);
        await fetchAlbumPhotos(targetAlbumId);
      } else if (Array.isArray(data.media) && data.media.length > 0) {
        setUploadedPhotos(normalizePhotos(data.media));
      }

      setSection((prev) => ({
        ...prev,
        uploaded_photos_count:
          data.uploaded_photos_count ??
          Number(prev?.uploaded_photos_count || 0) + selectedCount
      }));

      setFiles([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err.message || "Gabim gjatë upload-it.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="guest-upload-page">
        <div className="guest-upload-card">Duke u ngarkuar...</div>
      </div>
    );
  }

  if (error && !section) {
    return (
      <div className="guest-upload-page">
        <div className="guest-upload-card guest-error-card">{error}</div>
      </div>
    );
  }

  return (
    <div className="guest-upload-page">
      <div className="guest-upload-overlay" />

      <div className="guest-upload-card">
        <div className="guest-top-design">
          <div className="guest-top-badge">Luxury Wedding Upload</div>

          <div className="guest-event-meta">
            <p className="guest-event-label">{section?.event_title}</p>
            <h1>{section?.title || "Guest Upload"}</h1>
            {section?.description ? <p>{section.description}</p> : null}

            {uploadStats && (
              <>
                <div className="guest-upload-limit">
                  <strong>
                    {uploadStats.current} / {uploadStats.max}
                  </strong>{" "}
                  foto të ngarkuara
                </div>

                {uploadStats.remaining > 0 ? (
                  <div className="guest-upload-remaining">
                    Mund të ngarkohen edhe {uploadStats.remaining} foto
                  </div>
                ) : (
                  <div className="guest-upload-remaining guest-upload-limit-full">
                    Limiti i fotove është arritur
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <form className="guest-upload-form" onSubmit={handleUpload}>
          <label className="guest-file-label">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              disabled={uploading || uploadStats?.remaining === 0}
            />
            <span>
              {uploadStats?.remaining === 0 ? "Limiti u arrit" : "Zgjedh foto"}
            </span>
          </label>

          {files.length > 0 ? (
            <div className="guest-file-count">
              {files.length} foto të zgjedhura
            </div>
          ) : null}

          {previewFiles.length > 0 ? (
            <div className="guest-preview-grid">
              {previewFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="guest-preview-card">
                  <img src={file.url} alt={file.name} />
                  <div className="guest-preview-meta">
                    <strong>{file.name}</strong>
                    <span>{file.size}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {loadingPhotos ? (
            <div className="guest-file-count">Duke marrë fotot e ngarkuara...</div>
          ) : null}

          {uploadedPhotos.length > 0 ? (
            <div className="guest-uploaded-section">
              <div className="guest-uploaded-title">Fotot e ngarkuara këtu</div>

              <div className="guest-preview-grid">
                {uploadedPhotos.map((photo, index) => (
                  <div
                    key={photo.id || `${photo.file_url}-${index}`}
                    className="guest-preview-card"
                  >
                    <img
                      src={photo.file_url}
                      alt={photo.title || "Uploaded photo"}
                      onError={(e) => {
                        if (
                          photo.thumbnail_url &&
                          e.currentTarget.src !== photo.thumbnail_url
                        ) {
                          e.currentTarget.src = photo.thumbnail_url;
                        }
                      }}
                    />
                    <div className="guest-preview-meta">
                      <strong>{photo.title || "Foto e ngarkuar"}</strong>
                      <span>U shtua me sukses</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <div className="guest-alert guest-alert-error">{error}</div> : null}
          {message ? <div className="guest-alert guest-alert-success">{message}</div> : null}

          <button
            type="submit"
            className="guest-upload-button"
            disabled={uploading || uploadStats?.remaining === 0}
          >
            {uploadStats?.remaining === 0
              ? "Limiti u arrit"
              : uploading
              ? "Duke u ngarkuar..."
              : "Ngarko fotot"}
          </button>
        </form>

        <div className="guest-footer">
  <div className="guest-footer-content">
    
    <a
      href="https://www.instagram.com/dasmagallery.photo?igsh=b2N0bGM1dmsxeHl4&utm_source=qr"
      target="_blank"
      rel="noopener noreferrer"
      className="guest-footer-item guest-footer-link"
    >
      <span className="guest-footer-label">Powered by</span>
      <img
        src="https://res.cloudinary.com/dmlszpk5l/image/upload/v1774112182/DASMA_GALERY.photo_kzsx8m.jpg"
        alt="DasmaGallery"
      />
    </a>

    <div className="guest-footer-divider" />

    <a
      href="https://www.instagram.com/dreamweddings.ks?igsh=eHdkZ3BlMnd0bTBz"
      target="_blank"
      rel="noopener noreferrer"
      className="guest-footer-item guest-footer-link"
    >
      <span className="guest-footer-label">Partner</span>
      <img
        src="https://res.cloudinary.com/dmlszpk5l/image/upload/v1774112264/logo_dream_wedings_ebnfj2.jpg"
        alt="Dream Weddings"
      />
    </a>

  </div>
</div>
      </div>
    </div>
  );
}

export default GuestUploadPage;