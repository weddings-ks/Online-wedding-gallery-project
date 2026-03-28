import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo } from "react";
import "./styles/app.css";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";

import DashboardPage from "./pages/DashboardPage";
import EventsPage from "./pages/EventsPage";
import AlbumsPage from "./pages/AlbumsPage";
import UploadPage from "./pages/UploadPage";
import LoginPage from "./pages/LoginPage";
import PublicGalleryPage from "./pages/PublicGalleryPage";
import TenantSettingsPage from "./pages/TenantSettingsPage";
import GuestUploadPage from "./pages/GuestUploadPage";

const API_BASE = import.meta.env.VITE_API_URL;
const UPLOAD_BATCH_SIZE = 25;
const MAX_UPLOAD_FILES = 500;

function chunkFiles(files, size) {
  const chunks = [];
  for (let i = 0; i < files.length; i += size) {
    chunks.push(files.slice(i, i + size));
  }
  return chunks;
}

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
  const [loadingMoreUploadMedia, setLoadingMoreUploadMedia] = useState(false);
  const [uploadMediaPage, setUploadMediaPage] = useState(1);
  const [uploadMediaHasMore, setUploadMediaHasMore] = useState(false);
  const [uploadMediaTotal, setUploadMediaTotal] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [uploadProgressCurrent, setUploadProgressCurrent] = useState(0);
  const [uploadProgressTotal, setUploadProgressTotal] = useState(0);

  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    event_date: "",
    cover_image: "",
    cover_file: null,
    client_name: "",
    gallery_password: "",
    allow_event_download: true,
    event_download_limit: 2,
    album_download_limit: 2
  });

  const [albumForm, setAlbumForm] = useState({
    event_id: "",
    title: "",
    cover_image: null,
    cover_image_url: ""
  });

  const [uploadForm, setUploadForm] = useState({
    event_id: "",
    album_id: "",
    title: "",
    files: []
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
        ...(options.headers || {})
      }
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
        ...(options.headers || {})
      }
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

  const resetEventForm = useCallback(() => {
    setEventForm({
      title: "",
      description: "",
      event_date: "",
      cover_image: "",
      cover_file: null,
      client_name: "",
      gallery_password: "",
      allow_event_download: true,
      event_download_limit: 2,
      album_download_limit: 2
    });

    const coverInput = document.getElementById("event-cover-file");
    if (coverInput) coverInput.value = "";
  }, []);

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
          method: "GET"
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
          method: "GET"
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
    async (albumId, page = 1, append = false) => {
      if (!albumId) {
        setUploadMediaList([]);
        setUploadMediaPage(1);
        setUploadMediaHasMore(false);
        setUploadMediaTotal(0);
        return;
      }

      try {
        if (page === 1 && !append) {
          setLoadingUploadMedia(true);
        } else {
          setLoadingMoreUploadMedia(true);
        }

        setUploadError("");

        const data = await publicFetch(
          `/api/media/album/${albumId}?page=${page}&limit=24`,
          {
            method: "GET"
          }
        );

        const mediaList = Array.isArray(data?.media) ? data.media : [];

        setUploadMediaList((prev) =>
          append ? [...prev, ...mediaList] : mediaList
        );
        setUploadMediaPage(data?.page || page);
        setUploadMediaHasMore(Boolean(data?.hasMore));
        setUploadMediaTotal(Number(data?.total || 0));
      } catch (err) {
        setUploadError(err.message || "Gabim gjatë marrjes së medias");

        if (!append) {
          setUploadMediaList([]);
          setUploadMediaPage(1);
          setUploadMediaHasMore(false);
          setUploadMediaTotal(0);
        }
      } finally {
        setLoadingUploadMedia(false);
        setLoadingMoreUploadMedia(false);
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
      setUploadMediaPage(1);
      setUploadMediaHasMore(false);
      setUploadMediaTotal(0);
    } else {
      setUploadAlbums([]);
      setUploadForm((prev) => ({ ...prev, album_id: "" }));
      setUploadMediaList([]);
      setUploadMediaPage(1);
      setUploadMediaHasMore(false);
      setUploadMediaTotal(0);
    }
  }, [uploadForm.event_id, fetchUploadAlbumsByEvent]);

  const handleEventFormChange = useCallback((e) => {
    const { name, value, files, type, checked } = e.target;

    if (type === "file") {
      setEventForm((prev) => ({
        ...prev,
        [name]: files && files[0] ? files[0] : null
      }));
      return;
    }

    if (type === "checkbox") {
      setEventForm((prev) => ({
        ...prev,
        [name]: checked
      }));
      return;
    }

    setEventForm((prev) => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleAlbumFormChange = useCallback((e) => {
    const { name, value, files, type } = e.target;

    setAlbumForm((prev) => ({
      ...prev,
      [name]: type === "file" ? files?.[0] || null : value
    }));
  }, []);

  const handleUploadChange = useCallback(
    (e) => {
      const { name, value } = e.target;

      setUploadForm((prev) => ({
        ...prev,
        [name]: value
      }));

      if (name === "event_id") {
        setUploadMediaList([]);
        setUploadMediaPage(1);
        setUploadMediaHasMore(false);
        setUploadMediaTotal(0);
      }

      if (name === "album_id") {
        if (value) {
          fetchMediaByAlbum(value, 1, false);
        } else {
          setUploadMediaList([]);
          setUploadMediaPage(1);
          setUploadMediaHasMore(false);
          setUploadMediaTotal(0);
        }
      }
    },
    [fetchMediaByAlbum]
  );

  const handleFileChange = useCallback((e) => {
    const files = Array.from(e.target.files || []);

    setUploadError("");
    setUploadSuccess("");

    if (files.length > MAX_UPLOAD_FILES) {
      setUploadError(
        `Maksimumi i lejuar është ${MAX_UPLOAD_FILES} file për një upload.`
      );
      e.target.value = "";
      return;
    }

    setUploadForm((prev) => ({
      ...prev,
      files
    }));
  }, []);

  const handleCreateEvent = async (e) => {
    e.preventDefault();

    try {
      setEventError("");
      setEventSuccess("");

      const formData = new FormData();
      formData.append("title", eventForm.title);
      formData.append("description", eventForm.description || "");
      formData.append("event_date", eventForm.event_date || "");
      formData.append("cover_image_url", eventForm.cover_image || "");
      formData.append("client_name", eventForm.client_name || "");
      formData.append("gallery_password", eventForm.gallery_password || "");
      formData.append(
        "allow_event_download",
        String(eventForm.allow_event_download)
      );
      formData.append(
        "event_download_limit",
        String(eventForm.event_download_limit ?? 2)
      );
      formData.append(
        "album_download_limit",
        String(eventForm.album_download_limit ?? 2)
      );

      if (eventForm.cover_file) {
        formData.append("cover", eventForm.cover_file);
      }

      await authFetch("/api/events", {
        method: "POST",
        body: formData
      });

      setEventSuccess("Eventi u krijua me sukses.");
      resetEventForm();
      await fetchEvents();
    } catch (err) {
      setEventError(err.message || "Gabim gjatë krijimit të eventit");
    }
  };

  const handleStartEditEvent = useCallback((event) => {
    setEventError("");
    setEventSuccess("");
    setIsEditingEvent(true);
    setEditingEventId(event.id);

    setEventForm({
      title: event.title || "",
      description: event.description || "",
      event_date: event.event_date ? String(event.event_date).split("T")[0] : "",
      cover_image: event.cover_image || event.cover_image_url || "",
      cover_file: null,
      client_name: event.client_name || "",
      gallery_password: event.gallery_password || "",
      allow_event_download: event.allow_event_download ?? true,
      event_download_limit: event.event_download_limit ?? 2,
      album_download_limit: event.album_download_limit ?? 2
    });

    const coverInput = document.getElementById("event-cover-file");
    if (coverInput) coverInput.value = "";
  }, []);

  const handleCancelEditEvent = useCallback(() => {
    setEventError("");
    setEventSuccess("");
    setIsEditingEvent(false);
    setEditingEventId(null);
    resetEventForm();
  }, [resetEventForm]);

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
      formData.append("cover_image_url", eventForm.cover_image || "");
      formData.append("client_name", eventForm.client_name || "");
      formData.append("gallery_password", eventForm.gallery_password || "");
      formData.append(
        "allow_event_download",
        String(eventForm.allow_event_download)
      );
      formData.append(
        "event_download_limit",
        String(eventForm.event_download_limit ?? 2)
      );
      formData.append(
        "album_download_limit",
        String(eventForm.album_download_limit ?? 2)
      );

      if (eventForm.cover_file) {
        formData.append("cover", eventForm.cover_file);
      }

      await authFetch(`/api/events/${editingEventId}`, {
        method: "PUT",
        body: formData
      });

      setEventSuccess("Eventi u përditësua me sukses.");
      setIsEditingEvent(false);
      setEditingEventId(null);
      resetEventForm();
      await fetchEvents();
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
        method: "DELETE"
      });

      setEventSuccess("Eventi u fshi me sukses.");

      if (editingEventId === eventId) {
        setIsEditingEvent(false);
        setEditingEventId(null);
        resetEventForm();
      }

      await fetchEvents();
    } catch (err) {
      setEventError(err.message || "Gabim gjatë fshirjes së eventit");
    }
  };

  const handleToggleAutoDelete = async (eventId, enabled) => {
    try {
      setEventError("");
      setEventSuccess("");

      await authFetch(`/api/events/${eventId}/auto-delete`, {
        method: "PATCH",
        body: JSON.stringify({
          auto_delete_enabled: enabled
        })
      });

      setEventSuccess(
        enabled
          ? "Auto delete u aktivizua me sukses."
          : "Auto delete u çaktivizua me sukses."
      );

      await fetchEvents();
    } catch (err) {
      setEventError(err.message || "Gabim gjatë përditësimit të auto delete");
    }
  };

  const handleCreateAlbum = async (e) => {
    e.preventDefault();

    try {
      setAlbumError("");
      setAlbumSuccess("");

      const formData = new FormData();
      formData.append("event_id", albumForm.event_id);
      formData.append("title", albumForm.title);

      if (albumForm.cover_image) {
        formData.append("cover_image", albumForm.cover_image);
      }

      await authFetch("/api/albums", {
        method: "POST",
        body: formData
      });

      setAlbumSuccess("Albumi u krijua me sukses.");

      const currentEventId = albumForm.event_id;
      setAlbumForm({
        event_id: currentEventId,
        title: "",
        cover_image: null,
        cover_image_url: ""
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
      cover_image: null,
      cover_image_url: album.cover_image_url || ""
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
      cover_image: null,
      cover_image_url: ""
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

      const formData = new FormData();
      formData.append("title", albumForm.title);

      if (albumForm.cover_image) {
        formData.append("cover_image", albumForm.cover_image);
      }

      await authFetch(`/api/albums/${editingAlbumId}`, {
        method: "PUT",
        body: formData
      });

      setAlbumSuccess("Albumi u përditësua me sukses.");

      const currentEventId = albumForm.event_id;

      setIsEditingAlbum(false);
      setEditingAlbumId(null);

      setAlbumForm({
        event_id: currentEventId,
        title: "",
        cover_image: null,
        cover_image_url: ""
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
        method: "DELETE"
      });

      setAlbumSuccess("Albumi u fshi me sukses.");

      if (editingAlbumId === albumId) {
        setIsEditingAlbum(false);
        setEditingAlbumId(null);
        setAlbumForm((prev) => ({
          event_id: prev.event_id,
          title: "",
          cover_image: null,
          cover_image_url: ""
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
      setUploadingMedia(true);

      if (!uploadForm.event_id || !uploadForm.album_id) {
        throw new Error("Zgjidh eventin dhe albumin para upload-it.");
      }

      if (!uploadForm.files || uploadForm.files.length === 0) {
        throw new Error("Zgjidh të paktën një file për upload.");
      }

      if (uploadForm.files.length > MAX_UPLOAD_FILES) {
        throw new Error(
          `Maksimumi i lejuar është ${MAX_UPLOAD_FILES} file për një upload.`
        );
      }

      const allFiles = [...uploadForm.files];
      const batches = chunkFiles(allFiles, UPLOAD_BATCH_SIZE);
      const totalFiles = allFiles.length;

      setUploadProgressTotal(totalFiles);
      setUploadProgressCurrent(0);
      setUploadProgressText(
        `Po përgatitet upload-i i ${totalFiles} file-ve...`
      );

      let uploadedCount = 0;
      let failedCount = 0;
      const failedBatchMessages = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const formData = new FormData();

        formData.append("event_id", uploadForm.event_id);
        formData.append("album_id", uploadForm.album_id);
        formData.append("title", uploadForm.title || "");

        batch.forEach((file) => {
          formData.append("files", file);
        });

        setUploadProgressText(
          `Batch ${i + 1}/${batches.length} - po ngarkohen ${batch.length} file...`
        );

        try {
          await authFetch("/api/media/upload", {
            method: "POST",
            body: formData
          });

          uploadedCount += batch.length;
          setUploadProgressCurrent(uploadedCount);
          setUploadProgressText(
            `U ngarkuan ${uploadedCount}/${totalFiles} file`
          );
        } catch (batchError) {
          failedCount += batch.length;
          failedBatchMessages.push(
            `Batch ${i + 1} dështoi: ${batchError.message || "Gabim i panjohur"}`
          );

          setUploadProgressText(
            `Gabim në batch ${i + 1}. Vazhdon me batch tjetër...`
          );
        }
      }

      const currentEventId = uploadForm.event_id;
      const currentAlbumId = uploadForm.album_id;

      setUploadForm({
        event_id: currentEventId,
        album_id: currentAlbumId,
        title: "",
        files: []
      });

      const fileInput = document.getElementById("media-file-input");
      if (fileInput) fileInput.value = "";

      await fetchUploadAlbumsByEvent(currentEventId);

      if (currentAlbumId) {
        await fetchMediaByAlbum(currentAlbumId, 1, false);
      }

      if (uploadedCount > 0 && failedCount === 0) {
        setUploadSuccess(`U ngarkuan ${uploadedCount} file me sukses.`);
      } else if (uploadedCount > 0 && failedCount > 0) {
        setUploadSuccess(
          `U ngarkuan ${uploadedCount} file me sukses, ndërsa ${failedCount} dështuan.`
        );
        setUploadError(failedBatchMessages.join(" | "));
      } else {
        throw new Error(
          failedBatchMessages.join(" | ") || "Asnjë file nuk u ngarkua."
        );
      }
    } catch (err) {
      setUploadError(err.message || "Gabim gjatë upload-it të medias");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleLoadMoreMedia = useCallback(() => {
    if (
      !uploadForm.album_id ||
      !uploadMediaHasMore ||
      loadingMoreUploadMedia ||
      loadingUploadMedia
    ) {
      return;
    }

    fetchMediaByAlbum(uploadForm.album_id, uploadMediaPage + 1, true);
  }, [
    uploadForm.album_id,
    uploadMediaHasMore,
    loadingMoreUploadMedia,
    loadingUploadMedia,
    fetchMediaByAlbum,
    uploadMediaPage
  ]);

  const handleDeleteMedia = async (mediaId) => {
    const confirmed = window.confirm(
      "A je i sigurt që dëshiron ta fshish këtë media?"
    );

    if (!confirmed) return;

    try {
      setUploadError("");
      setUploadSuccess("");

      await authFetch(`/api/media/${mediaId}`, {
        method: "DELETE"
      });

      setUploadSuccess("Media u fshi me sukses.");
      setUploadMediaList((prev) => prev.filter((item) => item.id !== mediaId));
      setUploadMediaTotal((prev) => Math.max(prev - 1, 0));
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

      await authFetch(`/api/media/album/${albumId}/all`, {
        method: "DELETE"
      });

      setUploadSuccess("Të gjitha mediat u fshinë me sukses.");
      setUploadMediaList([]);
      setUploadMediaPage(1);
      setUploadMediaHasMore(false);
      setUploadMediaTotal(0);

      const fileInput = document.getElementById("media-file-input");
      if (fileInput) fileInput.value = "";

      setUploadForm((prev) => ({
        ...prev,
        files: [],
        title: ""
      }));
    } catch (err) {
      setUploadError(err.message || "Gabim gjatë fshirjes së të gjitha mediave");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    window.location.href = "/";
  };

  const sharedProps = useMemo(
    () => ({
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
      handleToggleAutoDelete,
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
      loadingMoreUploadMedia,
      uploadMediaHasMore,
      uploadMediaTotal,
      uploadError,
      uploadSuccess,
      uploadingMedia,
      uploadProgressText,
      uploadProgressCurrent,
      uploadProgressTotal,
      uploadForm,
      handleUploadChange,
      handleFileChange,
      handleUploadMedia,
      handleDeleteMedia,
      handleDeleteAllMedia,
      handleLoadMoreMedia
    }),
    [
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
      handleToggleAutoDelete,
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
      loadingMoreUploadMedia,
      uploadMediaHasMore,
      uploadMediaTotal,
      uploadError,
      uploadSuccess,
      uploadingMedia,
      uploadProgressText,
      uploadProgressCurrent,
      uploadProgressTotal,
      uploadForm,
      handleUploadChange,
      handleFileChange,
      handleUploadMedia,
      handleDeleteMedia,
      handleDeleteAllMedia,
      handleLoadMoreMedia
    ]
  );

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

    if (activePage === "tenant-settings") {
      return <TenantSettingsPage />;
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
        <Route path="/guest-upload/:slug" element={<GuestUploadPage />} />
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