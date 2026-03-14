function EventsPage({
  events,
  loadingEvents,
  eventError,
  eventSuccess,
  eventForm,
  handleEventFormChange,
  handleCreateEvent,
  fetchEvents,
  handleStartEditEvent,
  handleUpdateEvent,
  handleDeleteEvent,
  handleCancelEditEvent,
  isEditingEvent,
}) {
  const localPreview = eventForm.cover_file
    ? URL.createObjectURL(eventForm.cover_file)
    : null;

  const previewImage = localPreview || eventForm.cover_image || "";

  return (
    <div className="admin-page">
      <div className="page-head">
        <div>
          <h2>Events</h2>
          <p>Këtu krijohen, editohen dhe menaxhohen eventet.</p>
        </div>
      </div>

      <div className="admin-card">
        <div className="section-title-row">
          <h3>{isEditingEvent ? "Edit Event" : "Krijo Event të Ri"}</h3>
        </div>

        <form
          className="admin-form"
          onSubmit={isEditingEvent ? handleUpdateEvent : handleCreateEvent}
        >
          <div className="form-grid two-cols">
            <div className="form-group">
              <label>Titulli i eventit</label>
              <input
                type="text"
                name="title"
                placeholder="P.sh. Vanesa & Florian"
                value={eventForm.title}
                onChange={handleEventFormChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Data e eventit</label>
              <input
                type="date"
                name="event_date"
                value={eventForm.event_date}
                onChange={handleEventFormChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Përshkrimi</label>
            <textarea
              name="description"
              placeholder="Përshkrimi i eventit"
              value={eventForm.description}
              onChange={handleEventFormChange}
              rows="4"
            />
          </div>

          <div className="form-grid two-cols">
            <div className="form-group">
              <label>Ngarko cover photo</label>
              <input
                type="file"
                id="event-cover-file"
                name="cover_file"
                accept="image/*"
                onChange={handleEventFormChange}
              />
              <small className="field-note">
                Zgjidh një foto nga kompjuteri për hero image.
              </small>
            </div>

            <div className="form-group">
              <label>Cover image URL</label>
              <input
                type="text"
                name="cover_image"
                placeholder="https://..."
                value={eventForm.cover_image}
                onChange={handleEventFormChange}
              />
              <small className="field-note">
                Opsionale. Përdoret vetëm nëse nuk ngarkohet file.
              </small>
            </div>
          </div>

          {previewImage && (
            <div className="cover-preview-box">
              <div className="cover-preview-top">
                <p className="cover-preview-label">Preview Cover</p>
              </div>
              <img
                src={previewImage}
                alt="Preview Cover"
                className="cover-preview-image"
              />
            </div>
          )}

          <div className="form-actions-row">
            <button type="submit" className="primary-btn">
              {isEditingEvent ? "Ruaj Ndryshimet" : "Ruaj Eventin"}
            </button>

            {isEditingEvent && (
              <button
                type="button"
                className="secondary-btn"
                onClick={handleCancelEditEvent}
              >
                Anulo
              </button>
            )}
          </div>
        </form>
      </div>

      {eventSuccess && <div className="success-box">{eventSuccess}</div>}
      {eventError && <div className="error-box">{eventError}</div>}

      <div className="table-wrap admin-card">
        <div className="table-header">
          <h3>Lista e eventeve</h3>
          <button className="small-btn" type="button" onClick={fetchEvents}>
            Refresh
          </button>
        </div>

        {loadingEvents ? (
          <div className="empty-box">Duke i ngarkuar eventet...</div>
        ) : events.length === 0 ? (
          <div className="empty-box">Nuk ka evente ende.</div>
        ) : (
          <div className="event-list professional-event-list">
            {events.map((event) => {
              const publicLink = `${window.location.origin}/gallery/${event.slug}`;

              return (
                <div key={event.id} className="event-row professional-event-row">
                  <div className="event-row-main">
                    <div className="event-cover-col">
                      {event.cover_image ? (
                        <img
                          src={event.cover_image}
                          alt={event.title || "Event cover"}
                          className="event-row-cover"
                        />
                      ) : (
                        <div className="event-row-cover event-row-cover-placeholder">
                          No Cover
                        </div>
                      )}
                    </div>

                    <div className="event-info-col">
                      <div className="event-title-row">
                        <div className="event-title">
                          {event.title || `Event #${event.id}`}
                        </div>
                      </div>

                      <div className="event-meta">
                        <span>ID: {event.id}</span>
                        {event.slug && <span>Slug: {event.slug}</span>}
                        {event.event_date && (
                          <span>
                            Data: {String(event.event_date).split("T")[0]}
                          </span>
                        )}
                      </div>

                      <div className="event-description">
                        {event.description || "Pa përshkrim"}
                      </div>

                      <div className="event-link-row">
                        <input
                          type="text"
                          readOnly
                          value={publicLink}
                          className="event-link-input"
                        />

                        <button
                          type="button"
                          className="small-btn"
                          onClick={() => navigator.clipboard.writeText(publicLink)}
                        >
                          Copy Link
                        </button>

                        <a
                          href={publicLink}
                          target="_blank"
                          rel="noreferrer"
                          className="small-btn link-btn"
                        >
                          Open
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="row-actions vertical-actions">
                    <button
                      type="button"
                      className="edit-btn"
                      onClick={() => handleStartEditEvent(event)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => handleDeleteEvent(event.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default EventsPage;