export const VICTIMS = [
  { id: "V-001", label: "VICTIM-01", distance: 14.2, bearing: 342, floor: -1, signalStrength: 87, situation: "safe", lastPing: "0:03 ago" },
  { id: "V-002", label: "VICTIM-02", distance: 31.7, bearing: 58,  floor: -1, signalStrength: 61, situation: "trapped",   lastPing: "0:11 ago" },
  { id: "V-003", label: "VICTIM-03", distance: 52.4, bearing: 195, floor: 0,  signalStrength: 44, situation: "lost or unable to move", lastPing: "1:42 ago" },
  { id: "V-004", label: "VICTIM-04", distance: 22.8, bearing: 120, floor: 1,  signalStrength: 75, situation: "injured", lastPing: "0:25 ago" },
];

export const VICTIM_COORDS: Record<string, { x: number; y: number }> = {
  "V-001": { x: 30, y: 25 },
  "V-002": { x: 68, y: 20 },
  "V-003": { x: 60, y: 72 },
  "V-004": { x: 45, y: 40 },
};

export const MESH_NODES = [
  { id: "N-01", name: "POD-ALPHA",   role: "anchor",  battery: 91, signal: 98, status: "connected", location: "Entry Point A",     hops: 0 },
  { id: "N-02", name: "POD-BRAVO",   role: "relay",   battery: 74, signal: 82, status: "connected", location: "Corridor B, Lvl 1", hops: 1 },
  { id: "N-03", name: "POD-CHARLIE", role: "relay",   battery: 58, signal: 67, status: "connected", location: "Stairwell C",        hops: 2 },
  { id: "N-04", name: "POD-DELTA",   role: "tracker", battery: 33, signal: 49, status: "syncing",   location: "Sub-Level -1",       hops: 3 },
  { id: "N-05", name: "POD-ECHO",    role: "tracker", battery: 12, signal: 24, status: "offline",   location: "Zone D (last)",      hops: 3 },
];

export const LOG = [
  { id: "l1", time: "07:34:22", type: "victim",  message: "VICTIM-01 situation updated: safe. Proximity 14.2 m." },
  { id: "l2", time: "07:33:55", type: "alert",   message: "VICTIM-02 situation updated: Trapped." },
  { id: "l3", time: "07:32:10", type: "mesh",    message: "POD-CHARLIE relayed packet from POD-DELTA. 3-hop route active." },
  { id: "l4", time: "07:31:44", type: "ble",     message: "BLE sync complete. Portable Tracker Pod v2.4.1 firmware confirmed." },
  { id: "l5", time: "07:30:08", type: "victim",  message: "VICTIM-03 ping timeout exceeded 90s. Situation: lost or unable to move. Last: Lvl 0." },
  { id: "l6", time: "07:28:33", type: "mesh",    message: "POD-ECHO signal lost. Attempting relay reroute via POD-DELTA." },
  { id: "l7", time: "07:27:19", type: "system",  message: "Offline map tile cache loaded. Coverage: 2.1 km² / Zone 4–7." },
  { id: "l8", time: "07:25:00", type: "ble",     message: "Portable Tracker Pod BLE handshake established." },
];

export const situationColors = {
  trapped:                 { text: "#ffffff",  bg: "#dc2626",  dot: "#ef4444" },
  injured:                 { text: "#ffffff",  bg: "#d97706",  dot: "#f59e0b" },
  "lost or unable to move": { text: "#000000",  bg: "#e5e7eb",  dot: "#9ca3af" },
  safe:                    { text: "#ffffff",  bg: "#15803d",  dot: "#22c55e" },
};

export const podStatusColors = {
  connected: { dot: "#22c55e" },
  syncing:   { dot: "#facc15" },
  offline:   { dot: "#d1d5db" },
};

export const logTypeColors = {
  ble:    { label: "BLE",    color: "#2563eb" },
  mesh:   { label: "MESH",   color: "#9333ea" },
  victim: { label: "VICTIM", color: "#dc2626" },
  alert:  { label: "ALERT",  color: "#b91c1c" },
  system: { label: "SYS",    color: "#6b7280" },
};

export const roleColors = {
  anchor:  { bg: "#000000", text: "#ffffff" },
  relay:   { bg: "#dc2626", text: "#ffffff" },
  tracker: { bg: "#f3f4f6", text: "#374151" },
};
