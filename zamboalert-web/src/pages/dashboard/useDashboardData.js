import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart2,
  ClipboardList,
  Compass,
  Home,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { INITIAL_ALERTS, INITIAL_RESCUERS, useNow } from "./dashboardData";
import { apiFetch, fetchCitizenSos, fetchTelemetry } from "./dashboardApi";

export function useDashboardData() {
  const navigate = useNavigate();
  const now = useNow();

  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [rescuers, setRescuers] = useState(INITIAL_RESCUERS);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [dispatchTarget, setDispatchTarget] = useState(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showCallRescuerModal, setShowCallRescuerModal] = useState(false);
  const [activeTab, setActiveTab] = useState("map");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [casualtyLogs, setCasualtyLogs] = useState([]);
  const [selectedCasualtyId, setSelectedCasualtyId] = useState(null);
  const [isFetchingCasualties, setIsFetchingCasualties] = useState(false);

  const [households, setHouseholds] = useState([]);
  const [isFetchingHouseholds, setIsFetchingHouseholds] = useState(false);

  const [incidents, setIncidents] = useState([]);
  const [isFetchingIncidents, setIsFetchingIncidents] = useState(false);
  const [pods, setPods] = useState([]);

  const [isFetchingRescuers, setIsFetchingRescuers] = useState(false);
  const [flashCount, setFlashCount] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionUser, setSessionUser] = useState("");
  const [sessionRemaining, setSessionRemaining] = useState(0);

  useEffect(() => {
    const sessionData = localStorage.getItem("zamboalert_auth");
    if (!sessionData) {
      navigate("/login");
      return;
    }

    try {
      const { user, expiry } = JSON.parse(sessionData);
      if (Date.now() > expiry) {
        localStorage.removeItem("zamboalert_auth");
        navigate("/login");
        return;
      }

      setIsAuthenticated(true);
      setSessionUser(user || "Barangay Admin");
      setSessionRemaining(Math.round((expiry - Date.now()) / 1000));

      const timer = setInterval(() => {
        const remaining = Math.round((expiry - Date.now()) / 1000);
        if (remaining <= 0) {
          clearInterval(timer);
          localStorage.removeItem("zamboalert_auth");
          navigate("/login");
        } else {
          setSessionRemaining(remaining);
        }
      }, 1000);

      return () => clearInterval(timer);
    } catch (error) {
      localStorage.removeItem("zamboalert_auth");
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    const tick = setInterval(() => setFlashCount((count) => count + 1), 800);
    return () => clearInterval(tick);
  }, []);

  const fetchCasualtyLogs = async () => {
    setIsFetchingCasualties(true);
    try {
      const res = await apiFetch("/api/logs/casualties");
      if (res.ok) {
        const data = await res.json();
        setCasualtyLogs(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsFetchingCasualties(false);
    }
  };

  const fetchRescuers = async () => {
    setIsFetchingRescuers(true);
    try {
      const res = await apiFetch("/api/rescuers");
      if (res.ok) {
        const data = await res.json();
        const mapped = data.map((rescuer) => ({
          id: rescuer.id_number || `R-${rescuer.id}`,
          dbId: rescuer.id,
          name: `${rescuer.first_name} ${rescuer.last_name}`,
          email: rescuer.email,
          unit: rescuer.phone_number || "Barangay Volunteer",
          idType: rescuer.id_type,
          idNumber: rescuer.id_number,
          isVerified: rescuer.is_verified === 1,
          status: rescuer.is_verified === 1 ? rescuer.status : "offline",
          role: rescuer.role || (rescuer.id_type?.toLowerCase().includes("tanod") ? "Tanod" : "Rescuer"),
          assignedZone: rescuer.assigned_zone || "Unassigned",
          lat: rescuer.latitude ? `${rescuer.latitude.toFixed(4)}° N` : "6.9220° N",
          lng: rescuer.longitude ? `${rescuer.longitude.toFixed(4)}° E` : "122.0800° E",
          battery: rescuer.is_verified === 1 ? 95 : 0,
          lastPing: rescuer.is_verified === 1 ? "Just now" : "--",
          assignedTargetType: rescuer.assigned_target_type || null,
          assignedTargetId: rescuer.assigned_target_id || null,
          assignedTargetName: rescuer.assigned_target_name || null,
          assignedAlert: rescuer.assigned_target_type === "alert" ? rescuer.assigned_target_id : null,
        }));
        setRescuers(mapped);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsFetchingRescuers(false);
    }
  };

  const fetchHouseholds = async () => {
    setIsFetchingHouseholds(true);
    try {
      const res = await apiFetch("/api/households");
      if (res.ok) {
        const data = await res.json();
        setHouseholds(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsFetchingHouseholds(false);
    }
  };

  const fetchIncidents = async () => {
    setIsFetchingIncidents(true);
    try {
      const res = await apiFetch("/api/incidents");
      if (res.ok) {
        const data = await res.json();
        setIncidents(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsFetchingIncidents(false);
    }
  };

  const fetchPods = async () => {
    try {
      const response = await fetchTelemetry();
      if (!response.ok) throw new Error(`Pod telemetry request failed: ${response.status}`);
      setPods(await response.json());
    } catch (error) {
      console.error("Failed to fetch pod telemetry", error);
    }
  };

  const fetchLiveCitizenSos = async () => {
    try {
      const response = await fetchCitizenSos();
      if (!response.ok) throw new Error(`Citizen SOS request failed: ${response.status}`);
      const reports = await response.json();
      if (!Array.isArray(reports)) return;

      setAlerts((previous) => {
        const localOverrides = new Map(
          previous
            .filter((alert) => alert.status === "assigned" || alert.status === "resolved")
            .map((alert) => [alert.id, alert]),
        );

        return reports.map((report) => {
          const id = report.id || `SOS-${report.clientId}`;
          const prior = localOverrides.get(id);
          const received = report.receivedAt ? new Date(report.receivedAt) : new Date();
          const disaster = (report.disasterType || "emergency").toUpperCase();
          return {
            id,
            clientId: report.clientId,
            name: report.name || "Citizen SOS",
            lat: report.lat,
            lng: report.lng,
            latitude: report.lat,
            longitude: report.lng,
            status: prior?.status || "unassigned",
            assignedTo: prior?.assignedTo,
            time: received.toLocaleTimeString("en-PH", { hour12: false }),
            zone: disaster,
            message: `${disaster} distress — phone GPS`,
            battery: "--",
          };
        });
      });
    } catch (error) {
      console.error("Failed to fetch citizen SOS", error);
    }
  };

  useEffect(() => {
    fetchCasualtyLogs();
    fetchRescuers();
    fetchHouseholds();
    fetchIncidents();
    fetchPods();
    fetchLiveCitizenSos();

    const interval = setInterval(() => {
      fetchCasualtyLogs();
      fetchRescuers();
      fetchHouseholds();
      fetchIncidents();
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchPods();
      fetchLiveCitizenSos();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("zamboalert_auth");
    navigate("/login");
  };

  const handleDispatch = async (rescuerId, targetType, targetId, targetName) => {
    try {
      const response = await apiFetch("/api/rescuers/dispatch", {
        method: "POST",
        body: JSON.stringify({ rescuerId, targetType, targetId, targetName }),
      });

      if (response.ok) {
        if (targetType === "alert") {
          setAlerts((prev) =>
            prev.map((alert) =>
              alert.id === targetId ? { ...alert, status: "assigned", assignedTo: rescuerId } : alert,
            ),
          );
        }

        fetchRescuers();
        setDispatchTarget(null);
      }
    } catch (error) {
      console.error("Failed to dispatch rescuer", error);
    }
  };

  const handleResolve = (alertId) => {
    setAlerts((prev) => prev.map((alert) => (alert.id === alertId ? { ...alert, status: "resolved" } : alert)));
  };

  const unassignedAlerts = alerts.filter((alert) => alert.status === "unassigned");
  const pendingApprovals = rescuers.filter((rescuer) => !rescuer.isVerified);

  const navGroups = useMemo(
    () => [
      {
        title: "TACTICAL OPERATIONS",
        items: [
          { id: "map", label: "Tactical Map", icon: Compass },
          { id: "alerts", label: "SOS Stream", icon: AlertTriangle, badge: unassignedAlerts.length },
          { id: "victims", label: "Victims DB", icon: ClipboardList, count: casualtyLogs.length },
        ],
      },
      {
        title: "COMMUNITY & UNITS",
        items: [
          { id: "residents", label: "Residents", icon: Home },
          { id: "units", label: "Units & Tanods", icon: Users },
          { id: "personnel", label: "Personnel Alert", icon: ShieldAlert },
        ],
      },
      {
        title: "SYSTEM & INTELLIGENCE",
        items: [
          { id: "reports", label: "Reports & Analytics", icon: BarChart2 },
          { id: "approvals", label: "Approvals", icon: ShieldCheck, badge: pendingApprovals.length },
          { id: "settings", label: "Settings", icon: Settings },
        ],
      },
    ],
    [casualtyLogs.length, pendingApprovals.length, unassignedAlerts.length],
  );

  return {
    now,
    alerts,
    setAlerts,
    rescuers,
    setRescuers,
    casualtyLogs,
    setCasualtyLogs,
    households,
    setHouseholds,
    incidents,
    setIncidents,
    pods,
    selectedAlert,
    setSelectedAlert,
    selectedCasualtyId,
    setSelectedCasualtyId,
    dispatchTarget,
    setDispatchTarget,
    showBroadcast,
    setShowBroadcast,
    showCallRescuerModal,
    setShowCallRescuerModal,
    activeTab,
    setActiveTab,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    isAuthenticated,
    sessionUser,
    sessionRemaining,
    isFetchingCasualties,
    isFetchingHouseholds,
    isFetchingIncidents,
    isFetchingRescuers,
    flashCount,
    handleLogout,
    handleDispatch,
    handleResolve,
    fetchCasualtyLogs,
    fetchHouseholds,
    fetchRescuers,
    fetchIncidents,
    navGroups,
    pendingApprovals,
    unassignedAlerts,
  };
}
