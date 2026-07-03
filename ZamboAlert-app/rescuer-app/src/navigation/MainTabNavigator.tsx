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

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { SessionSettingsSection } from "../components/SessionComponents";
import { Mono, PulsingDot } from "../components/SharedUI";
import { styles } from "../theme/styles";
import { RadarView } from "../components/RadarView";
import { MapView } from "../components/MapView";

import {
  VICTIMS,
  VICTIM_COORDS,
  MESH_NODES,
  LOG,
  situationColors,
  podStatusColors,
  logTypeColors,
  roleColors,
} from "../assets/mockData";

// ── Pods View ─────────────────────────────────────────────────────────────
function PodsView({ nodes }: { nodes: any[] }) {
  const connected = nodes.filter((n) => n.status === "connected").length;
  const syncing = nodes.filter((n) => n.status === "syncing").length;
  const offline = nodes.filter((n) => n.status === "offline").length;

  return (
    <View style={styles.viewContainer}>
      <View style={styles.podsOverviewGrid}>
        {[
          { label: "ONLINE", value: connected, color: "#000000" },
          { label: "SYNCING", value: syncing, color: "#dc2626" },
          { label: "OFFLINE", value: offline, color: "#9ca3af" },
        ].map(({ label, value, color }) => (
          <View key={label} style={styles.podsOverviewCard}>
            <Mono style={[styles.podsOverviewVal, { color }]}>{value}</Mono>
            <Mono style={styles.podsOverviewLabel}>{label}</Mono>
          </View>
        ))}
      </View>

      <View style={styles.listContainer}>
        {nodes.map((node) => {
          const s = podStatusColors[node.status as keyof typeof podStatusColors];
          const isCriticalBattery = node.battery < 20;

          let batteryBarColor = "#22c55e";
          let batteryTextColor = "#000000";
          if (node.battery < 20) {
            batteryBarColor = "#ef4444";
            batteryTextColor = "#dc2626";
          } else if (node.battery < 50) {
            batteryBarColor = "#eab308";
            batteryTextColor = "#ca8a04";
          }

          let signalBarColor = "#000000";
          if (node.signal <= 40) {
            signalBarColor = "#ef4444";
          } else if (node.signal <= 70) {
            signalBarColor = "#eab308";
          }

          const roleColorsConfig = roleColors[node.role as keyof typeof roleColors];

          return (
            <View
              key={node.id}
              style={[
                styles.podCard,
                node.status === "offline" ? styles.podCardOffline : null,
              ]}
            >
              <View style={styles.podCardHeader}>
                <View style={styles.podCardLeft}>
                  <PulsingDot color={s.dot} />
                  <View style={styles.podCardMeta}>
                    <Mono style={styles.podCardTitle}>{node.name}</Mono>
                    <Mono style={styles.podCardSubText}>{node.location}</Mono>
                  </View>
                </View>
                <View
                  style={[
                    styles.miniBadge,
                    { backgroundColor: roleColorsConfig.bg, paddingHorizontal: 8 },
                  ]}
                >
                  <Text style={[styles.miniBadgeText, { color: roleColorsConfig.text }]}>
                    {node.role.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.podStatsRow}>
                <View style={styles.podStatCol}>
                  <Text style={styles.podStatLabel}>Battery</Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { backgroundColor: batteryBarColor, width: `${node.battery}%` },
                      ]}
                    />
                  </View>
                  <Mono style={[styles.podStatVal, { color: batteryTextColor }]}>
                    {node.battery}%
                  </Mono>
                </View>

                <View style={styles.podStatCol}>
                  <Text style={styles.podStatLabel}>Signal</Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { backgroundColor: signalBarColor, width: `${node.signal}%` },
                      ]}
                    />
                  </View>
                  <Mono style={styles.podStatVal}>{node.signal}%</Mono>
                </View>

                <View style={styles.podStatCol}>
                  <Text style={styles.podStatLabel}>Hops</Text>
                  <Mono style={styles.hopsVal}>{node.hops}</Mono>
                </View>
              </View>

              {isCriticalBattery && (
                <View style={styles.podAlertBanner}>
                  <AlertTriangle size={12} color="#dc2626" />
                  <Mono style={styles.podAlertText}>Critical battery — replace pod soon</Mono>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Log View ───────────────────────────────────────────────────────────────
function LogView({
  log,
  onAddLog,
}: {
  log: any[];
  onAddLog: (type: string, message: string) => void;
}) {
  const [casualtyCount, setCasualtyCount] = useState("");
  const [disasterType, setDisasterType] = useState<"Earthquake" | "Fire" | "Flood" | "Landslide" | "">("");

  const handleLog = () => {
    if (!disasterType || !casualtyCount) return;
    onAddLog("alert", `Casualties recorded for ${disasterType}: ${casualtyCount}`);
    setCasualtyCount("");
    setDisasterType("");
  };

  return (
    <View style={styles.viewContainer}>
      <View style={styles.logActionCard}>
        <Text style={styles.sectionTitle}>Record Casualties</Text>
        <View style={styles.disasterButtons}>
          {(["Earthquake", "Fire", "Flood", "Landslide"] as const).map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.disasterBtn, disasterType === d && styles.disasterBtnActive]}
              onPress={() => setDisasterType(d)}
            >
              <Text style={[styles.disasterBtnText, disasterType === d && styles.disasterBtnTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Number of casualties"
          placeholderTextColor="#666"
          keyboardType="numeric"
          value={casualtyCount}
          onChangeText={setCasualtyCount}
        />
        <TouchableOpacity style={styles.submitLogBtn} onPress={handleLog}>
          <Text style={styles.submitLogBtnText}>Submit Log</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listContainer}>
        {log.map((entry) => {
          const t = logTypeColors[entry.type as keyof typeof logTypeColors];
          return (
            <View key={entry.id} style={styles.logCard}>
              <View style={styles.logCardHeader}>
                <Text style={[styles.logCardLabel, { color: t.color }]}>{t.label}</Text>
                <Mono style={styles.logCardTime}>{entry.time}</Mono>
              </View>
              <Text style={styles.logCardMessage}>{entry.message}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Main Tab Navigator Component ──────────────────────────────────────────
export function MainTabNavigator() {
  const { currentUser, currentSession, logout, updateUser } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState("radar");
  const [selectedFloor, setSelectedFloor] = useState("-1");
  const [userPos, setUserPos] = useState({ x: 47, y: 48 });
  const [isNavigating, setIsNavigating] = useState(false);
  const [selectedVictim, setSelectedVictim] = useState(VICTIMS[0].id);

  const [victimsList, setVictimsList] = useState(VICTIMS);
  const [updateModalVictimId, setUpdateModalVictimId] = useState<string | null>(null);
  const [logs, setLogs] = useState(LOG);

  const addLog = (type: string, message: string) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    const newLog = {
      id: `l${Date.now()}`,
      time: timeStr,
      type,
      message,
    };
    setLogs([newLog, ...logs]);
    toast.success("Log Added", { description: "Casualty log recorded successfully." });
  };

  const updateVictimSituation = (id: string, newSituation: string) => {
    setVictimsList((prev) =>
      prev.map((v) => (v.id === id ? { ...v, situation: newSituation } : v))
    );
  };

  const liveVictims = victimsList.map((v) => {
    const coords = VICTIM_COORDS[v.id];
    if (!coords) return v;
    const dx = coords.x - userPos.x;
    const dy = coords.y - userPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy) * 0.8;

    let bearing = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (bearing < 0) bearing += 360;

    return {
      ...v,
      distance: dist,
      bearing: Math.round(bearing),
    };
  });

  const handleSelectVictim = (id: string) => {
    setSelectedVictim(id);
    const victim = liveVictims.find((v) => v.id === id);
    if (victim) {
      const flStr = victim.floor === 0 ? "G" : String(victim.floor);
      setSelectedFloor(flStr);
      setTab("map");
    }
  };

  useEffect(() => {
    if (!isNavigating) return;

    const targetV = liveVictims.find((v) => v.id === selectedVictim);
    if (!targetV) {
      setIsNavigating(false);
      return;
    }

    const targetCoords = VICTIM_COORDS[targetV.id];
    if (!targetCoords) {
      setIsNavigating(false);
      return;
    }

    const interval = setInterval(() => {
      setUserPos((prev) => {
        const dx = targetCoords.x - prev.x;
        const dy = targetCoords.y - prev.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 1.5) {
          clearInterval(interval);
          setIsNavigating(false);
          toast.success(`${targetV.label} reached!`, {
            description: `Please update the victim's situation condition.`,
          });
          setUpdateModalVictimId(targetV.id);
          return targetCoords;
        }

        const step = 2.5;
        const ratio = step / dist;
        return {
          x: prev.x + dx * Math.min(ratio, 1),
          y: prev.y + dy * Math.min(ratio, 1),
        };
      });
    }, 120);

    return () => clearInterval(interval);
  }, [isNavigating, selectedVictim]);

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
            <PulsingDot color="#ef4444" />
            <Mono style={styles.headerSubtitle}>
              {liveVictims.filter((v) => v.situation !== "lost or unable to move").length} tracked · {MESH_NODES.filter((n) => n.status === "connected").length} pods live
            </Mono>
          </View>
        </View>
        <View style={[styles.row, { gap: 8 }]}>
          <TouchableOpacity
            onPress={() => {
              toast.info("Help Requested", { description: "Other respondents have been notified of your request for assistance." });
            }}
            style={styles.headerHelpBtn}
          >
            <LifeBuoy size={16} color="#ffffff" />
            <Text style={styles.headerHelpText}>SOS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            style={styles.headerSettingsBtn}
          >
            <Settings size={16} color="#000000" />
          </TouchableOpacity>
        </View>
      </View>

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
            victims={liveVictims}
            selected={selectedVictim}
            onSelect={handleSelectVictim}
          />
        )}
        {tab === "map" && (
          <MapView
            victims={liveVictims}
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
          />
        )}
        {tab === "pods" && <PodsView nodes={MESH_NODES} />}
        {tab === "log" && <LogView log={logs} onAddLog={addLog} />}
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
                currentUser={currentUser}
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
