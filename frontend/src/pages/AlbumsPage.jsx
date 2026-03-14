function AlbumsPage({
  events,
  albumsByEvent,
  loadingAlbums,
  albumError,
  albumSuccess,
  albumForm,
  handleAlbumFormChange,
  handleCreateAlbum,
  fetchAlbumsByEvent,
  handleStartEditAlbum,
  handleUpdateAlbum,
  handleDeleteAlbum,
  handleCancelEditAlbum,
  isEditingAlbum,
}) {
  return (
    <div className="admin-page">
      <h2>Albums</h2>
      <p>Këtu krijohen, editohen dhe fshihen albumet për çdo event.</p>

      <form
        className="admin-form"
        onSubmit={isEditingAlbum ? handleUpdateAlbum : handleCreateAlbum}
      >
        <select
          name="event_id"
          value={albumForm.event_id}
          onChange={handleAlbumFormChange}
          required
          disabled={isEditingAlbum}
        >
          <option value="">Zgjidh eventin</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title || `Event #${event.id}`}
            </option>
          ))}
        </select>

        <input
          type="text"
          name="title"
          placeholder="Titulli i albumit p.sh. Party"
          value={albumForm.title}
          onChange={handleAlbumFormChange}
          required
        />

        <input
          type="text"
          name="cover_image"
          placeholder="Cover image URL (opsionale)"
          value={albumForm.cover_image}
          onChange={handleAlbumFormChange}
        />

        <div className="form-actions-row">
          <button type="submit">
            {isEditingAlbum ? "Ruaj Ndryshimet" : "Ruaj Albumin"}
          </button>

          {isEditingAlbum && (
            <button
              type="button"
              className="secondary-btn"
              onClick={handleCancelEditAlbum}
            >
              Anulo
            </button>
          )}
        </div>
      </form>

      {albumSuccess && <div className="success-box">{albumSuccess}</div>}
      {albumError && <div className="error-box">{albumError}</div>}

      <div className="table-wrap">
        <div className="table-header">
          <h3>Lista e albumeve</h3>
          <button
            className="small-btn"
            type="button"
            onClick={() => fetchAlbumsByEvent(albumForm.event_id)}
            disabled={!albumForm.event_id}
          >
            Refresh
          </button>
        </div>

        {!albumForm.event_id ? (
          <div className="empty-box">Zgjidh një event për të parë albumet.</div>
        ) : loadingAlbums ? (
          <div className="empty-box">Duke i ngarkuar albumet...</div>
        ) : albumsByEvent.length === 0 ? (
          <div className="empty-box">Nuk ka albume ende për këtë event.</div>
        ) : (
          <div className="event-list">
            {albumsByEvent.map((album) => (
              <div key={album.id} className="event-row">
                <div>
                  <div className="event-title">
                    {album.title || `Album #${album.id}`}
                  </div>
                  <div className="event-meta">
                    ID: {album.id}
                    {album.slug ? ` • Slug: ${album.slug}` : ""}
                  </div>
                  <div className="event-description">
                    {album.cover_image ? album.cover_image : "Pa cover image"}
                  </div>
                </div>

                <div className="row-actions">
                  <button
                    type="button"
                    className="edit-btn"
                    onClick={() => handleStartEditAlbum(album)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => handleDeleteAlbum(album.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AlbumsPage;