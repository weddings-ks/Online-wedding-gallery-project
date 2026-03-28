import { useEffect, useMemo, useState } from "react";

function UploadPage({
  events,
  uploadAlbums,
  loadingUploadAlbums,
  uploadMediaList,
  loadingUploadMedia,
  uploadError,
  uploadSuccess,
  uploadForm,
  handleUploadChange,
  handleFileChange,
  handleUploadMedia,
  handleDeleteMedia,
  handleDeleteAllMedia,
  handleLoadMoreMedia,
  uploadMediaHasMore,
  loadingMoreUploadMedia,
  uploadMediaTotal,
  uploadingMedia,
  uploadProgressText,
  uploadProgressCurrent,
  uploadProgressTotal,
}) {
  const [visibleCount, setVisibleCount] = useState(10);

  const uploadPercent =
    uploadProgressTotal > 0
      ? Math.min(
          100,
          Math.round((uploadProgressCurrent / uploadProgressTotal) * 100)
        )
      : 0;

  useEffect(() => {
    setVisibleCount(10);
  }, [uploadForm.album_id]);

  const visibleMedia = useMemo(() => {
    return uploadMediaList.slice(0, visibleCount);
  }, [uploadMediaList, visibleCount]);

  const handleShowMore = () => {
    if (visibleCount < uploadMediaList.length) {
      setVisibleCount((prev) => prev + 7);
      return;
    }

    if (uploadMediaHasMore) {
      handleLoadMoreMedia();
    }
  };

  const shouldShowMoreButton =
    uploadMediaList.length > visibleCount || uploadMediaHasMore;

  return (
    <div className="admin-page">
      <h2>Upload Media</h2>
      <p>Këtu kompania ngarkon foto dhe video për albumet.</p>

      <form className="admin-form" onSubmit={handleUploadMedia}>
        <select
          name="event_id"
          value={uploadForm.event_id}
          onChange={handleUploadChange}
          required
          disabled={uploadingMedia}
        >
          <option value="">Zgjidh eventin</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title || `Event #${event.id}`}
            </option>
          ))}
        </select>

        <select
          name="album_id"
          value={uploadForm.album_id}
          onChange={handleUploadChange}
          required
          disabled={!uploadForm.event_id || loadingUploadAlbums || uploadingMedia}
        >
          <option value="">
            {loadingUploadAlbums ? "Duke i ngarkuar albumet..." : "Zgjidh albumin"}
          </option>
          {uploadAlbums.map((album) => (
            <option key={album.id} value={album.id}>
              {album.title || `Album #${album.id}`}
            </option>
          ))}
        </select>

        <input
          type="text"
          name="title"
          placeholder="Titulli i medias (opsional)"
          value={uploadForm.title}
          onChange={handleUploadChange}
          disabled={uploadingMedia}
        />

        <input
          id="media-file-input"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
          required
          disabled={uploadingMedia}
        />

        <div className="selected-files-info">
          Maksimumi i lejuar: 500 file për një upload
        </div>

        {uploadForm.files.length > 0 && (
          <div className="selected-files-info">
            U zgjodhën {uploadForm.files.length} file.
          </div>
        )}

        <button type="submit" disabled={uploadingMedia}>
          {uploadingMedia ? "Duke ngarkuar..." : "Ngarko Media"}
        </button>

        {uploadingMedia && (
          <div className="upload-loader-wrap">
            <div className="upload-loader">
              <div className="upload-spinner" />
              <span>
                {uploadProgressText || "Duke ngarkuar mediat, ju lutem prit..."}
              </span>
            </div>

            {uploadProgressTotal > 0 && (
              <div className="upload-progress-box">
                <div className="upload-progress-text">
                  <span>
                    {uploadProgressCurrent}/{uploadProgressTotal} file
                  </span>
                  <span>{uploadPercent}%</span>
                </div>

                <div className="upload-progress-bar">
                  <div
                    className="upload-progress-fill"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </form>

      {uploadSuccess && <div className="success-box">{uploadSuccess}</div>}
      {uploadError && <div className="error-box">{uploadError}</div>}

      {uploadForm.album_id && (
        <div className="media-list-section">
          <div className="media-list-header">
            <div>
              <h3>Media e albumit</h3>
              <p className="media-count-text">
                Totali: {uploadMediaTotal || 0} media
              </p>
            </div>

            {uploadMediaList.length > 0 && (
              <button
                type="button"
                className="delete-all-btn"
                onClick={() => handleDeleteAllMedia(uploadForm.album_id)}
                disabled={uploadingMedia}
              >
                Fshij të gjitha
              </button>
            )}
          </div>

          {loadingUploadMedia ? (
            <p>Duke i ngarkuar mediat...</p>
          ) : uploadMediaList.length === 0 ? (
            <p>Nuk ka media në këtë album ende.</p>
          ) : (
            <>
              <div className="media-grid">
                {visibleMedia.map((item) => (
                  <div key={item.id} className="media-card">
                    <div className="media-preview">
                      {item.type === "video" ? (
                        <video
                          src={item.file_url}
                          controls
                          preload="metadata"
                          width="100%"
                          className="media-thumb"
                        />
                      ) : (
                        <img
                          src={item.thumbnail_url || item.file_url}
                          alt={item.title || "media"}
                          className="media-thumb"
                          loading="lazy"
                        />
                      )}
                    </div>

                    <div className="media-card-body">
                      <p className="media-title">
                        {item.title ||
                          `${item.type === "video" ? "Video" : "Foto"} #${item.id}`}
                      </p>

                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => handleDeleteMedia(item.id)}
                        disabled={uploadingMedia}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {shouldShowMoreButton && (
                <div className="load-more-wrap">
                  <button
                    type="button"
                    className="load-more-btn"
                    onClick={handleShowMore}
                    disabled={loadingMoreUploadMedia || uploadingMedia}
                  >
                    {loadingMoreUploadMedia ? "Duke ngarkuar..." : "Shfaq më shumë"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default UploadPage;