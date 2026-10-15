import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import {
  MapPin,
  Navigation,
  AlertTriangle,
  ChevronRight,
  Radio,
  Activity,
  Crosshair,
  Settings,
  X,
  LifeBuoy,
} from "lucide-react-native";

import { useAuth } from "../../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { SessionSettingsSection } from "../components/SessionComponents";
import { Mono, PulsingDot } from "../components/SharedUI";
import { styles } from "../theme/styles";
import { RadarView } from "../components/RadarView";
import { MapView } from "../components/MapView";
import { fetchPodTelemetry, fetchCitizenSos, PodTelemetry, CitizenSosReport } from "../services/telemetry";

import {
  situationColors,
} from "../assets/displayConfig";

import { PodsView } from "../screens/PodsView";
import { LogView } from "../screens/LogView";


// ── Main Tab Navigator Component ──────────────────────────────────────────
export function MainTabNavigator() {
  const { user: currentUser, session: currentSession, logout, updateUser } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState("radar");
  const [selectedFloor, setSelectedFloor] = useState("-1");
  const [userPos, setUserPos] = useState({ x: 47, y: 48 });
  const [isNavigating, setIsNavigating] = useState(false);
  const [selectedVictim, setSelectedVictim] = useState("");

  const [victimsList, setVictimsList] = useState<any[]>([]);
  const [updateModalVictimId, setUpdateModalVictimId] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [rescuerEmergency, setRescuerEmergency] = useState<"trapped" | "injured" | null>(null);
  const [gatewayTelemetry, setGatewayTelemetry] = useState<PodTelemetry[]>([]);
  const [citizenSosList, setCitizenSosList] = useState<CitizenSosReport[]>([]);
  const [gatewayStatus, setGatewayStatus] = useState<"connecting" | "online" | "offline">("connecting");

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const pollTelemetry = async () => {
      try {
        const [podResult, citizenResult] = await Promise.allSettled([
          fetchPodTelemetry(),
          fetchCitizenSos(),
        ]);

        if (!active) return;

        if (podResult.status === "fulfilled") {
          setGatewayTelemetry(podResult.value);
          setGatewayStatus("online");
        } else {
          console.error("Failed to fetch gateway telemetry", podResult.reason);
          setGatewayStatus("offline");
        }

        if (citizenResult.status === "fulfilled") {
          setCitizenSosList(citizenResult.value);
        } else {
          console.error("Failed to fetch citizen SOS", citizenResult.reason);
        }
      } catch (error) {
        console.error("Error in telemetry polling cycle", error);
      }

      if (active) timer = setTimeout(pollTelemetry, 4000);
    };

    void pollTelemetry();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const addLog = (
    type: string,
    message: string,
    showToast = true,
    toastTitle = "Log Added",
    toastDesc = "Casualty log recorded successfully."
  ) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    const newLog = {
      id: `l${Date.now()}`,
      time: timeStr,
      type,
      message,
    };
    setLogs((prev) => [newLog, ...prev]);
    if (showToast) {
      toast.success(toastTitle, { description: toastDesc });
    }
  };

  const handleUpdateRescuerEmergency = (status: "trapped" | "injured" | null) => {
    setRescuerEmergency(status);
    const rescuerName = currentUser ? currentUser.name : "Rescuer";
    if (status) {
      addLog("alert", `RESCUER EMERGENCY: ${rescuerName} is ${status} on Floor ${selectedFloor}`, false);
      toast.error("SOS Alert Sent", {
        description: `Emergency alert: Rescuer is ${status} on Floor ${selectedFloor}.`,
      });
    } else {
      addLog("system", `RESCUER SOS RESOLVED: ${rescuerName} is safe`, false);
      toast.info("SOS Resolved", {
        description: "Your emergency alert has been resolved.",
      });
    }
  };

  const updateVictimSituation = (id: string, newSituation: string, newDisaster?: string) => {
    setVictimsList((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              situation: newSituation,
              ...(newDisaster ? { disasterType: newDisaster } : {}),
            }
          : v
      )
    );
  };

  const liveVictims = victimsList;

  // 1. Live SOS reports from hardware LoRa pods (or gateway)
  const podSosVictims = gatewayTelemetry
    .filter(() => gatewayStatus !== "offline")
    .filter((report) => (report.msgType === 1 || report.bleVictims > 0) && report.gatewayId !== "CITIZEN-APP-GATEWAY")
    .map((report) => {
      const hasGpsFix = report.fix && report.sats > 0 && report.lat !== null && report.lng !== null;
      const situationByStatus: Record<number, string> = {
        1: "safe",
        2: "injured",
        3: "trapped",
        4: "lost or unable to move",
      };
      return {
        id: `LIVE-${report.nodeId}`,
        label: report.nearestVictimId
          ? `SOS Pod ${report.nodeId} (${report.nearestVictimId})`
          : `SOS Pod ${report.nodeId}`,
        distance: null,
        bearing: null,
        floor: null,
        signalStrength: report.loraRssi,
        situation: situationByStatus[report.victimStatus] || "SOS",
        lastPing: "live",
        disasterType: "",
        lat: hasGpsFix ? report.lat : null,
        lng: hasGpsFix ? report.lng : null,
        hasLocation: hasGpsFix,
        hasGpsFix,
        isLive: true,
      };
    });

  // 2. Direct SOS reports from Citizen App
  const citizenSosVictims = citizenSosList.map((sos) => {
    const hasCoords = typeof sos.lat === "number" && typeof sos.lng === "number";
    return {
      id: sos.id || `SOS-${sos.clientId}`,
      label: `${sos.name || 'Citizen'} (${sos.disasterType ? sos.disasterType.toUpperCase() : 'EMERGENCY'})`,
      distance: null,
      bearing: null,
      floor: null,
      signalStrength: null,
      situation: "trapped",
      lastPing: "live beacon",
      disasterType: sos.disasterType || "Emergency",
      lat: hasCoords ? sos.lat : null,
      lng: hasCoords ? sos.lng : null,
      hasLocation: hasCoords,
      hasGpsFix: hasCoords,
      isLive: true,
    };
  });

  const liveSosVictims = [...citizenSosVictims, ...podSosVictims];

  useEffect(() => {
    if (!selectedVictim || ![...liveVictims, ...liveSosVictims].some((victim) => victim.id === selectedVictim)) {
      setSelectedVictim(liveSosVictims[0]?.id || liveVictims[0]?.id || "");
    }
  }, [selectedVictim, liveSosVictims, liveVictims]);

  const handleSelectVictim = (id: string) => {
    setSelectedVictim(id);
    const victim = [...liveVictims, ...liveSosVictims].find((v) => v.id === id);
    if (victim) {
      if (!victim.isLive) {
        const flStr = victim.floor === 0 ? "G" : String(victim.floor);
        setSelectedFloor(flStr);
      } else {
        setSelectedFloor("G");
      }
      setTab("map");
    }
  };

  const tabs = [
    { id: "radar", icon: Crosshair, label: "Radar" },
    { id: "map", icon: MapPin, label: "Map" },
    { id: "pods", icon: Radio, label: "Pods" },
    { id: "log", icon: Activity, label: "Log" },
  ];

  const showCriticalAlert = liveVictims.some((v) => v.situation === "trapped");
  const criticalVictim = liveVictims.find((v) => v.situation === "trapped");

  if (!currentUser || !currentSession) return null;

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + 8 : 12 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.row}>
            <View style={styles.headerLogoBox}>
              <Navigation size={11} color="#ffffff" style={{ transform: [{ rotate: "45deg" }] }} />
            </View>
            <Text style={styles.headerTitle}>ZamboAlert</Text>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>rescuers</Text>
            </View>
          </View>
          <View style={[styles.row, { marginTop: 4 }]}>
            <PulsingDot color={liveSosVictims.length > 0 ? "#ef4444" : "#22c55e"} />
            <Mono style={styles.headerSubtitle}>
              {liveSosVictims.length} live SOS · {gatewayTelemetry.length} pods · gateway {gatewayStatus}
            </Mono>
          </View>
        </View>
        <View style={[styles.row, { gap: 8 }]}>
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            style={styles.headerSettingsBtn}
          >
            <Settings size={16} color="#000000" />
          </TouchableOpacity>
        </View>
      </View>

      {rescuerEmergency && (
        <View style={styles.emergencyBanner}>
          <AlertTriangle size={16} color="#ffffff" />
          <Text style={styles.emergencyBannerText}>
            RESCUER EMERGENCY: {rescuerEmergency.toUpperCase()} ON FLOOR {selectedFloor}
          </Text>
        </View>
      )}

      {liveSosVictims.length > 0 && (
        <TouchableOpacity
          onPress={() => handleSelectVictim(liveSosVictims[0].id)}
          style={styles.criticalAlertBanner}
        >
          <View style={styles.row}>
            <AlertTriangle size={14} color="#ffffff" style={{ marginRight: 6 }} />
            <Mono style={styles.criticalAlertText}>
              LIVE SOS — {liveSosVictims[0].label}
              {liveSosVictims[0].hasGpsFix
                ? ""
                : liveSosVictims[0].hasLocation
                ? " · APPROXIMATE LOCATION"
                : " · LOCATION UNAVAILABLE"}
            </Mono>
          </View>
          <ChevronRight size={14} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      )}

      {showCriticalAlert && criticalVictim && (
        <TouchableOpacity
          onPress={() => handleSelectVictim(criticalVictim.id)}
          style={styles.criticalAlertBanner}
        >
          <View style={styles.row}>
            <AlertTriangle size={14} color="#ffffff" style={{ marginRight: 6 }} />
            <Mono style={styles.criticalAlertText}>
              {criticalVictim.label} TRAPPED — {criticalVictim.distance.toFixed(1)} m at {criticalVictim.bearing}°
            </Mono>
          </View>
          <ChevronRight size={14} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      )}

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {tab === "radar" && (
          <RadarView
            victims={[...liveVictims, ...liveSosVictims]}
            selected={selectedVictim}
            onSelect={handleSelectVictim}
          />
        )}
        {tab === "map" && (
          <MapView
            victims={[...liveVictims, ...liveSosVictims]}
            selectedVictim={selectedVictim}
            onSelectVictim={handleSelectVictim}
            selectedFloor={selectedFloor}
            setSelectedFloor={setSelectedFloor}
            userPos={userPos}
            setUserPos={setUserPos}
            isNavigating={isNavigating}
            setIsNavigating={setIsNavigating}
            toast={toast}
            onUpdateSituation={setUpdateModalVictimId}
            rescuerEmergency={rescuerEmergency}
            onUpdateRescuerEmergency={handleUpdateRescuerEmergency}
          />
        )}
        {tab === "pods" && (
          <PodsView
            nodes={gatewayTelemetry.map((report) => ({
              id: report.nodeId,
              rssi: report.loraRssi,
              snr: report.loraSnr,
              hops: report.hopCount,
              receivedAt: report.receivedAt,
              hasGpsFix: report.fix && report.sats > 0,
              isSos: report.msgType === 1 || report.bleVictims > 0,
              bleVictims: report.bleVictims,
              nearestVictimId: report.nearestVictimId,
              gatewayId: report.gatewayId,
            }))}
            citizenSosList={citizenSosList}
            onSelectSos={handleSelectVictim}
          />
        )}
        {tab === "log" && (
          <LogView
            log={logs}
            onAddLog={addLog}
            victims={liveVictims}
            onUpdateVictimSituation={updateVictimSituation}
            onAddNewVictim={(label, situation, disaster) => {
              const newId = `V-${(victimsList.length + 1).toString().padStart(3, "0")}`;
              const newVictim = {
                id: newId,
                label: label.toUpperCase(),
                distance: null,
                bearing: null,
                floor: null,
                signalStrength: null,
                situation: (situation || "safe") as any,
                lastPing: "just now",
                disasterType: disaster || "",
              };
              setVictimsList((prev) => [...prev, newVictim]);
              return newId;
            }}
          />
        )}
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 12 }]}>
        {tabs.map(({ id, icon: Icon, label }) => {
          const active = tab === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => setTab(id)}
              style={[
                styles.bottomNavTab,
                active ? styles.bottomNavTabActive : null,
              ]}
            >
              <Icon
                size={20}
                color={active ? "#dc2626" : "#9ca3af"}
                strokeWidth={active ? 2.5 : 1.5}
              />
              <Mono style={[styles.bottomNavText, active ? styles.textRedBold : styles.textMuted]}>
                {label}
              </Mono>
            </TouchableOpacity>
          );
        })}
      </View>

      {updateModalVictimId && (() => {
        const victim = liveVictims.find((v) => v.id === updateModalVictimId);
        if (!victim) return null;
        return (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Update Situation</Text>
              <Mono style={styles.modalSubtitle}>{victim.label} — Floor {victim.floor === 0 ? "G" : victim.floor}</Mono>
              
              <Text style={{ fontSize: 13, color: "#374151", marginBottom: 12, fontWeight: "500" }}>
                Select current condition:
              </Text>

              {Object.keys(situationColors).map((sit) => {
                const colors = situationColors[sit as keyof typeof situationColors];
                const isCurrent = victim.situation === sit;
                return (
                  <TouchableOpacity
                    key={sit}
                    onPress={() => {
                      updateVictimSituation(victim.id, sit);
                      setUpdateModalVictimId(null);
                      toast.success(`Updated ${victim.label} situation to ${sit.toUpperCase()}`);
                    }}
                    style={[
                      styles.modalOptionRow,
                      {
                        backgroundColor: isCurrent ? colors.bg : "#ffffff",
                        borderColor: isCurrent ? colors.bg : "#e5e7eb",
                      }
                    ]}
                  >
                    <View style={[styles.modalOptionDot, { backgroundColor: isCurrent ? "#ffffff" : colors.dot }]} />
                    <Text
                      style={[
                        styles.modalOptionText,
                        { color: isCurrent ? "#ffffff" : "#1f2937" }
                      ]}
                    >
                      {sit.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                onPress={() => setUpdateModalVictimId(null)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

      {showSettings && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "80%" }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Security & Profile</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <SessionSettingsSection
                currentUser={currentUser as any}
                session={currentSession}
                onLogout={logout}
                onUpdateUser={updateUser}
                toast={toast}
              />
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}
