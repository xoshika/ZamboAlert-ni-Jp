import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  Animated,
  Easing,
  StatusBar,
  TextInput,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import Svg, { Circle, Line, Rect, G } from "react-native-svg";
import {
  Bluetooth,
  BluetoothConnected,
  MapPin,
  Navigation,
  Signal,
  Battery,
  AlertTriangle,
  ChevronRight,
  Radio,
  Activity,
  Layers,
  Crosshair,
  HeartPulse,
  Settings,
  ArrowUp,
  X,
  LifeBuoy,
} from "lucide-react-native";
import {
  AuthContainer,
  SessionSettingsSection,
  SessionTimeoutOverlay,
  UserRecord,
  SessionDetails,
  saveUser,
} from "./Auth";
import { initDatabase } from "./database";


// ── Mock Data ───────────────────────────────────────────────────────────────

const VICTIMS = [
  { id: "V-001", label: "VICTIM-01", distance: 14.2, bearing: 342, floor: -1, signalStrength: 87, situation: "safe", heartRate: 74, temp: 36.5, lastPing: "0:03 ago" },
  { id: "V-002", label: "VICTIM-02", distance: 31.7, bearing: 58,  floor: -1, signalStrength: 61, situation: "trapped",   heartRate: 140, temp: 38.9, lastPing: "0:11 ago" },
  { id: "V-003", label: "VICTIM-03", distance: 52.4, bearing: 195, floor: 0,  signalStrength: 44, situation: "lost or unable to move", heartRate: null, temp: null, lastPing: "1:42 ago" },
  { id: "V-004", label: "VICTIM-04", distance: 22.8, bearing: 120, floor: 1,  signalStrength: 75, situation: "injured", heartRate: 110, temp: 37.8, lastPing: "0:25 ago" },
];

const VICTIM_COORDS: Record<string, { x: number; y: number }> = {
  "V-001": { x: 30, y: 25 },
  "V-002": { x: 68, y: 20 },
  "V-003": { x: 60, y: 72 },
  "V-004": { x: 45, y: 40 },
};

const MESH_NODES = [
  { id: "N-01", name: "POD-ALPHA",   role: "anchor",  battery: 91, signal: 98, status: "connected", location: "Entry Point A",     hops: 0 },
  { id: "N-02", name: "POD-BRAVO",   role: "relay",   battery: 74, signal: 82, status: "connected", location: "Corridor B, Lvl 1", hops: 1 },
  { id: "N-03", name: "POD-CHARLIE", role: "relay",   battery: 58, signal: 67, status: "connected", location: "Stairwell C",        hops: 2 },
  { id: "N-04", name: "POD-DELTA",   role: "tracker", battery: 33, signal: 49, status: "syncing",   location: "Sub-Level -1",       hops: 3 },
  { id: "N-05", name: "POD-ECHO",    role: "tracker", battery: 12, signal: 24, status: "offline",   location: "Zone D (last)",      hops: 3 },
];

const LOG = [
  { id: "l1", time: "07:34:22", type: "victim",  message: "VICTIM-01 situation updated: safe. Proximity 14.2 m." },
  { id: "l2", time: "07:33:55", type: "alert",   message: "VICTIM-02 heart rate elevated: 140 bpm. Temp 38.9°C. Trapped." },
  { id: "l3", time: "07:32:10", type: "mesh",    message: "POD-CHARLIE relayed packet from POD-DELTA. 3-hop route active." },
  { id: "l4", time: "07:31:44", type: "ble",     message: "BLE sync complete. Portable Tracker Pod v2.4.1 firmware confirmed." },
  { id: "l5", time: "07:30:08", type: "victim",  message: "VICTIM-03 ping timeout exceeded 90s. Situation: lost or unable to move. Last: Lvl 0." },
  { id: "l6", time: "07:28:33", type: "mesh",    message: "POD-ECHO signal lost. Attempting relay reroute via POD-DELTA." },
  { id: "l7", time: "07:27:19", type: "system",  message: "Offline map tile cache loaded. Coverage: 2.1 km² / Zone 4–7." },
  { id: "l8", time: "07:25:00", type: "ble",     message: "Portable Tracker Pod BLE handshake established. RSSI -42 dBm." },
];

// ── Config maps ────────────────────────────────────────────────────────────

const situationColors = {
  trapped:                 { text: "#ffffff",  bg: "#dc2626",  dot: "#ef4444" },
  injured:                 { text: "#ffffff",  bg: "#d97706",  dot: "#f59e0b" },
  "lost or unable to move": { text: "#000000",  bg: "#e5e7eb",  dot: "#9ca3af" },
  safe:                    { text: "#ffffff",  bg: "#15803d",  dot: "#22c55e" },
};

const podStatusColors = {
  connected: { dot: "#22c55e" },
  syncing:   { dot: "#facc15" },
  offline:   { dot: "#d1d5db" },
};

