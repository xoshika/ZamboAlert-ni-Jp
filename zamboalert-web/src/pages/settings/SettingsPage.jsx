import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Check, ArrowLeft, Compass, Settings } from "lucide-react";
import SettingsSidebar from "./SettingsSidebar";
import AccountTab from "./AccountTab";
import ActivityTab from "./ActivityTab";
import RescuersTab from "./RescuersTab";
import LocationTab from "./LocationTab";
import { apiFetch } from "../dashboard/dashboardApi";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("account");
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    role: "",
    station: "",
    joinedDate: "",
  });

  const [rules, setRules] = useState({
    requireRescuerApproval: true,
    autoDispatchOnSOS: false,
    broadcastRadius: 1500,
    allowGuestSOS: true,
  });

  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailAlerts: true,
    browserSound: true,
    highPrioritySMS: true,
    autoCallZcdrrmo: true,
    weeklyReport: false,
  });

  const handleProfileSave = (e) => {
    e.preventDefault();
    showToast("Profile updates are not connected to the backend yet.");
  };

  const handleSecuritySave = (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      alert("New password and confirm password do not match.");
      return;
    }
    showToast("Password changes are not connected to the backend yet.");
  };

  const handleToggleRule = async (key) => {
    const newValue = !rules[key];
    setRules((prev) => ({ ...prev, [key]: newValue }));

    let dbKey = key;
    if (key === "requireRescuerApproval") dbKey = "require_rescuer_approval";
    else if (key === "autoDispatchOnSOS") dbKey = "auto_dispatch_on_sos";
    else if (key === "broadcastRadius") dbKey = "broadcast_radius";
    else if (key === "allowGuestSOS") dbKey = "allow_guest_sos";

    try {
      const response = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: dbKey, value: newValue }),
      });
      if (response.ok) {
        showToast(`Rule updated: ${key} is now ${newValue ? "Enabled" : "Disabled"}.`);
      } else {
        showToast("Failed to save setting in backend.");
      }
    } catch (err) {
      console.error("Failed to save rule setting", err);
      showToast("Error updating setting in backend database.");
    }
  };

  const handleToggleNotif = (key) => {
    setNotificationSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [lat, setLat] = useState("6.9214");
  const [lng, setLng] = useState("122.0790");
  const [radius, setRadius] = useState("1200");
  const [mapType, setMapType] = useState("street");

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const tileLayerRef = useRef(null);

  useEffect(() => {
    if (activeTab !== "location" || !mapContainerRef.current) return;

    const timer = setTimeout(() => {
      if (mapRef.current) return;

      const initialLat = parseFloat(lat) || 6.9214;
      const initialLng = parseFloat(lng) || 122.0790;
      const initialRadius = parseFloat(radius) || 1200;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([initialLat, initialLng], 14);

      const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
      const mapboxStyle = mapType === "satellite" ? "satellite-streets-v12" : "streets-v12";

      const url = mapboxToken
        ? `https://api.mapbox.com/styles/v1/mapbox/${mapboxStyle}/tiles/512/{z}/{x}/{y}@2x?access_token=${mapboxToken}`
        : mapType === "satellite"
          ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

      const attribution = mapboxToken
        ? '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        : mapType === "satellite"
          ? "&copy; Esri &mdash; Satellite Imagery"
          : "&copy; OpenStreetMap contributors";

      const tileLayer = L.tileLayer(url, {
        attribution,
        maxZoom: 19,
        tileSize: mapboxToken ? 512 : 256,
        zoomOffset: mapboxToken ? -1 : 0,
      }).addTo(map);
      tileLayerRef.current = tileLayer;
      mapRef.current = map;

      const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
      markerRef.current = marker;

      const circle = L.circle([initialLat, initialLng], {
        color: "#dc2626",
        fillColor: "#fca5a5",
        fillOpacity: 0.15,
        weight: 2,
        dashArray: "5, 5",
        radius: initialRadius,
      }).addTo(map);
      circleRef.current = circle;

      map.on("click", (e) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        setLat(clickLat.toFixed(6));
        setLng(clickLng.toFixed(6));
      });

      marker.on("dragend", () => {
        const position = marker.getLatLng();
        setLat(position.lat.toFixed(6));
        setLng(position.lng.toFixed(6));
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, [activeTab]);

  useEffect(() => {
    if (!mapRef.current) return;

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedRad = parseFloat(radius);

    if (isNaN(parsedLat) || isNaN(parsedLng)) return;

    const newLatLng = [parsedLat, parsedLng];

    if (markerRef.current) {
      markerRef.current.setLatLng(newLatLng);
    }

    if (circleRef.current && !isNaN(parsedRad)) {
      circleRef.current.setLatLng(newLatLng);
      circleRef.current.setRadius(parsedRad);
    }

    mapRef.current.panTo(newLatLng);
  }, [lat, lng, radius]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
    const mapboxStyle = mapType === "satellite" ? "satellite-streets-v12" : "streets-v12";

    const url = mapboxToken
      ? `https://api.mapbox.com/styles/v1/mapbox/${mapboxStyle}/tiles/512/{z}/{x}/{y}@2x?access_token=${mapboxToken}`
      : mapType === "satellite"
        ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    const attribution = mapboxToken
      ? '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      : mapType === "satellite"
        ? "&copy; Esri &mdash; Satellite Imagery"
        : "&copy; OpenStreetMap contributors";

    const tileLayer = L.tileLayer(url, {
      attribution,
      maxZoom: 19,
      tileSize: mapboxToken ? 512 : 256,
      zoomOffset: mapboxToken ? -1 : 0,
    }).addTo(mapRef.current);
    tileLayerRef.current = tileLayer;
  }, [mapType]);

  useEffect(() => {
    const fetchBackendSettings = async () => {
      try {
        const response = await apiFetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          setRules((prev) => ({
            ...prev,
            requireRescuerApproval:
              data.requireRescuerApproval !== undefined
                ? data.requireRescuerApproval
                : prev.requireRescuerApproval,
            autoDispatchOnSOS:
              data.auto_dispatch_on_sos !== undefined
                ? data.auto_dispatch_on_sos === "1" || data.auto_dispatch_on_sos === true
                : prev.autoDispatchOnSOS,
            broadcastRadius:
              data.broadcast_radius !== undefined ? parseInt(data.broadcast_radius) : prev.broadcastRadius,
            allowGuestSOS:
              data.allow_guest_sos !== undefined
                ? data.allow_guest_sos === "1" || data.allow_guest_sos === true
                : prev.allowGuestSOS,
          }));
        }
      } catch (err) {
        console.error("Failed to fetch settings from backend", err);
      }
    };

    fetchBackendSettings();
    fetchRescuers();
  }, []);

  useEffect(() => {
    if (activeTab === "rescuers") {
      fetchRescuers();
    }
  }, [activeTab]);

  const handleLocationSave = (e) => {
    e.preventDefault();
    showToast(`Barangay Geofence configuration updated! Radius: ${radius}m.`);
  };

  const handleRecenterMap = () => {
    setLat("6.9214");
    setLng("122.0790");
    setRadius("1200");
    if (mapRef.current) {
      mapRef.current.setView([6.9214, 122.0790], 14);
    }
    showToast("Reset map to default Tumaga Barangay Hall coordinates.");
  };

  const [activitySearch, setActivitySearch] = useState("");

  const activityLogs = [];

  const filteredActivities = activityLogs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(activitySearch.toLowerCase()) ||
      log.detail.toLowerCase().includes(activitySearch.toLowerCase()) ||
      log.id.toLowerCase().includes(activitySearch.toLowerCase()) ||
      log.operator.toLowerCase().includes(activitySearch.toLowerCase());
    return matchesSearch;
  });

  const [rescuerSubTab, setRescuerSubTab] = useState("accounts");
  const [dbRescuers, setDbRescuers] = useState([]);
  const [isFetchingRescuers, setIsFetchingRescuers] = useState(false);
  const [selectedRescuerForReview, setSelectedRescuerForReview] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [accountsSearch, setAccountsSearch] = useState("");
  const [accountsFilter, setAccountsFilter] = useState("all");

  const fetchRescuers = async () => {
    setIsFetchingRescuers(true);
    try {
      const response = await apiFetch("/api/rescuers");
      if (response.ok) {
        const data = await response.json();
        setDbRescuers(data);
      }
    } catch (err) {
      console.error("Failed to fetch rescuers", err);
    } finally {
      setIsFetchingRescuers(false);
    }
  };

  const handleVerifyRescuer = async (id) => {
    try {
      const response = await apiFetch(`/api/rescuers/verify/${id}`, {
        method: "POST",
      });
      if (response.ok) {
        showToast("Rescuer verified and approved successfully.");
        fetchRescuers();
        setShowReviewModal(false);
        setSelectedRescuerForReview(null);
      } else {
        const errData = await response.json();
        alert(errData.message || "Failed to verify rescuer");
      }
    } catch (err) {
      console.error("Connection error", err);
      alert("Failed to connect to backend server");
    }
  };

  const handleRejectRescuer = async (id) => {
    if (!window.confirm("Are you sure you want to reject and delete this rescuer account request?")) {
      return;
    }
    try {
      const response = await apiFetch(`/api/rescuers/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        showToast("Rescuer registration rejected and account deleted.");
        fetchRescuers();
        setShowReviewModal(false);
        setSelectedRescuerForReview(null);
      } else {
        const errData = await response.json();
        alert(errData.message || "Failed to delete rescuer account");
      }
    } catch (err) {
      console.error("Connection error", err);
      alert("Failed to connect to backend server");
    }
  };

  const [rescuerSearch, setRescuerSearch] = useState("");
  const [rescuerFilter, setRescuerFilter] = useState("all");

  const rescuerLogs = [];

  const filteredRescuers = rescuerLogs.filter((log) => {
    const matchesSearch =
      log.unit.toLowerCase().includes(rescuerSearch.toLowerCase()) ||
      log.notes.toLowerCase().includes(rescuerSearch.toLowerCase()) ||
      log.type.toLowerCase().includes(rescuerSearch.toLowerCase());
    const matchesFilter = rescuerFilter === "all" || log.status === rescuerFilter;
    return matchesSearch && matchesFilter;
  });

  const handleLogout = () => {
    localStorage.removeItem("zamboalert_auth");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans relative antialiased">
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-[9999] bg-slate-900 border border-slate-800 text-white px-4 py-3 rounded-lg shadow-xl shadow-slate-900/20 flex items-center gap-2.5 max-w-sm animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Check size={12} strokeWidth={3} />
          </div>
          <span className="text-[11px] font-medium tracking-wide">{toastMsg}</span>
        </div>
      )}

      <header className="h-16 px-6 bg-white border-b border-slate-200 sticky top-0 z-[100] flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer border border-slate-200"
            title="Back to Tactical Dashboard"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
              <Settings size={16} />
            </div>
            <div>
              <span className="text-sm font-extrabold text-slate-900 tracking-tight leading-none block">
                System & Account Settings
              </span>
              <span className="text-[10px] font-medium text-slate-500 block mt-0.5">
                Barangay Tumaga Command Node
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Compass size={14} />
            <span>Dashboard</span>
          </button>
        </div>
      </header>

      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col md:flex-row gap-6">
        <SettingsSidebar
          profile={profile}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          handleLogout={handleLogout}
        />

        <section className="flex-1 flex flex-col min-w-0">
          <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5 flex-grow flex flex-col min-h-[550px]">
            <div className="flex-grow flex flex-col">
              {activeTab === "account" && (
                <AccountTab
                  profile={profile}
                  setProfile={setProfile}
                  rules={rules}
                  handleToggleRule={handleToggleRule}
                  passwords={passwords}
                  setPasswords={setPasswords}
                  handleProfileSave={handleProfileSave}
                  handleSecuritySave={handleSecuritySave}
                  notificationSettings={notificationSettings}
                  handleToggleNotif={handleToggleNotif}
                />
              )}

              {activeTab === "activity" && (
                <ActivityTab
                  activitySearch={activitySearch}
                  setActivitySearch={setActivitySearch}
                  filteredActivities={filteredActivities}
                  activityLogs={activityLogs}
                />
              )}

              {activeTab === "rescuers" && (
                <RescuersTab
                  dbRescuers={dbRescuers}
                  isFetchingRescuers={isFetchingRescuers}
                  fetchRescuers={fetchRescuers}
                  showToast={showToast}
                  rescuerSubTab={rescuerSubTab}
                  setRescuerSubTab={setRescuerSubTab}
                  accountsSearch={accountsSearch}
                  setAccountsSearch={setAccountsSearch}
                  accountsFilter={accountsFilter}
                  setAccountsFilter={setAccountsFilter}
                  rescuerSearch={rescuerSearch}
                  setRescuerSearch={setRescuerSearch}
                  rescuerFilter={rescuerFilter}
                  setRescuerFilter={setRescuerFilter}
                  handleVerifyRescuer={handleVerifyRescuer}
                  handleRejectRescuer={handleRejectRescuer}
                  filteredRescuers={filteredRescuers}
                  selectedRescuerForReview={selectedRescuerForReview}
                  setSelectedRescuerForReview={setSelectedRescuerForReview}
                  showReviewModal={showReviewModal}
                  setShowReviewModal={setShowReviewModal}
                />
              )}

              {activeTab === "location" && (
                <LocationTab
                  lat={lat}
                  setLat={setLat}
                  lng={lng}
                  setLng={setLng}
                  radius={radius}
                  setRadius={setRadius}
                  mapType={mapType}
                  setMapType={setMapType}
                  mapContainerRef={mapContainerRef}
                  handleLocationSave={handleLocationSave}
                  handleRecenterMap={handleRecenterMap}
                />
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-slate-200/50 py-3 text-center text-[9px] text-slate-400 font-mono select-none">
        ZamboAlert Command Portal v2.0-Alpha • Barangay Tumaga Safety Operations • Developed for Emergency Services
      </footer>
    </div>
  );
}
