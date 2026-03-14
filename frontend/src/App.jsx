import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import "./styles/app.css";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";

import DashboardPage from "./pages/DashboardPage";
import EventsPage from "./pages/EventsPage";
import AlbumsPage from "./pages/AlbumsPage";
import UploadPage from "./pages/UploadPage";
import LoginPage from "./pages/LoginPage";
import PublicGalleryPage from "./pages/PublicGalleryPage";

const API_BASE = "http://localhost:5000";

function AdminApp() {
  const [activePage, setActivePage] = useState("dashboard");

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventError, setEventError] = useState("");
  const [eventSuccess, setEventSuccess] = useState("");
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);

  const [albumsByEvent, setAlbumsByEvent] = useState([]);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [albumError, setAlbumError] = useState("");
  const [albumSuccess, setAlbumSuccess] = useState("");
  const [isEditingAlbum, setIsEditingAlbum] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState(null);

  const [uploadAlbums, setUploadAlbums] = useState([]);
  const [loadingUploadAlbums, setLoadingUploadAlbums] = useState(false);
  const [uploadMediaList, setUploadMediaList] = useState([]);
  const [loadingUploadMedia, setLoadingUploadMedia] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    event_date: "",
    cover_image: "",
    cover_file: null,
  });

  const [albumForm, setAlbumForm] = useState({
    event_id: "",
    title: "",
    cover_image: "",
  });

  const [uploadForm, setUploadForm] = useState({
    event_id: "",
    album_id: "",
    title: "",
    files: [],
  });

  const getToken = () => localStorage.getItem("token");

  const authFetch = useCallback(async (endpoint, options = {}) => {
    const savedToken = getToken();

    if (!savedToken) {
      throw new Error("Nuk u gjet token. Bëj login fillimisht.");
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${savedToken}`,
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(options.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.message || "Gabim në API");
    }

    return data;
  }, []);

  const publicFetch = useCallback(async (endpoint, options = {}) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(options.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.message || "Gabim në API");
    }

    return data;
  }, []);

  const normalizeArray = (data, key) => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data[key])) return data[key];
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  };

  const resetEventForm = () => {
    setEventForm({
      title: "",
      description: "",
      event_date: "",
      cover_image: "",
      cover_file: null,
    });

    const coverInput = document.getElementById("event-cover-file");
    if (coverInput) coverInput.value = "";
  };

  const fetchEvents = useCallback(async () => {
    try {
      setLoadingEvents(true);
      setEventError("");

      const data = await authFetch("/api/events", { method: "GET" });
      const eventList = normalizeArray(data, "events");
      setEvents(eventList);
    } catch (err) {
      setEventError(err.message || "Gabim gjatë marrjes së eventeve");
    } finally {
      setLoadingEvents(false);
    }
  }, [authFetch]);

  const fetchAlbumsByEvent = useCallback(
    async (eventId) => {
      if (!eventId) {
        setAlbumsByEvent([]);
        return;
      }

      try {
        setLoadingAlbums(true);
        setAlbumError("");

        const data = await publicFetch(`/api/albums/event/${eventId}`, {
          method: "GET",
        });

        const albumList = normalizeArray(data, "albums");
        setAlbumsByEvent(albumList);
      } catch (err) {
        setAlbumError(err.message || "Gabim gjatë marrjes së albumeve");
        setAlbumsByEvent([]);
      } finally {
        setLoadingAlbums(false);
      }
    },
    [publicFetch]
  );

  const fetchUploadAlbumsByEvent = useCallback(
    async (eventId) => {
      if (!eventId) {
        setUploadAlbums([]);
        return;
      }

      try {
        setLoadingUploadAlbums(true);
        setUploadError("");

        const data = await publicFetch(`/api/albums/event/${eventId}`, {
          method: "GET",
        });

        const albumList = normalizeArray(data, "albums");
        setUploadAlbums(albumList);
      } catch (err) {
        setUploadError(
          err.message || "Gabim gjatë marrjes së albumeve për upload"
        );
        setUploadAlbums([]);
      } finally {
        setLoadingUploadAlbums(false);
      }
    },
    [publicFetch]
  );

  const fetchMediaByAlbum = useCallback(
    async (albumId) => {
      if (!albumId) {
        setUploadMediaList([]);
        return;
      }

      try {
        setLoadingUploadMedia(true);
        setUploadError("");

        const data = await publicFetch(`/api/media/album/${albumId}`, {
          method: "GET",
        });

        const mediaList = normalizeArray(data, "media");
        setUploadMediaList(mediaList);
      } catch (err) {
        setUploadError(err.message || "Gabim gjatë marrjes së medias");
        setUploadMediaList([]);
      } finally {
        setLoadingUploadMedia(false);
      }
    },
    [publicFetch]
  );

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (albumForm.event_id) {
      fetchAlbumsByEvent(albumForm.event_id);
    } else {
      setAlbumsByEvent([]);
    }
  }, [albumForm.event_id, fetchAlbumsByEvent]);

  useEffect(() => {
    if (uploadForm.event_id) {
      fetchUploadAlbumsByEvent(uploadForm.event_id);
      setUploadForm((prev) => ({ ...prev, album_id: "" }));
      setUploadMediaList([]);
    } else {
      setUploadAlbums([]);
      setUploadForm((prev) => ({ ...prev, album_id: "" }));
      setUploadMediaList([]);
    }
  }, [uploadForm.event_id, fetchUploadAlbumsByEvent]);

  const handleEventFormChange = (e) => {
    const { name, value, files, type } = e.target;

    if (type === "file") {
      setEventForm((prev) => ({
        ...prev,
        [name]: files && files[0] ? files[0] : null,
      }));
      return;
    }

    setEventForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAlbumFormChange = (e) => {
    const { name, value } = e.target;
    setAlbumForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUploadChange = (e) => {
    const { name, value } = e.target;

    setUploadForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "event_id") {
      setUploadMediaList([]);
    }

    if (name === "album_id") {
      if (value) {
        fetchMediaByAlbum(value);
      } else {
        setUploadMediaList([]);
      }
    }
  };

  const handleFileChange = (e) => {
    setUploadForm((prev) => ({
      ...prev,
      files: Array.from(e.target.files || []),
    }));
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();

    try {
      setEventError("");
      setEventSuccess("");

      const formData = new FormData();
      formData.append("title", eventForm.title);
      formData.append("description", eventForm.description || "");
      formData.append("event_date", eventForm.event_date || "");
      formData.append("cover_image", eventForm.cover_image || "");

      if (eventForm.cover_file) {
        formData.append("cover", eventForm.cover_file);
      }

      await authFetch("/api/events", {
        method: "POST",
        body: formData,
      });

      setEventSuccess("Eventi u krijua me sukses.");
      resetEventForm();
      fetchEvents();
    } catch (err) {
      setEventError(err.message || "Gabim gjatë krijimit të eventit");
    }
  };

  const handleStartEditEvent = (event) => {
    setEventError("");
    setEventSuccess("");
    setIsEditingEvent(true);
    setEditingEventId(event.id);

    setEventForm({
      title: event.title || "",
      description: event.description || "",
      event_date: event.event_date ? String(event.event_date).split("T")[0] : "",
      cover_image: event.cover_image || "",
      cover_file: null,
    });

    const coverInput = document.getElementById("event-cover-file");
    if (coverInput) coverInput.value = "";
  };

  const handleCancelEditEvent = () => {
    setEventError("");
    setEventSuccess("");
    setIsEditingEvent(false);
    setEditingEventId(null);
    resetEventForm();
  };

  const handleUpdateEvent = async (e) => {
    e.preventDefault();

    try {
      setEventError("");
      setEventSuccess("");

      if (!editingEventId) {
        throw new Error("Eventi për editim nuk u gjet.");
      }

      const formData = new FormData();
      formData.append("title", eventForm.title);
      formData.append("description", eventForm.description || "");
      formData.append("event_date", eventForm.event_date || "");
      formData.append("cover_image", eventForm.cover_image || "");

      if (eventForm.cover_file) {
        formData.append("cover", eventForm.cover_file);
      }

      await authFetch(`/api/events/${editingEventId}`, {
        method: "PUT",
        body: formData,
      });

      setEventSuccess("Eventi u përditësua me sukses.");
      setIsEditingEvent(false);
      setEditingEventId(null);
      resetEventForm();
      fetchEvents();
    } catch (err) {
      setEventError(err.message || "Gabim gjatë përditësimit të eventit");
    }
  };

  const handleDeleteEvent = async (eventId) => {
    const confirmed = window.confirm(
      "A je i sigurt që dëshiron ta fshish këtë event?"
    );

    if (!confirmed) return;

    try {
      setEventError("");
      setEventSuccess("");

      await authFetch(`/api/events/${eventId}`, {
        method: "DELETE",
      });

      setEventSuccess("Eventi u fshi me sukses.");

      if (editingEventId === eventId) {
        setIsEditingEvent(false);
        setEditingEventId(null);
        resetEventForm();
      }

      fetchEvents();
    } catch (err) {
      setEventError(err.message || "Gabim gjatë fshirjes së eventit");
    }
  };

  const handleCreateAlbum = async (e) => {
    e.preventDefault();

    try {
      setAlbumError("");
      setAlbumSuccess("");

      await authFetch("/api/albums", {
        method: "POST",
        body: JSON.stringify({
          event_id: Number(albumForm.event_id),
          title: albumForm.title,
          cover_image: albumForm.cover_image || null,
        }),
      });

      setAlbumSuccess("Albumi u krijua me sukses.");

      const currentEventId = albumForm.event_id;
      setAlbumForm({
        event_id: currentEventId,
        title: "",
        cover_image: "",
      });

      fetchAlbumsByEvent(currentEventId);
    } catch (err) {
      setAlbumError(err.message || "Gabim gjatë krijimit të albumit");
    }
  };

  const handleStartEditAlbum = (album) => {
    setAlbumError("");
    setAlbumSuccess("");
    setIsEditingAlbum(true);
    setEditingAlbumId(album.id);

    setAlbumForm({
      event_id: String(album.event_id),
      title: album.title || "",
      cover_image: album.cover_image || "",
    });
  };

  const handleCancelEditAlbum = () => {
    setAlbumError("");
    setAlbumSuccess("");
    setIsEditingAlbum(false);
    setEditingAlbumId(null);

    setAlbumForm((prev) => ({
      event_id: prev.event_id,
      title: "",
      cover_image: "",
    }));
  };

  const handleUpdateAlbum = async (e) => {
    e.preventDefault();

    try {
      setAlbumError("");
      setAlbumSuccess("");

      if (!editingAlbumId) {
        throw new Error("Albumi për editim nuk u gjet.");
      }

      await authFetch(`/api/albums/${editingAlbumId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: albumForm.title,
          cover_image: albumForm.cover_image || null,
        }),
      });

      setAlbumSuccess("Albumi u përditësua me sukses.");

      const currentEventId = albumForm.event_id;

      setIsEditingAlbum(false);
      setEditingAlbumId(null);

      setAlbumForm({
        event_id: currentEventId,
        title: "",
        cover_image: "",
      });

      fetchAlbumsByEvent(currentEventId);
    } catch (err) {
      setAlbumError(err.message || "Gabim gjatë përditësimit të albumit");
    }
  };

  const handleDeleteAlbum = async (albumId) => {
    const confirmed = window.confirm(
      "A je i sigurt që dëshiron ta fshish këtë album?"
    );

    if (!confirmed) return;

    try {
      setAlbumError("");
      setAlbumSuccess("");

      await authFetch(`/api/albums/${albumId}`, {
        method: "DELETE",
      });

      setAlbumSuccess("Albumi u fshi me sukses.");

      if (editingAlbumId === albumId) {
        setIsEditingAlbum(false);
        setEditingAlbumId(null);
        setAlbumForm((prev) => ({
          event_id: prev.event_id,
          title: "",
          cover_image: "",
        }));
      }

      if (albumForm.event_id) {
        fetchAlbumsByEvent(albumForm.event_id);
      }
    } catch (err) {
      setAlbumError(err.message || "Gabim gjatë fshirjes së albumit");
    }
  };

  const handleUploadMedia = async (e) => {
    e.preventDefault();

    try {
      setUploadError("");
      setUploadSuccess("");

      if (!uploadForm.files || uploadForm.files.length === 0) {
        throw new Error("Zgjidh të paktën një file për upload.");
      }

      const formData = new FormData();
      formData.append("event_id", uploadForm.event_id);
      formData.append("album_id", uploadForm.album_id);
      formData.append("title", uploadForm.title || "");

      uploadForm.files.forEach((file) => {
        formData.append("files", file);
      });

      await authFetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      setUploadSuccess(`U ngarkuan ${uploadForm.files.length} file me sukses.`);

      const currentEventId = uploadForm.event_id;
      const currentAlbumId = uploadForm.album_id;

      setUploadForm({
        event_id: currentEventId,
        album_id: currentAlbumId,
        title: "",
        files: [],
      });

      const fileInput = document.getElementById("media-file-input");
      if (fileInput) fileInput.value = "";

      fetchUploadAlbumsByEvent(currentEventId);

      if (currentAlbumId) {
        fetchMediaByAlbum(currentAlbumId);
      }
    } catch (err) {
      setUploadError(err.message || "Gabim gjatë upload-it të medias");
    }
  };

  const handleDeleteMedia = async (mediaId) => {
    const confirmed = window.confirm(
      "A je i sigurt që dëshiron ta fshish këtë media?"
    );

    if (!confirmed) return;

    try {
      setUploadError("");
      setUploadSuccess("");

      await authFetch(`/api/media/${mediaId}`, {
        method: "DELETE",
      });

      setUploadSuccess("Media u fshi me sukses.");
      setUploadMediaList((prev) => prev.filter((item) => item.id !== mediaId));
    } catch (err) {
      setUploadError(err.message || "Gabim gjatë fshirjes së medias");
    }
  };

  const handleDeleteAllMedia = async (albumId) => {
    const confirmed = window.confirm(
      "A je i sigurt që dëshiron t'i fshish të gjitha mediat e këtij albumi?"
    );

    if (!confirmed) return;

    try {
      setUploadError("");
      setUploadSuccess("");

      await authFetch(`/api/media/album/${albumId}/delete-all`, {
        method: "DELETE",
      });

      setUploadSuccess("Të gjitha mediat u fshinë me sukses.");
      setUploadMediaList([]);

      const fileInput = document.getElementById("media-file-input");
      if (fileInput) fileInput.value = "";

      setUploadForm((prev) => ({
        ...prev,
        files: [],
        title: "",
      }));
    } catch (err) {
      setUploadError(err.message || "Gabim gjatë fshirjes së të gjitha mediave");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  const sharedProps = {
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
    editingEventId,

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
    editingAlbumId,

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
  };

  const renderPage = () => {
    if (activePage === "dashboard") {
      return (
        <DashboardPage
          events={events}
          albumsByEvent={albumsByEvent}
          uploadAlbums={uploadAlbums}
        />
      );
    }

    if (activePage === "events") {
      return <EventsPage {...sharedProps} />;
    }

    if (activePage === "albums") {
      return <AlbumsPage {...sharedProps} />;
    }

    if (activePage === "upload") {
      return <UploadPage {...sharedProps} />;
    }

    return (
      <DashboardPage
        events={events}
        albumsByEvent={albumsByEvent}
        uploadAlbums={uploadAlbums}
      />
    );
  };

  return (
    <div className="admin-shell">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <main className="admin-content">
        <Topbar handleLogout={handleLogout} />
        {renderPage()}
      </main>
    </div>
  );
}

function App() {
  const token = localStorage.getItem("token");

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/gallery/:slug" element={<PublicGalleryPage />} />
        <Route
          path="/*"
          element={
            token ? (
              <AdminApp />
            ) : (
              <LoginPage onLogin={() => window.location.reload()} />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;