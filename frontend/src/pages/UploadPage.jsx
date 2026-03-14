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
}) {
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
          disabled={!uploadForm.event_id || loadingUploadAlbums}
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
        />

        <input
          id="media-file-input"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
          required
        />

        {uploadForm.files.length > 0 && (
          <div className="selected-files-info">
            U zgjodhën {uploadForm.files.length} file.
          </div>
        )}

        <button type="submit">Ngarko Media</button>
      </form>

      {uploadSuccess && <div className="success-box">{uploadSuccess}</div>}
      {uploadError && <div className="error-box">{uploadError}</div>}

      {uploadForm.album_id && (
        <div className="media-list-section">
          <div className="media-list-header">
            <h3>Media e albumit</h3>

            {uploadMediaList.length > 0 && (
              <button
                type="button"
                className="delete-all-btn"
                onClick={() => handleDeleteAllMedia(uploadForm.album_id)}
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
            <div className="media-grid">
              {uploadMediaList.map((item) => (
                <div key={item.id} className="media-card">
                  <div className="media-preview">
                    {item.type === "video" ? (
                      <video
                        src={item.file_url}
                        controls
                        width="100%"
                        className="media-thumb"
                      />
                    ) : (
                      <img
                        src={item.thumbnail_url || item.file_url}
                        alt={item.title || "media"}
                        className="media-thumb"
                      />
                    )}
                  </div>

                  <div className="media-card-body">
                    <p className="media-title">
                      {item.title || `${item.type === "video" ? "Video" : "Foto"} #${item.id}`}
                    </p>

                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => handleDeleteMedia(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default UploadPage;