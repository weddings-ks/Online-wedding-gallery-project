import React, { memo, useCallback, useMemo } from "react";

const AlbumRow = memo(function AlbumRow({
  album,
  onEdit,
  onDelete
}) {
  const handleEdit = useCallback(() => {
    onEdit(album);
  }, [onEdit, album]);

  const handleDelete = useCallback(() => {
    onDelete(album.id);
  }, [onDelete, album.id]);

  return (
    <div className="event-row modern-row">
      <div className="album-row-content">
        <div className="event-title">
          {album.title || `Album #${album.id}`}
        </div>

        <div className="event-meta">
          ID: {album.id}
          {album.slug ? ` • ${album.slug}` : ""}
        </div>

        {album.cover_image_url ? (
          <div className="album-cover-preview-wrap small">
            <img
              src={album.cover_image_url}
              alt={album.title || "Album cover"}
              className="album-cover-preview"
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : (
          <div className="event-description">Pa cover image</div>
        )}
      </div>

      <div className="row-actions modern-actions">
        <button
          type="button"
          className="edit-btn modern-btn"
          onClick={handleEdit}
        >
          Edit
        </button>

        <button
          type="button"
          className="delete-btn modern-btn danger"
          onClick={handleDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
});

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
  isEditingAlbum
}) {
  const eventOptions = useMemo(() => {
    return events.map((event) => (
      <option key={event.id} value={event.id}>
        {event.title || `Event #${event.id}`}
      </option>
    ));
  }, [events]);

  const albumItems = useMemo(() => {
    return Array.isArray(albumsByEvent) ? albumsByEvent : [];
  }, [albumsByEvent]);

  const handleRefresh = useCallback(() => {
    if (!albumForm.event_id) return;
    fetchAlbumsByEvent(albumForm.event_id);
  }, [fetchAlbumsByEvent, albumForm.event_id]);

  const handleSubmit = useCallback(
    (e) => {
      if (isEditingAlbum) {
        handleUpdateAlbum(e);
      } else {
        handleCreateAlbum(e);
      }
    },
    [isEditingAlbum, handleUpdateAlbum, handleCreateAlbum]
  );

  const handleEditAlbum = useCallback(
    (album) => {
      handleStartEditAlbum(album);
    },
    [handleStartEditAlbum]
  );

  const handleDeleteOneAlbum = useCallback(
    (albumId) => {
      handleDeleteAlbum(albumId);
    },
    [handleDeleteAlbum]
  );

  return (
    <div className="admin-page">
      <h2>Albums</h2>
      <p>Këtu krijohen, editohen dhe fshihen albumet për çdo event.</p>

      <form className="admin-form" onSubmit={handleSubmit}>
        <select
          name="event_id"
          value={albumForm.event_id}
          onChange={handleAlbumFormChange}
          required
          disabled={isEditingAlbum}
        >
          <option value="">Zgjidh eventin</option>
          {eventOptions}
        </select>

        <input
          type="text"
          name="title"
          placeholder="Titulli i albumit p.sh. Party"
          value={albumForm.title}
          onChange={handleAlbumFormChange}
          required
        />

        <div className="file-input-group">
          <label className="file-input-label">
            Cover image{" "}
            {isEditingAlbum
              ? "(opsionale - vetëm nëse don me ndërru)"
              : "(opsionale)"}
          </label>

          <input
            type="file"
            name="cover_image"
            accept="image/*"
            onChange={handleAlbumFormChange}
          />

          {albumForm.cover_image &&
            typeof albumForm.cover_image !== "string" && (
              <div className="selected-file-name">
                File i zgjedhur: {albumForm.cover_image.name}
              </div>
            )}

          {isEditingAlbum &&
            albumForm.cover_image_url &&
            !albumForm.cover_image && (
              <div className="selected-file-name">
                Cover aktual ekziston.
              </div>
            )}
        </div>

        {albumForm.cover_image_url && !albumForm.cover_image && (
          <div className="album-cover-preview-wrap">
            <img
              src={albumForm.cover_image_url}
              alt={albumForm.title || "Album cover"}
              className="album-cover-preview"
              loading="lazy"
              decoding="async"
            />
          </div>
        )}

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
            onClick={handleRefresh}
            disabled={!albumForm.event_id}
          >
            Refresh
          </button>
        </div>

        {!albumForm.event_id ? (
          <div className="empty-box">Zgjidh një event për të parë albumet.</div>
        ) : loadingAlbums ? (
          <div className="empty-box">Duke i ngarkuar albumet...</div>
        ) : albumItems.length === 0 ? (
          <div className="empty-box">Nuk ka albume ende për këtë event.</div>
        ) : (
          <div className="event-list">
            {albumItems.map((album) => (
              <AlbumRow
                key={album.id}
                album={album}
                onEdit={handleEditAlbum}
                onDelete={handleDeleteOneAlbum}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(AlbumsPage);