const logTypeColors = {
  ble:    { label: "BLE",    color: "#2563eb" },
  mesh:   { label: "MESH",   color: "#9333ea" },
  victim: { label: "VICTIM", color: "#dc2626" },
  alert:  { label: "ALERT",  color: "#b91c1c" },
  system: { label: "SYS",    color: "#6b7280" },
};

const roleColors = {
  anchor:  { bg: "#000000", text: "#ffffff" },
  relay:   { bg: "#dc2626", text: "#ffffff" },
  tracker: { bg: "#f3f4f6", text: "#374151" },
};



function useAnimatedValue(target: number, speed = 0.08) {
  const [val, setVal] = useState(target);
  const ref = useRef(val);
  useEffect(() => {
    ref.current = val;
    let animId: number;
    const tick = () => {
      const diff = target - ref.current;
      if (Math.abs(diff) < 0.1) {
        setVal(target);
        return;
      }
      ref.current += diff * speed;
      setVal(ref.current);
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [target, speed]);
  return val;
}

// ── Shared UI ──────────────────────────────────────────────────────────────

function Mono({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[styles.monoText, style]}>{children}</Text>;
}

function PulsingDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 2.2,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.8,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, [scale, opacity]);

  return (
    <View style={styles.pulsingDotContainer}>
      <Animated.View
        style={[
          styles.pulsingDotPing,
          {
            backgroundColor: color,
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
      <View style={[styles.pulsingDotInner, { backgroundColor: color }]} />
    </View>
  );
}

// ── Radar View ─────────────────────────────────────────────────────────────

function RadarView({
  victims,
  selected,
  onSelect,
}: {
  victims: any[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const target = victims.find((v) => v.id === selected) ?? victims[0];
  const bearing = useAnimatedValue(target.bearing);
  const arrowAngle = bearing - 180;
  const compassLabels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  return (
    <View style={styles.viewContainer}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Mono style={styles.cardSubtitle}>BEARING TO TARGET</Mono>
            <Text style={styles.cardTitle}>{target.label}</Text>
          </View>
          <View
            style={[
              styles.badge,
              { backgroundColor: situationColors[target.situation as keyof typeof situationColors].bg },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: situationColors[target.situation as keyof typeof situationColors].text },
              ]}
            >
              {target.situation.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.radarWrapper}>
          <View style={styles.radarCircle}>
            <Svg width="208" height="208" style={StyleSheet.absoluteFill}>
              <Circle cx="104" cy="104" r="102" stroke="rgba(0,0,0,0.1)" strokeWidth="2" fill="none" />
              <Circle cx="104" cy="104" r="80" stroke="rgba(0,0,0,0.06)" strokeWidth="1" fill="none" />
              <Circle cx="104" cy="104" r="50" stroke="rgba(0,0,0,0.04)" strokeWidth="1" fill="none" />
              <Line x1="104" y1="2" x2="104" y2="206" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
              <Line x1="2" y1="104" x2="206" y2="104" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
            </Svg>

            <View style={styles.radarCenterDot} />

            {compassLabels.map((label, i) => {
              const angle = (i * 45 * Math.PI) / 180;
              const r = 88;
              const x = 104 + r * Math.sin(angle);
              const y = 104 - r * Math.cos(angle);
              const labelWidth = 30;
              const labelHeight = 20;
              const isN = label === "N";

              return (
                <View
                  key={label}
                  style={[
                    styles.compassLabelContainer,
                    {
                      left: x - labelWidth / 2,
                      top: y - labelHeight / 2,
                      width: labelWidth,
                      height: labelHeight,
                    },
                  ]}
                >
                  <Mono style={[styles.compassLabelText, isN ? styles.textRed : styles.textMuted]}>
                    {label}
                  </Mono>
                </View>
              );
            })}

            <View
              style={[
                styles.arrowWrapper,
                { transform: [{ rotate: `${arrowAngle}deg` }] },
              ]}
            >
              <View style={styles.arrowContainer}>
                <ArrowUp size={36} color="#dc2626" strokeWidth={2.5} />
              </View>
            </View>

            {victims.map((v) => {
              const a = ((v.bearing - 180) * Math.PI) / 180;
              const maxDist = Math.max(...victims.map((x) => x.distance));
              const ratio = Math.min(v.distance / (maxDist || 1), 1) * 56;
              const bx = 104 + ratio * Math.sin(a);
              const by = 104 - ratio * Math.cos(a);
              const isSelected = v.id === selected;
              const dotSize = isSelected ? 18 : 12;

              let dotBg = "#9ca3af";
              let dotBorder = "#6b7280";
              if (v.situation === "trapped") {
                dotBg = "#ef4444";
                dotBorder = "#dc2626";
              } else if (v.situation === "injured") {
                dotBg = "#fbbf24";
                dotBorder = "#d97706";
              } else if (v.situation === "safe") {
                dotBg = "#22c55e";
                dotBorder = "#15803d";
              }

              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => onSelect(v.id)}
                  style={[
                    styles.radarDot,
                    {
                      left: bx - dotSize / 2,
                      top: by - dotSize / 2,
                      width: dotSize,
                      height: dotSize,
                      borderRadius: dotSize / 2,
                      backgroundColor: dotBg,
                      borderColor: dotBorder,
                      borderWidth: 2,
                      elevation: isSelected ? 4 : 0,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isSelected ? 0.3 : 0,
                      shadowRadius: 3,
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Mono style={styles.statVal}>{Math.round(bearing)}°</Mono>
            <Text style={styles.statLabel}>BEARING</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Mono style={[styles.statVal, styles.textRed]}>
              {target.distance.toFixed(1)}
              <Text style={{ fontSize: 14 }}>m</Text>
            </Mono>
            <Text style={styles.statLabel}>DISTANCE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Mono style={styles.statVal}>
              {target.floor > 0 ? `+${target.floor}` : target.floor}
            </Mono>
            <Text style={styles.statLabel}>FLOOR</Text>
          </View>
        </View>
      </View>

      <View style={styles.listContainer}>
        {victims.map((v) => {
          const isSelected = v.id === selected;
          const config = situationColors[v.situation as keyof typeof situationColors];

          return (
            <TouchableOpacity
              key={v.id}
              onPress={() => onSelect(v.id)}
              style={[
                styles.victimCard,
                isSelected ? styles.victimCardSelected : styles.victimCardNormal,
              ]}
            >
              <View style={styles.victimCardHeader}>
                <View style={styles.victimCardLeft}>
                  <PulsingDot color={config.dot} />
                  <View style={styles.victimCardMeta}>
                    <Mono style={styles.victimCardTitle}>{v.label}</Mono>
                    <View style={styles.victimCardSubRow}>
                      <Mono style={styles.victimCardSubText}>{v.distance.toFixed(1)} m</Mono>
                      <Text style={styles.bullet}>·</Text>
                      <Mono style={styles.victimCardSubText}>{v.bearing}°</Mono>
                      <Text style={styles.bullet}>·</Text>
                      <Mono style={styles.victimCardSubText}>Floor {v.floor}</Mono>
                    </View>
                  </View>
                </View>

                <View style={styles.victimCardRight}>
                  {v.heartRate && (
                    <View style={styles.heartRateContainer}>
                      <HeartPulse
                        size={12}
                        color={
                          v.situation === "trapped" ? "#dc2626" :
                          v.situation === "injured" ? "#d97706" :
                          v.situation === "safe" ? "#15803d" :
                          "#000000"
                        }
                      />
                      <Mono style={styles.heartRateText}>{v.heartRate}</Mono>
                    </View>
                  )}
                  <View style={[styles.miniBadge, { backgroundColor: config.bg }]}>
                    <Text style={[styles.miniBadgeText, { color: config.text }]}>
                      {v.situation.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              {v.heartRate && isSelected && (
                <View style={styles.victimDetails}>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Heart Rate</Text>
                    <Mono style={[styles.detailVal, (v.situation === "trapped" || v.situation === "injured") ? styles.textRed : styles.textBlack]}>
                      {v.heartRate} <Text style={styles.detailUnit}>bpm</Text>
                    </Mono>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Temp</Text>
                    <Mono style={styles.detailVal}>
                      {v.temp}° <Text style={styles.detailUnit}>C</Text>
                    </Mono>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>RSSI</Text>
                    <Mono style={styles.detailVal}>
                      -{100 - v.signalStrength} <Text style={styles.detailUnit}>dBm</Text>
                    </Mono>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Map View ───────────────────────────────────────────────────────────────

function MapView({
  victims,
  selectedVictim,
  onSelectVictim,
  selectedFloor,
  setSelectedFloor,
  userPos,
  setUserPos,
  isNavigating,
  setIsNavigating,
  toast,
  onUpdateSituation,
}: {
  victims: any[];
  selectedVictim: string;
  onSelectVictim: (id: string) => void;
  selectedFloor: string;
  setSelectedFloor: (floor: string) => void;
  userPos: { x: number; y: number };
  setUserPos: (pos: { x: number; y: number }) => void;
  isNavigating: boolean;
  setIsNavigating: (val: boolean) => void;
  toast: any;
  onUpdateSituation: (id: string) => void;
}) {
  const gridCells = 12;
  const [mapLayout, setMapLayout] = useState({ width: 0, height: 0 });

  const handleMapLayout = (e: any) => {
    const { width, height } = e.nativeEvent.layout;
    setMapLayout({ width, height });
  };

  const handleMapPress = (e: any) => {
    if (isNavigating) return;
    const { locationX, locationY } = e.nativeEvent;
    if (mapLayout.width > 0 && mapLayout.height > 0) {
      const x = (locationX / mapLayout.width) * 100;
      const y = (locationY / mapLayout.height) * 100;
      const clampedX = Math.max(12, Math.min(88, x));
      const clampedY = Math.max(10, Math.min(90, y));
      setUserPos({ x: clampedX, y: clampedY });
    }
  };

  const selectedV = victims.find((v) => v.id === selectedVictim);
  const targetCoords = selectedV ? VICTIM_COORDS[selectedV.id] : null;

  const [dashOffset, setDashOffset] = useState(0);
  useEffect(() => {
    if (!isNavigating) {
      setDashOffset(0);
      return;
    }
    const interval = setInterval(() => {
      setDashOffset((prev) => (prev - 2) % 20);
    }, 80);
    return () => clearInterval(interval);
  }, [isNavigating]);

  return (
    <View style={styles.viewContainer}>
      <View style={styles.mapCard}>
        <View style={styles.mapHeader}>
          <View style={styles.row}>
            <Layers size={14} color="#000000" />
            <Text style={styles.mapHeaderText}>Offline Map — Zone 4–7</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.mapDotIndicator} />
            <Mono style={styles.mapHeaderStatusText}>CACHED</Mono>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={isNavigating ? 1 : 0.9}
          onPress={handleMapPress}
          onLayout={handleMapLayout}
          style={styles.mapBody}
        >
          {mapLayout.width > 0 && mapLayout.height > 0 && (
            <Svg width={mapLayout.width} height={mapLayout.height} style={StyleSheet.absoluteFill}>
              {Array.from({ length: gridCells }).map((_, i) => (
                <G key={i}>
                  <Line
                    x1={`${(i / gridCells) * 100}%`}
                    y1="0"
                    x2={`${(i / gridCells) * 100}%`}
                    y2="100%"
                    stroke="rgba(0,0,0,0.04)"
                    strokeWidth="1"
                  />
                  <Line
                    x1="0"
                    y1={`${(i / gridCells) * 100}%`}
                    x2="100%"
                    y2={`${(i / gridCells) * 100}%`}
                    stroke="rgba(0,0,0,0.04)"
                    strokeWidth="1"
                  />
                </G>
              ))}

              <Rect x="12%" y="10%" width="76%" height="80%" rx="4" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="2" />
              <Rect x="12%" y="10%" width="35%" height="38%" fill="rgba(0,0,0,0.03)" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
              <Rect x="53%" y="10%" width="35%" height="38%" fill="rgba(0,0,0,0.03)" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
              <Rect x="12%" y="52%" width="76%" height="38%" fill="rgba(0,0,0,0.03)" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
              <Line x1="47%" y1="10%" x2="47%" y2="90%" stroke="rgba(0,0,0,0.06)" strokeWidth="12" />
              <Line x1="12%" y1="48%" x2="88%" y2="48%" stroke="rgba(0,0,0,0.06)" strokeWidth="12" />

              {targetCoords && selectedV && selectedV.floor === (selectedFloor === "G" ? 0 : Number(selectedFloor)) && (
                <Line
                  x1={`${userPos.x}%`}
                  y1={`${userPos.y}%`}
                  x2={`${targetCoords.x}%`}
                  y2={`${targetCoords.y}%`}
                  stroke="#dc2626"
                  strokeWidth="2.5"
                  strokeDasharray="6,4"
                  strokeDashoffset={dashOffset}
                />
              )}
            </Svg>
          )}

          <View
            style={[
              styles.userIconContainer,
              {
                left: `${userPos.x}%`,
                top: `${userPos.y}%`,
              }
            ]}
          >
            <View style={styles.userIconWrapper}>
              <View style={styles.userIconPing} />
              <View style={styles.userIconPulse} />
              <View style={styles.userIconCenter}>
                <Navigation size={8} color="#ffffff" fill="#ffffff" style={{ transform: [{ rotate: '45deg' }] }} />
              </View>
            </View>
          </View>

          {victims.map((v, idx) => {
            const coords = VICTIM_COORDS[v.id] || { x: 50, y: 50 };
            const isSelected = selectedVictim === v.id;

            const victimFloorStr = v.floor === 0 ? "G" : String(v.floor);
            if (victimFloorStr !== selectedFloor) return null;

            const dotColor =
              v.situation === "trapped" ? "#dc2626" :
              v.situation === "injured" ? "#d97706" :
              v.situation === "safe" ? "#15803d" :
              "#9ca3af";

            return (
              <TouchableOpacity
                key={v.id}
                onPress={() => onSelectVictim(v.id)}
                style={[
                  styles.mapVictimContainer,
                  {
                    left: `${coords.x}%`,
                    top: `${coords.y}%`,
                    zIndex: isSelected ? 30 : 10,
                  }
                ]}
              >
                <View
                  style={[
                    styles.mapVictimDot,
                    {
                      backgroundColor: dotColor,
                      borderWidth: isSelected ? 2.5 : 2,
                      borderColor: '#ffffff',
                    }
                  ]}
                >
                  <Text style={styles.mapVictimText}>{idx + 1}</Text>
                </View>
                <View style={[styles.mapVictimStem, { backgroundColor: dotColor }]} />
              </TouchableOpacity>
            );
          })}

          <View style={styles.mapCompassHud}>
            <Mono style={styles.mapCompassText}>N</Mono>
          </View>

          <View style={styles.mapScaleHud}>
            <View style={styles.mapScaleBar} />
            <Mono style={styles.mapScaleText}>20 m</Mono>
          </View>
        </TouchableOpacity>

        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2563eb' }]} />
            <Mono style={styles.legendText}>You</Mono>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#dc2626' }]} />
            <Mono style={styles.legendText}>Trapped</Mono>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#d97706' }]} />
            <Mono style={styles.legendText}>Injured</Mono>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#9ca3af' }]} />
            <Mono style={styles.legendText}>Lost / Unable to move</Mono>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#15803d' }]} />
            <Mono style={styles.legendText}>Safe</Mono>
          </View>
        </View>
      </View>

      {selectedV && (
        <View style={styles.navPanel}>
          <View style={styles.navPanelHeader}>
            <View>
              <View style={styles.row}>
                <View
                  style={[
                    styles.navStatusDot,
                    {
                      backgroundColor:
                        selectedV.situation === 'trapped' ? '#ef4444' :
                        selectedV.situation === 'injured' ? '#d97706' :
                        selectedV.situation === 'safe' ? '#22c55e' :
                        '#9ca3af',
                    },
                  ]}
                />
                <Text style={styles.navVictimLabel}>{selectedV.label}</Text>
                <Mono style={styles.navVictimFloor}>Floor {selectedV.floor === 0 ? "G" : selectedV.floor}</Mono>
              </View>
              <Text style={styles.navStatusText}>
                Situation: <Text style={(selectedV.situation === 'trapped' || selectedV.situation === 'injured') ? styles.textRedBold : styles.textBlackBold}>{selectedV.situation.toUpperCase()}</Text>
              </Text>
            </View>
            <View style={styles.alignRight}>
              <Mono style={styles.navDistanceText}>{selectedV.distance.toFixed(1)}m</Mono>
              <Mono style={styles.navBearingText}>{selectedV.bearing}° Bearing</Mono>
            </View>
          </View>

          <View style={styles.navActionRow}>
            {selectedV.floor === (selectedFloor === "G" ? 0 : Number(selectedFloor)) ? (
              <TouchableOpacity
                onPress={() => setIsNavigating(!isNavigating)}
                style={[
                  styles.navBtnPrimary,
                  isNavigating ? styles.navBtnActive : styles.navBtnInactive
                ]}
              >
                <Navigation size={13} color="#ffffff" />
                <Text style={styles.navBtnText}>
                  {isNavigating ? "Stop Navigation" : "Auto Navigate"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => setSelectedFloor(selectedV.floor === 0 ? "G" : String(selectedV.floor))}
                style={styles.navBtnSwitch}
              >
                <Layers size={13} color="#374151" />
                <Text style={styles.navBtnSwitchText}>
                  Switch to Floor {selectedV.floor === 0 ? "G" : selectedV.floor}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => onUpdateSituation(selectedV.id)}
              style={styles.navBtnUpdate}
            >
              <Text style={styles.navBtnUpdateText}>Update Status</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setUserPos({ x: 47, y: 48 });
                setIsNavigating(false);
                toast.info("Rescuer position reset to starting point.");
              }}
              style={styles.navBtnReset}
            >
              <Text style={styles.navBtnResetText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.floorCard}>
        <Mono style={styles.floorCardTitle}>FLOOR LEVEL</Mono>
        <View style={styles.floorBtnRow}>
          {["-2", "-1", "G", "+1", "+2"].map((f) => {
            const isSelected = f === selectedFloor;
            return (
              <TouchableOpacity
                key={f}
                disabled={isNavigating}
                onPress={() => {
                  if (isNavigating) return;
                  setSelectedFloor(f);
                }}
                style={[
                  styles.floorBtn,
                  isSelected ? styles.floorBtnSelected : styles.floorBtnNormal,
                  isNavigating ? styles.disabledBtn : null
                ]}
              >
                <Mono style={[styles.floorBtnText, isSelected ? styles.textWhite : styles.textMuted]}>
                  {f}
                </Mono>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ── Pods View ──────────────────────────────────────────────────────────────

function PodsView({ nodes }: { nodes: any[] }) {
  const connected = nodes.filter((n) => n.status === "connected").length;
  const syncing   = nodes.filter((n) => n.status === "syncing").length;
  const offline   = nodes.filter((n) => n.status === "offline").length;

  return (
    <View style={styles.viewContainer}>
      <View style={styles.podsOverviewGrid}>
        {[
          { label: "ONLINE",  value: connected, color: "#000000" },
          { label: "SYNCING", value: syncing,   color: "#dc2626" },
          { label: "OFFLINE", value: offline,   color: "#9ca3af" },
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

function LogView({ log, onAddLog }: { log: any[], onAddLog: (type: string, message: string) => void }) {
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

// ── Main App ───────────────────────────────────

function RescuersApp({
  currentUser,
  session,
  onLogout,
  onUpdateUser,
  globalToast,
}: {
  currentUser: UserRecord;
  session: SessionDetails;
  onLogout: () => void;
  onUpdateUser: (updates: Partial<UserRecord>) => void;
  globalToast: any;
}) {
  const insets = useSafeAreaInsets();
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState("radar");
  const [selectedFloor, setSelectedFloor] = useState("-1");
  const [userPos, setUserPos] = useState({ x: 47, y: 48 });
  const [isNavigating, setIsNavigating] = useState(false);
  const [selectedVictim, setSelectedVictim] = useState(VICTIMS[0].id);
  const bleConnected = true;

  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'info' | 'error'; title: string; desc?: string } | null>(null);
  const [victimsList, setVictimsList] = useState(VICTIMS);
  const [updateModalVictimId, setUpdateModalVictimId] = useState<string | null>(null);
  const [logs, setLogs] = useState(LOG);

  const addLog = (type: string, message: string) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
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

  const toast = {
    success: (title: string, options?: { description?: string }) => {
      setToastMsg({ type: 'success', title, desc: options?.description });
    },
    info: (title: string, options?: { description?: string }) => {
      setToastMsg({ type: 'info', title, desc: options?.description });
    },
    error: (title: string, options?: { description?: string }) => {
      setToastMsg({ type: 'error', title, desc: options?.description });
    }
  };

  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

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
    { id: "map",   icon: MapPin,    label: "Map" },
    { id: "pods",  icon: Radio,     label: "Pods" },
    { id: "log",   icon: Activity,  label: "Log" },
  ];

  const showCriticalAlert = liveVictims.some((v) => v.situation === "trapped");
  const criticalVictim = liveVictims.find((v) => v.situation === "trapped");

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + 8 : 12 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.row}>
            <View style={styles.headerLogoBox}>
              <Navigation size={11} color="#ffffff" style={{ transform: [{ rotate: '45deg' }] }} />
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

      {toastMsg && (
        <View style={[styles.toastOverlay, { top: insets.top > 0 ? insets.top + 16 : 40 }]}>
          <View style={[styles.toastAlert, toastMsg.type === 'success' ? styles.toastSuccess : styles.toastInfo]}>
            <View style={styles.row}>
              <AlertTriangle size={14} color={toastMsg.type === 'success' ? '#16a34a' : '#2563eb'} style={{ marginRight: 6 }} />
              <Text style={styles.toastTitle}>{toastMsg.title}</Text>
            </View>
            {toastMsg.desc && (
              <Text style={styles.toastDesc}>{toastMsg.desc}</Text>
            )}
          </View>
        </View>
      )}

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
                session={session}
                onLogout={onLogout}
                onUpdateUser={onUpdateUser}
                toast={globalToast}
              />
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionDetails | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'info' | 'error'; title: string; desc?: string } | null>(null);

  useEffect(() => {
    // Initialize offline database
    initDatabase().then(() => {
      console.log('Offline DB Initialized');
    }).catch((e) => {
      console.error('Failed to initialize offline DB:', e);
    });
  }, []);

  const toast = {
    success: (title: string, options?: { description?: string }) => {
      setToastMsg({ type: 'success', title, desc: options?.description });
    },
    info: (title: string, options?: { description?: string }) => {
      setToastMsg({ type: 'info', title, desc: options?.description });
    },
    error: (title: string, options?: { description?: string }) => {
      setToastMsg({ type: 'error', title, desc: options?.description });
    }
  };

  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Session Inactivity Monitoring
  const resetSessionTimer = () => {
    if (currentSession && currentUser) {
      currentSession.expiresAt = Date.now() + 5 * 60 * 1000;
    }
  };

  const handleLogout = (message?: string) => {
    setCurrentUser(null);
    setCurrentSession(null);
    if (message) {
      toast.info("Session Closed", { description: message });
    } else {
      toast.info("Logged Out", { description: "You have been securely logged out." });
    }
  };

  const handleUpdateUser = async (updates: Partial<UserRecord>) => {
    if (currentUser) {
      const updated = { ...currentUser, ...updates };
      setCurrentUser(updated);
      saveUser(updated);
      toast.info("Offline Sync", { description: "Updated profile locally." });
    }
  };

  // Check for session expiry
  useEffect(() => {
    if (!currentSession || !currentUser) return;

    const checkInterval = setInterval(() => {
      if (Date.now() > currentSession.expiresAt) {
        clearInterval(checkInterval);
        handleLogout("Session expired due to inactivity.");
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [currentSession, currentUser]);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onTouchStart={resetSessionTimer}>
        {currentUser && currentSession ? (
          <RescuersApp
            currentUser={currentUser}
            session={currentSession}
            onLogout={() => handleLogout()}
            onUpdateUser={handleUpdateUser}
            globalToast={toast}
          />
        ) : (
          <AuthContainer
            onLoginSuccess={(user, session) => {
              setCurrentUser(user);
              setCurrentSession(session);
            }}
            toast={toast}
          />
        )}

        {/* Global Toast for Auth Container */}
        {toastMsg && !currentUser && (
          <View style={styles.toastOverlay}>
            <View style={[styles.toastAlert, toastMsg.type === 'success' ? styles.toastSuccess : styles.toastInfo]}>
              <View style={styles.row}>
                <AlertTriangle size={14} color={toastMsg.type === 'success' ? '#16a34a' : '#2563eb'} style={{ marginRight: 6 }} />
                <Text style={styles.toastTitle}>{toastMsg.title}</Text>
              </View>
              {toastMsg.desc && (
                <Text style={styles.toastDesc}>{toastMsg.desc}</Text>
              )}
            </View>
          </View>
        )}

        {/* Session Inactivity Timeout Overlay */}
        {currentSession && currentUser && (
          <SessionTimeoutOverlay
            expiresAt={currentSession.expiresAt}
            onRenew={resetSessionTimer}
            onExpire={() => handleLogout("Session expired due to inactivity.")}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

// ── StyleSheet ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  topStatusBar: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 0 : 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  topStatusClock: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000000",
  },
  topStatusRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topStatusBleText: {
    fontSize: 10,
    color: "#2563eb",
    fontWeight: "600",
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  headerLeft: {
    flexDirection: "column",
  },
  headerLogoBox: {
    width: 20,
    height: 20,
    backgroundColor: "#dc2626",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#000000",
    letterSpacing: -0.3,
  },
  headerBadge: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  headerBadgeText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: "#ffffff",
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    color: "#9ca3af",
    marginLeft: 6,
  },
  headerHelpBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    gap: 6,
  },
  headerHelpText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  logCardMessage: {
    color: "#e5e7eb",
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 12,
  },
  logActionCard: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  disasterButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  disasterBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: "center",
  },
  disasterBtnActive: {
    backgroundColor: "#dc2626",
  },
  disasterBtnText: {
    color: "#4b5563",
    fontSize: 14,
    fontWeight: "600",
  },
  disasterBtnTextActive: {
    color: "#ffffff",
  },
  input: {
    backgroundColor: "#f9fafb",
    color: "#1f2937",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    fontSize: 16,
    marginBottom: 12,
  },
  submitLogBtn: {
    backgroundColor: "#dc2626",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  submitLogBtnText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },
  headerSettingsBtn: {
    width: 36,
    height: 36,
    backgroundColor: "#f3f4f6",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  criticalAlertBanner: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  criticalAlertText: {
    fontSize: 11,
    color: "#ffffff",
    fontWeight: "600",
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  bottomNav: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 8,
    paddingTop: 8,
    flexDirection: "row",
  },
  bottomNavTab: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 12,
  },
  bottomNavTabActive: {
    backgroundColor: "#fef2f2",
  },
  bottomNavText: {
    fontSize: 10,
    fontWeight: "600",
  },
  // Shared Components styles
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  pulsingDotContainer: {
    width: 8,
    height: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  pulsingDotPing: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pulsingDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Radar View styles
  viewContainer: {
    flexDirection: "column",
    gap: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardSubtitle: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9ca3af",
    letterSpacing: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000000",
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: "bold",
  },
  radarWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  radarCircle: {
    width: 208,
    height: 208,
    borderRadius: 104,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  radarCenterDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#dc2626",
    position: "absolute",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  compassLabelContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  compassLabelText: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  arrowWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  arrowContainer: {
    height: 80,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  radarDot: {
    position: "absolute",
    zIndex: 15,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    marginTop: 16,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
  },
  statVal: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#000000",
  },
  statLabel: {
    fontSize: 10,
    color: "#9ca3af",
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  listContainer: {
    flexDirection: "column",
    gap: 8,
  },
  victimCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    flexDirection: "column",
  },
  victimCardNormal: {
    borderColor: "rgba(0,0,0,0.08)",
  },
  victimCardSelected: {
    borderColor: "#dc2626",
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  victimCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  victimCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  victimCardMeta: {
    flexDirection: "column",
  },
  victimCardTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000000",
  },
  victimCardSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  victimCardSubText: {
    fontSize: 11,
    color: "#9ca3af",
  },
  bullet: {
    color: "#e5e7eb",
    marginHorizontal: 8,
  },
  victimCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heartRateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  heartRateText: {
    fontSize: 11,
    color: "#000000",
  },
  miniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  miniBadgeText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: "bold",
  },
  victimDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailVal: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 4,
  },
  detailUnit: {
    fontSize: 10,
    color: "#9ca3af",
    fontWeight: "normal",
  },
  // Map View styles
  mapCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  mapHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  mapHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#000000",
    marginLeft: 8,
  },
  mapDotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
    marginRight: 6,
  },
  mapHeaderStatusText: {
    fontSize: 10,
    color: "#6b7280",
  },
  mapBody: {
    backgroundColor: "#f9fafb",
    height: 280,
    position: "relative",
  },
  userIconContainer: {
    position: "absolute",
    width: 24,
    height: 24,
    marginLeft: -12,
    marginTop: -12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  userIconWrapper: {
    position: "relative",
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  userIconPing: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(37, 99, 235, 0.2)",
  },
  userIconPulse: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(37, 99, 235, 0.4)",
  },
  userIconCenter: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  mapCompassHud: {
    position: "absolute",
    top: 12,
    right: 16,
    backgroundColor: "#ffffff",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  mapCompassText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#dc2626",
  },
  mapScaleHud: {
    position: "absolute",
    bottom: 12,
    right: 16,
    alignItems: "flex-end",
    gap: 4,
  },
  mapScaleBar: {
    height: 2,
    width: 48,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  mapScaleText: {
    fontSize: 9,
    color: "rgba(0,0,0,0.4)",
  },
  legendContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    backgroundColor: "#ffffff",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 10,
    color: "#6b7280",
  },
  navPanel: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 16,
    flexDirection: "column",
    gap: 12,
  },
  navPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  navStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  navVictimLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#000000",
  },
  navVictimFloor: {
    fontSize: 10,
    color: "#9ca3af",
    marginLeft: 8,
  },
  navStatusText: {
    fontSize: 10,
    color: "#9ca3af",
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 4,
  },
  navDistanceText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#dc2626",
  },
  navBearingText: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 2,
  },
  navActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  navBtnPrimary: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  navBtnActive: {
    backgroundColor: "#f59e0b",
  },
  navBtnInactive: {
    backgroundColor: "#dc2626",
  },
  navBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  navBtnSwitch: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  navBtnSwitchText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  navBtnReset: {
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnResetText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  floorCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 16,
  },
  floorCardTitle: {
    fontSize: 10,
    color: "#9ca3af",
    letterSpacing: 1,
    marginBottom: 12,
  },
  floorBtnRow: {
    flexDirection: "row",
    gap: 8,
  },
  floorBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  floorBtnNormal: {
    backgroundColor: "#f3f4f6",
  },
  floorBtnSelected: {
    backgroundColor: "#dc2626",
  },
  floorBtnText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  disabledBtn: {
    opacity: 0.5,
  },
  // Pods View styles
  podsOverviewGrid: {
    flexDirection: "row",
    gap: 12,
  },
  podsOverviewCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingVertical: 12,
    alignItems: "center",
  },
  podsOverviewVal: {
    fontSize: 24,
    fontWeight: "bold",
  },
  podsOverviewLabel: {
    fontSize: 9,
    color: "#9ca3af",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  podCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 16,
    flexDirection: "column",
  },
  podCardOffline: {
    opacity: 0.6,
  },
  podCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  podCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  podCardMeta: {
    flexDirection: "column",
  },
  podCardTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#000000",
  },
  podCardSubText: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 2,
  },
  podStatsRow: {
    flexDirection: "row",
    gap: 12,
  },
  podStatCol: {
    flex: 1,
  },
  podStatLabel: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#f3f4f6",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  podStatVal: {
    fontSize: 11,
    fontWeight: "600",
  },
  hopsVal: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000000",
  },
  podAlertBanner: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  podAlertText: {
    fontSize: 11,
    color: "#dc2626",
  },
  // Log View styles
  logCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 16,
    flexDirection: "column",
  },
  logCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  logCardLabel: {
    fontSize: 10,
    fontWeight: "bold",
  },
  logCardTime: {
    fontSize: 10,
    color: "#9ca3af",
  },
  logCardMessage: {
    fontSize: 12,
    color: "rgba(0,0,0,0.8)",
    lineHeight: 18,
  },
  // Toast notifications styles
  toastOverlay: {
    position: "absolute",
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: "center",
  },
  toastAlert: {
    width: "100%",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
  },
  toastSuccess: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  toastInfo: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  toastTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1f2937",
  },
  toastDesc: {
    fontSize: 11,
    color: "#4b5563",
    marginTop: 4,
    lineHeight: 15,
  },
  // Helper utility styles
  textRed: {
    color: "#dc2626",
  },
  textRedBold: {
    color: "#dc2626",
    fontWeight: "bold",
  },
  textBlack: {
    color: "#000000",
  },
  textBlackBold: {
    color: "#000000",
    fontWeight: "bold",
  },
  textWhite: {
    color: "#ffffff",
  },
  textMuted: {
    color: "#9ca3af",
  },
  alignRight: {
    alignItems: "flex-end",
  },
  // Victim marker positions on Map
  mapVictimContainer: {
    position: 'absolute',
    width: 40,
    height: 30,
    alignItems: 'center',
    justifyContent: 'flex-start',
    transform: [{ translateX: -20 }, { translateY: -30 }],
  },
  mapVictimDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  mapVictimText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  mapVictimStem: {
    width: 1.5,
    height: 8,
  },
  navBtnUpdate: {
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  navBtnUpdateText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563eb",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10000,
    paddingHorizontal: 24,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 20,
  },
  modalOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  modalOptionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalCancelBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4b5563",
  },
});
