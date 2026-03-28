import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const DEFAULT_GUEST_PHOTO_LIMIT = 50;

function formatEventDate(value) {
  if (!value) return "";
  return String(value).split("T")[0];
}

function formatExpiryDate(value) {
  if (!value) return "Pa afat";
  return String(value).split("T")[0];
}

function getEventCoverSrc(event) {
  return (
    event?.cover_image_signed_url ||
    event?.cover_signed_url ||
    event?.signed_cover_image_url ||
    event?.cover_image ||
    event?.cover_image_url ||
    ""
  );
}

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
  handleToggleAutoDelete
}) {
  const [guestSections, setGuestSections] = useState({});
  const [loadingGuestSections, setLoadingGuestSections] = useState({});
  const [guestSectionErrors, setGuestSectionErrors] = useState({});
  const [creatingGuestSection, setCreatingGuestSection] = useState({});
  const [updatingGuestSection, setUpdatingGuestSection] = useState({});
  const [copyMessage, setCopyMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [qrModal, setQrModal] = useState({
    open: false,
    image: "",
    link: "",
    title: ""
  });
  const [brokenCovers, setBrokenCovers] = useState({});

  const localPreview = useMemo(() => {
    if (!eventForm.cover_file) return null;
    return URL.createObjectURL(eventForm.cover_file);
  }, [eventForm.cover_file]);

  useEffect(() => {
    return () => {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  useEffect(() => {
    if (!copyMessage) return;
    const timeout = setTimeout(() => setCopyMessage(""), 2200);
    return () => clearTimeout(timeout);
  }, [copyMessage]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchEvents(searchTerm);
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchTerm, fetchEvents]);

  const previewImage = localPreview || eventForm.cover_image || "";

  const handleCopyLink = async (link, message = "Linku u kopjua me sukses.") => {
    try {
      await navigator.clipboard.writeText(link);
      setCopyMessage(message);
    } catch (error) {
      console.error("Gabim gjatë copy link:", error);
      setCopyMessage("Nuk u kopjua linku.");
    }
  };

  const handleShowQR = async (link, title = "Guest QR Code") => {
    try {
      const qrImage = await QRCode.toDataURL(link, {
        width: 340,
        margin: 2
      });

      setQrModal({
        open: true,
        image: qrImage,
        link,
        title
      });
    } catch (error) {
      console.error("Gabim gjatë gjenerimit të QR:", error);
      setCopyMessage("Gabim gjatë krijimit të QR Code.");
    }
  };

  const closeQrModal = () => {
    setQrModal({
      open: false,
      image: "",
      link: "",
      title: ""
    });
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    };
  };

  const fetchGuestSections = async (eventId) => {
    try {
      setLoadingGuestSections((prev) => ({
        ...prev,
        [eventId]: true
      }));

      setGuestSectionErrors((prev) => ({
        ...prev,
        [eventId]: ""
      }));

      const response = await fetch(
        `${API_BASE}/api/guest-sections/event/${eventId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Gabim gjatë marrjes së seksioneve.");
      }

      const sections = Array.isArray(data)
        ? data
        : Array.isArray(data.sections)
        ? data.sections
        : [];

      setGuestSections((prev) => ({
        ...prev,
        [eventId]: sections
      }));
    } catch (error) {
      console.error("fetchGuestSections error:", error);

      setGuestSectionErrors((prev) => ({
        ...prev,
        [eventId]: error.message || "Gabim gjatë marrjes së seksioneve."
      }));

      setGuestSections((prev) => ({
        ...prev,
        [eventId]: []
      }));
    } finally {
      setLoadingGuestSections((prev) => ({
        ...prev,
        [eventId]: false
      }));
    }
  };

  const handleCreateGuestSection = async (eventId) => {
    const limitInput = window.prompt(
      "Shkruaj limitin maksimal të fotove për këtë seksion:",
      String(DEFAULT_GUEST_PHOTO_LIMIT)
    );

    if (limitInput === null) return;

    const parsedLimit = Number(limitInput);

    if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
      setGuestSectionErrors((prev) => ({
        ...prev,
        [eventId]: "Limiti duhet të jetë një numër më i madh se 0."
      }));
      return;
    }

    try {
      setCreatingGuestSection((prev) => ({
        ...prev,
        [eventId]: true
      }));

      setGuestSectionErrors((prev) => ({
        ...prev,
        [eventId]: ""
      }));

      const response = await fetch(`${API_BASE}/api/guest-sections`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          event_id: eventId,
          title: "Fotot nga Dasmorët",
          description: "Ngarko fotot që ke bërë gjatë dasmës",
          is_active: true,
          sort_order: 0,
          section_image_url: "",
          max_upload_photos: parsedLimit
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Gabim gjatë krijimit të seksionit.");
      }

      await fetchGuestSections(eventId);
      setCopyMessage("Seksioni u krijua me sukses.");
    } catch (error) {
      console.error("handleCreateGuestSection error:", error);

      setGuestSectionErrors((prev) => ({
        ...prev,
        [eventId]: error.message || "Gabim gjatë krijimit të seksionit."
      }));
    } finally {
      setCreatingGuestSection((prev) => ({
        ...prev,
        [eventId]: false
      }));
    }
  };

  const handleUpdateGuestSectionLimit = async (eventId, section) => {
    const currentLimit = Number(
      section.max_upload_photos ?? DEFAULT_GUEST_PHOTO_LIMIT
    );

    const limitInput = window.prompt(
      "Vendos limitin e ri të fotove për këtë seksion:",
      String(currentLimit)
    );

    if (limitInput === null) return;

    const parsedLimit = Number(limitInput);
    const uploadedCount = Number(section.uploaded_photos_count || 0);

    if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
      setGuestSectionErrors((prev) => ({
        ...prev,
        [eventId]: "Limiti duhet të jetë një numër më i madh se 0."
      }));
      return;
    }

    if (parsedLimit < uploadedCount) {
      setGuestSectionErrors((prev) => ({
        ...prev,
        [eventId]: `Limiti i ri nuk mund të jetë më i vogël se numri aktual i fotove (${uploadedCount}).`
      }));
      return;
    }

    try {
      setUpdatingGuestSection((prev) => ({
        ...prev,
        [section.id]: true
      }));

      setGuestSectionErrors((prev) => ({
        ...prev,
        [eventId]: ""
      }));

      const response = await fetch(
        `${API_BASE}/api/guest-sections/${section.id}`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            max_upload_photos: parsedLimit
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Gabim gjatë përditësimit të limitit."
        );
      }

      await fetchGuestSections(eventId);
      setCopyMessage("Limiti i fotove u përditësua me sukses.");
    } catch (error) {
      console.error("handleUpdateGuestSectionLimit error:", error);

      setGuestSectionErrors((prev) => ({
        ...prev,
        [eventId]: error.message || "Gabim gjatë përditësimit të limitit."
      }));
    } finally {
      setUpdatingGuestSection((prev) => ({
        ...prev,
        [section.id]: false
      }));
    }
  };

  const handleDeleteGuestSection = async (eventId, sectionId) => {
    const confirmed = window.confirm(
      "A je i sigurt që dëshiron ta fshish këtë seksion?"
    );

    if (!confirmed) return;

    try {
      setGuestSectionErrors((prev) => ({
        ...prev,
        [eventId]: ""
      }));

      const response = await fetch(
        `${API_BASE}/api/guest-sections/${sectionId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Gabim gjatë fshirjes së seksionit.");
      }

      await fetchGuestSections(eventId);
      setCopyMessage("Seksioni u fshi me sukses.");
    } catch (error) {
      console.error("handleDeleteGuestSection error:", error);

      setGuestSectionErrors((prev) => ({
        ...prev,
        [eventId]: error.message || "Gabim gjatë fshirjes së seksionit."
      }));
    }
  };

  const handleToggleGuestSectionStatus = async (eventId, section) => {
    try {
      setGuestSectionErrors((prev) => ({
        ...prev,
        [eventId]: ""
      }));

      const response = await fetch(
        `${API_BASE}/api/guest-sections/${section.id}`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            is_active: !section.is_active
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Gabim gjatë përditësimit të seksionit."
        );
      }

      await fetchGuestSections(eventId);
      setCopyMessage(
        section.is_active
          ? "Seksioni u çaktivizua me sukses."
          : "Seksioni u aktivizua me sukses."
      );
    } catch (error) {
      console.error("handleToggleGuestSectionStatus error:", error);

      setGuestSectionErrors((prev) => ({
        ...prev,
        [eventId]: error.message || "Gabim gjatë përditësimit të seksionit."
      }));
    }
  };

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
                value={eventForm.title || ""}
                onChange={handleEventFormChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Data e eventit</label>
              <input
                type="date"
                name="event_date"
                value={eventForm.event_date || ""}
                onChange={handleEventFormChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Përshkrimi</label>
            <textarea
              name="description"
              placeholder="Përshkrimi i eventit"
              value={eventForm.description || ""}
              onChange={handleEventFormChange}
              rows="4"
            />
          </div>

          <div className="form-grid two-cols">
            <div className="form-group">
              <label>Emri i klientit</label>
              <input
                type="text"
                name="client_name"
                placeholder="P.sh. Vanesa & Florian"
                value={eventForm.client_name || ""}
                onChange={handleEventFormChange}
              />
            </div>

            <div className="form-group">
              <label>Gallery Password</label>
              <input
                type="text"
                name="gallery_password"
                placeholder="Opsionale – p.sh. 1234"
                value={eventForm.gallery_password || ""}
                onChange={handleEventFormChange}
              />
              <small className="field-note">
                Nëse plotësohet, galeria publike hapet vetëm me password.
              </small>
            </div>
          </div>

          <div className="form-grid two-cols">
            <div className="form-group checkbox-group">
              <label className="checkbox-label">Allow event download</label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  name="allow_event_download"
                  checked={Boolean(eventForm.allow_event_download)}
                  onChange={handleEventFormChange}
                />
                <span>Lejo shkarkimin e eventit</span>
              </label>
            </div>

            <div className="form-group">
              <label>Event download limit</label>
              <input
                type="number"
                name="event_download_limit"
                min="0"
                value={1}
                onChange={(e) =>
                  handleEventFormChange({
                    target: {
                      name: "event_download_limit",
                      value: Math.max(0, Number(e.target.value))
                    }
                  })
                }
              />
              <small className="field-note">
                0 = nuk lejohet shkarkimi i eventit, 1 = vetëm 1 herë
              </small>
            </div>
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
                value={eventForm.cover_image || ""}
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

      {copyMessage && <div className="success-box">{copyMessage}</div>}
      {eventSuccess && <div className="success-box">{eventSuccess}</div>}
      {eventError && <div className="error-box">{eventError}</div>}

      <div className="table-wrap admin-card">
        <div className="table-header">
          <h3>Lista e eventeve</h3>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Kerko event..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />

            <button
              className="small-btn"
              type="button"
              onClick={() => fetchEvents(searchTerm)}
            >
              Refresh
            </button>
          </div>
        </div>

        {loadingEvents ? (
          <div className="empty-box">Duke i ngarkuar eventet...</div>
        ) : events.length === 0 ? (
          <div className="empty-box">Nuk ka evente ende.</div>
        ) : (
          <div className="event-list professional-event-list">
            {events.map((event) => {
              const publicLink = `${window.location.origin}/gallery/${event.slug}`;
              const eventDownloadLimit = Number(event.event_download_limit ?? 1);
              const eventDownloadCount = Number(event.zip_download_count ?? 0);
              const eventDownloadRemaining = Math.max(
                0,
                eventDownloadLimit - eventDownloadCount
              );

              const canDownloadEvent =
                Boolean(event.allow_event_download) &&
                eventDownloadLimit > 0 &&
                eventDownloadCount < eventDownloadLimit;

              const isAutoDeleteEnabled =
                event.auto_delete_enabled === undefined ||
                event.auto_delete_enabled === null
                  ? true
                  : Boolean(event.auto_delete_enabled);

              const eventGuestSections = guestSections[event.id] || [];
              const guestSectionsLoaded = Object.prototype.hasOwnProperty.call(
                guestSections,
                event.id
              );
              const isLoadingGuestSections = Boolean(
                loadingGuestSections[event.id]
              );
              const isCreatingGuestSection = Boolean(
                creatingGuestSection[event.id]
              );
              const guestSectionError = guestSectionErrors[event.id] || "";

              const coverSrc = getEventCoverSrc(event);
              const isBrokenCover = Boolean(brokenCovers[event.id]);

              return (
                <div key={event.id} className="event-row professional-event-row">
                  <div className="event-row-main">
                    <div className="event-cover-col">
                      {coverSrc && !isBrokenCover ? (
                        <img
                          src={coverSrc}
                          alt={event.title || "Event cover"}
                          className="event-row-cover"
                          loading="lazy"
                          onError={() =>
                            setBrokenCovers((prev) => ({
                              ...prev,
                              [event.id]: true
                            }))
                          }
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
                          <span>Data: {formatEventDate(event.event_date)}</span>
                        )}
                        {event.expires_at && (
                          <span>Skadon: {formatExpiryDate(event.expires_at)}</span>
                        )}
                      </div>

                      <div className="event-description">
                        {event.description || "Pa përshkrim"}
                      </div>

                      <div className="event-settings-badges">
                        <span
                          className={`settings-badge ${
                            !event.allow_event_download ? "badge-danger" : ""
                          }`}
                        >
                          Event Download:{" "}
                          {event.allow_event_download === false ? "OFF" : "ON"}
                        </span>

                        <span
                          className={`settings-badge ${
                            !canDownloadEvent ? "badge-danger" : ""
                          }`}
                        >
                          Event Limit: {eventDownloadCount}/{eventDownloadLimit}
                        </span>

                        <span
                          className={`settings-badge ${
                            eventDownloadRemaining === 0 ? "badge-danger" : ""
                          }`}
                        >
                          Mbetur: {eventDownloadRemaining}
                        </span>

                        <span className="settings-badge">
                          Auto Delete: {isAutoDeleteEnabled ? "ON" : "OFF"}
                        </span>

                        {event.gallery_password && (
                          <span className="settings-badge">
                            🔒 Password Protected
                          </span>
                        )}
                      </div>

                      {!canDownloadEvent && (
                        <div className="limit-warning">
                          ⚠️ Ky event nuk mund të shkarkohet më
                        </div>
                      )}

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
                          onClick={() =>
                            handleCopyLink(publicLink, "Linku i galerisë u kopjua.")
                          }
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

                      <div className="guest-section-box">
                        <div className="guest-section-header">
                          <div>
                            <h4>Fotot nga Dasmorët</h4>
                            <p>
                              Krijo seksione me QR Code ku dasmorët mund të
                              shtojnë foto.
                            </p>
                          </div>

                          <div className="guest-section-actions">
                            <button
                              type="button"
                              className="small-btn"
                              onClick={() => fetchGuestSections(event.id)}
                              disabled={isLoadingGuestSections}
                            >
                              {isLoadingGuestSections ? "Duke u ngarkuar..." : "Shfaq"}
                            </button>

                            <button
                              type="button"
                              className="small-btn"
                              onClick={() => handleCreateGuestSection(event.id)}
                              disabled={isCreatingGuestSection}
                            >
                              {isCreatingGuestSection
                                ? "Duke krijuar..."
                                : "+ Shto seksion"}
                            </button>
                          </div>
                        </div>

                        {guestSectionError ? (
                          <div className="error-box guest-section-message">
                            {guestSectionError}
                          </div>
                        ) : null}

                        {!guestSectionsLoaded ? (
                          <div className="guest-empty">
                            Kliko “Shfaq” për t’i parë seksionet e këtij eventi.
                          </div>
                        ) : eventGuestSections.length === 0 ? (
                          <div className="guest-empty">
                            Nuk ka ende seksione për këtë event.
                          </div>
                        ) : (
                          <div className="guest-section-list">
                            {eventGuestSections.map((section) => {
                              const guestLink = `${window.location.origin}/guest-upload/${section.slug}`;
                              const uploadedCount = Number(
                                section.uploaded_photos_count || 0
                              );
                              const maxUploadPhotos = Number(
                                section.max_upload_photos ||
                                  DEFAULT_GUEST_PHOTO_LIMIT
                              );
                              const remainingPhotos = Math.max(
                                0,
                                maxUploadPhotos - uploadedCount
                              );

                              return (
                                <div key={section.id} className="guest-item">
                                  <div className="guest-item-main">
                                    <div className="guest-item-title-row">
                                      <strong>{section.title}</strong>
                                      <span
                                        className={`guest-status-badge ${
                                          section.is_active ? "active" : "inactive"
                                        }`}
                                      >
                                        {section.is_active ? "Aktiv" : "Jo aktiv"}
                                      </span>
                                    </div>

                                    <p>{section.description || "Pa përshkrim"}</p>

                                    <small>Slug: {section.slug}</small>

                                    <div className="guest-stats-row">
                                      <span className="settings-badge">
                                        Foto: {uploadedCount}/{maxUploadPhotos}
                                      </span>
                                      <span className="settings-badge">
                                        Mbetur: {remainingPhotos}
                                      </span>
                                    </div>

                                    <div className="guest-link-row enhanced">
                                      <input
                                        type="text"
                                        readOnly
                                        value={guestLink}
                                        className="event-link-input"
                                      />

                                      <div className="guest-link-actions">
                                        <button
                                          type="button"
                                          className="small-btn"
                                          onClick={() =>
                                            handleCopyLink(
                                              guestLink,
                                              "Guest link u kopjua me sukses."
                                            )
                                          }
                                        >
                                          Copy
                                        </button>

                                        <button
                                          type="button"
                                          className="small-btn"
                                          onClick={() =>
                                            handleShowQR(
                                              guestLink,
                                              section.title || "Guest QR Code"
                                            )
                                          }
                                        >
                                          QR
                                        </button>

                                        <a
                                          href={guestLink}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="small-btn link-btn"
                                        >
                                          Open
                                        </a>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="guest-item-actions">
                                    <button
                                      type="button"
                                      className="small-btn"
                                      onClick={() =>
                                        handleUpdateGuestSectionLimit(
                                          event.id,
                                          section
                                        )
                                      }
                                      disabled={Boolean(
                                        updatingGuestSection[section.id]
                                      )}
                                    >
                                      {updatingGuestSection[section.id]
                                        ? "Duke ruajtur..."
                                        : "Edit Limit"}
                                    </button>

                                    <button
                                      type="button"
                                      className="small-btn"
                                      onClick={() =>
                                        handleToggleGuestSectionStatus(
                                          event.id,
                                          section
                                        )
                                      }
                                    >
                                      {section.is_active ? "Çaktivizo" : "Aktivizo"}
                                    </button>

                                    <button
                                      type="button"
                                      className="delete-btn"
                                      onClick={() =>
                                        handleDeleteGuestSection(
                                          event.id,
                                          section.id
                                        )
                                      }
                                    >
                                      Fshij
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="row-actions vertical-actions">
                    <button
                      type="button"
                      className={isAutoDeleteEnabled ? "secondary-btn" : "small-btn"}
                      onClick={() =>
                        handleToggleAutoDelete(event.id, !isAutoDeleteEnabled)
                      }
                    >
                      {isAutoDeleteEnabled
                        ? "Turn Auto Delete OFF"
                        : "Turn Auto Delete ON"}
                    </button>

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

      {qrModal.open && (
        <div className="qr-modal-overlay" onClick={closeQrModal}>
          <div className="qr-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="qr-modal-top">
              <h3>{qrModal.title || "Guest QR Code"}</h3>
              <button
                type="button"
                className="qr-close-btn"
                onClick={closeQrModal}
              >
                ✕
              </button>
            </div>

            <div className="qr-modal-image-wrap">
              <img src={qrModal.image} alt="Guest QR Code" />
            </div>

            <div className="qr-link-preview">
              <input
                type="text"
                readOnly
                value={qrModal.link}
                className="event-link-input"
              />
            </div>

            <div className="qr-modal-actions">
              <button
                type="button"
                className="small-btn"
                onClick={() =>
                  handleCopyLink(qrModal.link, "Guest link u kopjua me sukses.")
                }
              >
                Copy Link
              </button>

              <a
                href={qrModal.image}
                download="guest-qr.png"
                className="small-btn link-btn"
              >
                Download QR
              </a>

              <button
                type="button"
                className="secondary-btn"
                onClick={closeQrModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventsPage;