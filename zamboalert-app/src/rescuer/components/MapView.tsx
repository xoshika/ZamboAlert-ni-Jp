import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Animated } from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Line, Rect, G } from 'react-native-svg';
import { Navigation, ShieldAlert, ChevronRight, MapPin, X, Layers, LifeBuoy, AlertTriangle } from 'lucide-react-native';
import { Mono, PulsingDot } from './SharedUI';
import { situationColors } from '../assets/displayConfig';
import { styles } from '../theme/styles';
import type { PodTelemetry } from '../services/telemetry';
import type { RescuerCoords } from '../services/rescuerLocation';

const LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <style>
    html, body, #map {
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
    }
    .custom-pin {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      font-weight: bold;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      transition: all 0.2s ease-in-out;
    }
    .rescuer-pin {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background-color: #2563eb;
      border: 2.5px solid #ffffff;
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.4);
      position: relative;
    }
    @keyframes pulse {
      0% {
        transform: scale(0.9);
        box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 8px rgba(37, 99, 235, 0);
      }
      100% {
        transform: scale(0.9);
        box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
      }
    }
    .rescuer-pulsing {
      animation: pulse 1.8s infinite;
    }
    @keyframes pulse-circle {
      0% {
        stroke-opacity: 0.3;
        fill-opacity: 0.08;
      }
      50% {
        stroke-opacity: 0.8;
        fill-opacity: 0.18;
      }
      100% {
        stroke-opacity: 0.3;
        fill-opacity: 0.08;
      }
    }
    .glowing-web {
      animation: pulse-circle 2.5s infinite ease-in-out;
      filter: drop-shadow(0 0 4px #2563eb);
    }
    .pod-pin {
      width: 22px;
      height: 22px;
      box-sizing: border-box;
      border-radius: 6px;
      border: 2px solid #ffffff;
      background-color: #334155;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      font-weight: bold;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    }
    .pod-pin.pod-alert {
      background-color: #dc2626;
    }
    .disaster-zone-tooltip {
      background: transparent;
      border: none;
      box-shadow: none;
      color: #374151;
      font-weight: bold;
      font-size: 10px;
      text-shadow: 0 0 3px #ffffff, 0 0 3px #ffffff, 0 0 3px #ffffff;
      padding: 0;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false
    }).setView([6.9394, 122.0796], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    var victimMarkers = {};
    var centeredLiveVictims = {};
    var podMarkers = {};
    var rescuerMarker = null;
    var rescuerAccuracyCircle = null;
    var centeredOnRescuer = false;

    function escapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function updateRescuer(rescuer, hasSelectedVictim) {
      if (!rescuer) {
        if (rescuerMarker) { map.removeLayer(rescuerMarker); rescuerMarker = null; }
        if (rescuerAccuracyCircle) { map.removeLayer(rescuerAccuracyCircle); rescuerAccuracyCircle = null; }
        return;
      }
      var latlng = [rescuer.lat, rescuer.lng];
      var radius = (typeof rescuer.accuracy === 'number' && rescuer.accuracy > 0) ? rescuer.accuracy : 0;

      if (rescuerAccuracyCircle) {
        rescuerAccuracyCircle.setLatLng(latlng);
        rescuerAccuracyCircle.setRadius(radius);
      } else {
        rescuerAccuracyCircle = L.circle(latlng, {
          radius: radius,
          color: '#2563eb',
          weight: 1,
          opacity: 0.4,
          fillColor: '#2563eb',
          fillOpacity: 0.08,
          interactive: false
        }).addTo(map);
      }

      if (rescuerMarker) {
        rescuerMarker.setLatLng(latlng);
      } else {
        var rescuerIcon = L.divIcon({
          className: 'rescuer-icon',
          html: '<div class="rescuer-pin rescuer-pulsing"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });
        rescuerMarker = L.marker(latlng, { icon: rescuerIcon, zIndexOffset: 1000 }).addTo(map);
        rescuerMarker.bindPopup('<b>You are here</b>');
      }

      if (!centeredOnRescuer) {
        centeredOnRescuer = true;
        if (!hasSelectedVictim) {
          map.setView(latlng, Math.max(map.getZoom(), 17));
        }
      }
    }

    function podPopupHtml(p) {
      return '<b>Pod ' + escapeHtml(p.nodeId) + '</b>' +
        '<br>RSSI ' + escapeHtml(p.loraRssi) + ' dBm · Hops: ' + escapeHtml(p.hopCount) +
        '<br>Victims nearby: ' + escapeHtml(p.bleVictims) +
        '<br>Last seen: ' + (p.lastSeenSec == null ? 'unknown' : escapeHtml(p.lastSeenSec) + 's ago');
    }

    function updatePods(pods) {
      var newIds = pods.map(function(p) { return p.nodeId; });
      for (var id in podMarkers) {
        if (newIds.indexOf(id) === -1) {
          map.removeLayer(podMarkers[id].marker);
          delete podMarkers[id];
        }
      }

      pods.forEach(function(p) {
        var latlng = [p.lat, p.lng];
        var existing = podMarkers[p.nodeId];
        if (existing) {
          existing.marker.setLatLng(latlng);
          if (existing.isAlert !== p.isAlert) {
            existing.marker.setIcon(makePodIcon(p.isAlert));
            existing.isAlert = p.isAlert;
          }
          existing.marker.setPopupContent(podPopupHtml(p));
        } else {
          // Info-only: popup on tap, no selectVictim message.
          var marker = L.marker(latlng, { icon: makePodIcon(p.isAlert) }).addTo(map);
          marker.bindPopup(podPopupHtml(p));
          podMarkers[p.nodeId] = { marker: marker, isAlert: p.isAlert };
        }
      });
    }

    function makePodIcon(isAlert) {
      return L.divIcon({
        className: 'pod-icon',
        html: '<div class="pod-pin' + (isAlert ? ' pod-alert' : '') + '">P</div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
    }

    function getSituationColor(situation) {
      if (situation === 'SOS') return '#dc2626';
      if (situation === 'trapped') return '#dc2626';
      if (situation === 'injured') return '#d97706';
      if (situation === 'safe') return '#15803d';
      return '#9ca3af';
    }

    function getDisasterEmoji(disaster) {
      if (!disaster) return '';
      var d = disaster.toLowerCase();
      if (d === 'flood') return '🌊';
      if (d === 'landslide') return '🪨';
      if (d === 'earthquake') return '🏢';
      if (d === 'fire') return '🔥';
      return '⚠️';
    }

    function sendReadyMessage() {
      var msg = JSON.stringify({ type: 'ready' });
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(msg);
      } else {
        window.parent.postMessage(msg, '*');
      }
    }

    map.whenReady(function() {
      sendReadyMessage();
    });

    function updateMap(data) {
      if (data.pods) {
        updatePods(data.pods);
      }
      if ('rescuer' in data) {
        updateRescuer(data.rescuer, Boolean(data.hasSelectedVictim));
      }
      if (data.victims) {
        data.victims.forEach(function(v) {
          if (v.isLive && !centeredLiveVictims[v.id]) {
            map.setView([v.lat, v.lng], 17);
            centeredLiveVictims[v.id] = true;
          }
        });
        var newIds = data.victims.map(function(v) { return v.id; });
        for (var id in victimMarkers) {
          if (newIds.indexOf(id) === -1) {
            map.removeLayer(victimMarkers[id]);
            delete victimMarkers[id];
          }
        }

        data.victims.forEach(function(v) {
          var color = getSituationColor(v.situation);
          var borderStyle = v.isSelected ? 'border: 3.5px solid #000000; scale: 1.25;' : 'border: 2px solid #ffffff;';
          var locationNote = v.isLive
            ? (v.hasGpsFix ? '<br>Location: GPS fix' : '<br>Location: approximate — pod has no GPS fix')
            : '';
          
          var disasterEmoji = getDisasterEmoji(v.disasterType);
          var badgeHtml = disasterEmoji ? '<span style="position: absolute; top: -10px; right: -10px; background: white; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); z-index: 1000;">' + disasterEmoji + '</span>' : '';

          var victimIcon = L.divIcon({
            className: 'victim-icon-' + v.id,
            html: '<div class="custom-pin" style="background-color: ' + color + '; ' + borderStyle + '">' + v.idx + badgeHtml + '</div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          if (victimMarkers[v.id]) {
            victimMarkers[v.id].setLatLng([v.lat, v.lng]);
            victimMarkers[v.id].setIcon(victimIcon);
            victimMarkers[v.id].setPopupContent("<b>" + v.label + "</b><br>Status: " + v.situation.toUpperCase() + "<br>Disaster: " + (v.disasterType ? v.disasterType.toUpperCase() : 'N/A') + "<br>Floor: " + (v.floor === 0 ? 'G' : v.floor) + locationNote);
          } else {
            var marker = L.marker([v.lat, v.lng], { icon: victimIcon }).addTo(map);
            marker.bindPopup("<b>" + v.label + "</b><br>Status: " + v.situation.toUpperCase() + "<br>Disaster: " + (v.disasterType ? v.disasterType.toUpperCase() : 'N/A') + "<br>Floor: " + (v.floor === 0 ? 'G' : v.floor) + locationNote);
            
            marker.on('click', function() {
              var msg = JSON.stringify({ type: 'selectVictim', id: v.id });
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(msg);
              } else {
                window.parent.postMessage(msg, '*');
              }
            });

            victimMarkers[v.id] = marker;
          }

          if (v.isSelected) {
            victimMarkers[v.id].openPopup();
          }
        });
      }
    }

    function handleWindowMessage(e) {
      try {
        var data = JSON.parse(e.data);
        if (data.type === 'update') {
          updateMap(data);
        }
      } catch (err) {}
    }

    document.addEventListener('message', handleWindowMessage);
    window.addEventListener('message', handleWindowMessage);
  </script>
</body>
</html>
`;

export function MapView({
  victims,
  selectedVictim,
  onSelectVictim,
  selectedFloor,
  setSelectedFloor,
  userPos,
  setUserPos,
  rescuerCoords = null,
  pods = [],
  isNavigating,
  setIsNavigating,
  toast,
  onUpdateSituation,
  rescuerEmergency,
  onUpdateRescuerEmergency,
}: {
  victims: any[];
  selectedVictim: string;
  onSelectVictim: (id: string) => void;
  selectedFloor: string;
  setSelectedFloor: (floor: string) => void;
  userPos: { x: number; y: number };
  setUserPos: (pos: { x: number; y: number }) => void;
  rescuerCoords?: RescuerCoords | null;
  pods?: PodTelemetry[];
  isNavigating: boolean;
  setIsNavigating: (val: boolean) => void;
  toast: any;
  onUpdateSituation: (id: string) => void;
  rescuerEmergency: "trapped" | "injured" | null;
  onUpdateRescuerEmergency: (status: "trapped" | "injured" | null) => void;
}) {
  const gridCells = 12;
  const [mapLayout, setMapLayout] = useState({ width: 0, height: 0 });
  const [showSosModal, setShowSosModal] = useState(false);

  // Rescuer node blinking animation
  const rescuerScale = useRef(new Animated.Value(1)).current;
  const rescuerOpacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(rescuerScale, {
            toValue: 2.2,
            duration: 1200,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(rescuerScale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
        Animated.sequence([
          Animated.timing(rescuerOpacity, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(rescuerOpacity, {
            toValue: 0.8,
            duration: 0,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      ])
    ).start();
  }, [rescuerScale, rescuerOpacity]);

  // Leaflet Map Settings & Refs
  const [mapType, setMapType] = useState<'leaflet' | 'indoor'>('leaflet');
  const [mapReady, setMapReady] = useState(false);
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const hasLiveAlert = victims.some((victim) => victim.isLive);

  useEffect(() => {
    if (hasLiveAlert) setMapType('leaflet');
  }, [hasLiveAlert]);

  const victimGpsList = victims
    .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng))
    .map((v, idx) => {
      return {
        id: v.id,
        label: v.label,
        idx: idx + 1,
        lat: v.lat,
        lng: v.lng,
        situation: v.situation,
        floor: v.floor,
        isSelected: selectedVictim === v.id,
        disasterType: v.disasterType,
        isLive: Boolean(v.isLive),
        hasGpsFix: Boolean(v.hasGpsFix),
      };
    });

  const podGpsList = pods
    .filter((p) => p.fix && p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => {
      const receivedMs = Date.parse(p.receivedAt);
      return {
        nodeId: p.nodeId,
        lat: p.lat as number,
        lng: p.lng as number,
        loraRssi: p.loraRssi,
        hopCount: p.hopCount,
        bleVictims: p.bleVictims,
        isAlert: p.msgType === 1 || p.bleVictims > 0,
        lastSeenSec: Number.isFinite(receivedMs)
          ? Math.max(0, Math.round((Date.now() - receivedMs) / 1000))
          : null,
      };
    });

  const rescuerGps =
    rescuerCoords && Number.isFinite(rescuerCoords.lat) && Number.isFinite(rescuerCoords.lng)
      ? { lat: rescuerCoords.lat, lng: rescuerCoords.lng, accuracy: rescuerCoords.accuracy }
      : null;

  const sendMapUpdate = () => {
    const data = {
      type: 'update',
      victims: victimGpsList,
      pods: podGpsList,
      rescuer: rescuerGps,
      hasSelectedVictim: victimGpsList.some((v) => v.isSelected),
    };

    const dataStr = JSON.stringify(data);

    if (Platform.OS === 'web') {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(dataStr, '*');
      }
    } else {
      if (webViewRef.current) {
        webViewRef.current.postMessage(dataStr);
      }
    }
  };

  // Sync data to map once ready, or when values update
  useEffect(() => {
    if (mapReady) {
      sendMapUpdate();
    }
  }, [mapReady, victims, selectedVictim, rescuerCoords, pods]);

  // Reset ready state when mapType changes to force a fresh hand-shake
  useEffect(() => {
    setMapReady(false);
  }, [mapType]);

  // Web iframe message listener
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleWebMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ready') {
            setMapReady(true);
          } else if (data.type === 'selectVictim') {
            onSelectVictim(data.id);
          }
        } catch (err) {
          // Ignore non-JSON messages
        }
      };
      window.addEventListener('message', handleWebMessage);
      return () => window.removeEventListener('message', handleWebMessage);
    }
  }, [onSelectVictim]);

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        setMapReady(true);
      } else if (data.type === 'selectVictim') {
        onSelectVictim(data.id);
      }
    } catch (err) {
      console.warn("Error parsing WebView message:", err);
    }
  };

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

  const selectedV = victims.find(
    (v) => !v.isLive && v.id === selectedVictim && Number.isFinite(v.lat) && Number.isFinite(v.lng),
  );
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
            {mapType === 'leaflet' ? (
              <MapPin size={14} color="#dc2626" style={{ marginRight: 6 }} />
            ) : (
              <Layers size={14} color="#000000" style={{ marginRight: 6 }} />
            )}
            <Text style={styles.mapHeaderText}>
              {mapType === 'leaflet' ? 'GPS Online Map' : `Offline Map — Floor ${selectedFloor}`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* Toggle Switch */}
            <View style={styles.row}>
              <View style={[styles.mapDotIndicator, { backgroundColor: mapType === 'leaflet' ? '#22c55e' : '#f59e0b' }]} />
              <Mono style={styles.mapHeaderStatusText}>
                {mapType === 'leaflet' ? 'ONLINE' : 'CACHED'}
              </Mono>
            </View>
          </View>
        </View>

        {mapType === 'indoor' ? (
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
                <Animated.View
                  style={[
                    rescuerEmergency === "trapped"
                      ? styles.userIconPingTrapped
                      : rescuerEmergency === "injured"
                      ? styles.userIconPingInjured
                      : styles.userIconPing,
                    {
                      transform: [{ scale: rescuerScale }],
                      opacity: rescuerOpacity,
                    }
                  ]}
                />
                <Animated.View
                  style={[
                    rescuerEmergency === "trapped"
                      ? styles.userIconPulseTrapped
                      : rescuerEmergency === "injured"
                      ? styles.userIconPulseInjured
                      : styles.userIconPulse,
                    {
                      transform: [{ scale: Animated.multiply(rescuerScale, 0.7) }],
                      opacity: rescuerOpacity,
                    }
                  ]}
                />
                <View
                  style={
                    rescuerEmergency === "trapped"
                      ? styles.userIconCenterTrapped
                      : rescuerEmergency === "injured"
                      ? styles.userIconCenterInjured
                      : styles.userIconCenter
                  }
                >
                  {rescuerEmergency && (
                    <AlertTriangle size={8} color="#ffffff" />
                  )}
                </View>
              </View>
            </View>

            {victims.map((v, idx) => {
              if (v.isLive) return null;
              if (!Number.isFinite(v.mapX) || !Number.isFinite(v.mapY)) return null;
              const coords = { x: v.mapX, y: v.mapY };
              const isSelected = selectedVictim === v.id;

              const victimFloorStr = v.floor === 0 ? "G" : String(v.floor);
              if (victimFloorStr !== selectedFloor) return null;

              const dotColor =
                v.situation === "trapped" ? "#dc2626" :
                v.situation === "injured" ? "#d97706" :
                v.situation === "safe" ? "#15803d" :
                "#9ca3af";

              const disasterEmoji =
                v.disasterType?.toLowerCase() === "flood" ? "🌊" :
                v.disasterType?.toLowerCase() === "landslide" ? "🪨" :
                v.disasterType?.toLowerCase() === "earthquake" ? "🏢" :
                v.disasterType?.toLowerCase() === "fire" ? "🔥" :
                "⚠️";

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
                    {v.disasterType && (
                      <View style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        backgroundColor: '#ffffff',
                        borderRadius: 6,
                        width: 13,
                        height: 13,
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.2,
                        shadowRadius: 1,
                        elevation: 2,
                      }}>
                        <Text style={{ fontSize: 8 }}>{disasterEmoji}</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.mapVictimStem, { backgroundColor: dotColor }]} />
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              onPress={() => setShowSosModal(true)}
              style={styles.mapSosHud}
            >
              <LifeBuoy size={16} color="#ffffff" />
              <Text style={styles.mapSosHudText}>SOS</Text>
            </TouchableOpacity>

            <View style={styles.mapCompassHud}>
              <Mono style={styles.mapCompassText}>N</Mono>
            </View>

            <View style={styles.mapScaleHud}>
              <View style={styles.mapScaleBar} />
              <Mono style={styles.mapScaleText}>20 m</Mono>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.mapBody, { overflow: 'hidden' }]}>
            {Platform.OS === 'web' ? (
              <iframe
                ref={iframeRef as any}
                srcDoc={LEAFLET_HTML}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            ) : (
              <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: LEAFLET_HTML }}
                style={{ flex: 1, backgroundColor: '#f3f4f6' }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                onMessage={handleWebViewMessage}
              />
            )}

            {/* Overlaid HUD HUD elements on Leaflet */}
            <TouchableOpacity
              onPress={() => setShowSosModal(true)}
              style={styles.mapSosHud}
            >
              <LifeBuoy size={16} color="#ffffff" />
              <Text style={styles.mapSosHudText}>SOS</Text>
            </TouchableOpacity>

            <View style={styles.mapCompassHud}>
              <Mono style={styles.mapCompassText}>N</Mono>
            </View>
            {victimGpsList.length === 0 && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: '45%',
                  alignSelf: 'center',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: 'rgba(255,255,255,0.92)',
                }}
              >
                <Text style={{ color: '#4b5563', fontSize: 12 }}>
                  No GPS-based SOS locations received.
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#dc2626' }]} />
            <Mono style={styles.legendText}>Live SOS (pod GPS location)</Mono>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#334155', borderRadius: 3 }]} />
            <Mono style={styles.legendText}>Pod (LoRa node)</Mono>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2563eb' }]} />
            <Mono style={styles.legendText}>You</Mono>
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
              {selectedV.disasterType && (
                <Text style={[styles.navStatusText, { marginTop: 2 }]}>
                  Disaster: <Text style={{ fontWeight: 'bold', color: '#dc2626' }}>{selectedV.disasterType.toUpperCase()}</Text>
                </Text>
              )}
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

      {showSosModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Rescuer Emergency (SOS)</Text>
              <TouchableOpacity onPress={() => setShowSosModal(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Select your emergency status. This will alert all other active respondents.
            </Text>

            {/* Trapped Option */}
            <TouchableOpacity
              onPress={() => {
                onUpdateRescuerEmergency("trapped");
                setShowSosModal(false);
              }}
              style={[
                styles.modalOptionRow,
                {
                  backgroundColor: rescuerEmergency === "trapped" ? "#dc2626" : "#ffffff",
                  borderColor: "#dc2626",
                },
              ]}
            >
              <View
                style={[
                  styles.modalOptionDot,
                  { backgroundColor: rescuerEmergency === "trapped" ? "#ffffff" : "#dc2626" },
                ]}
              />
              <Text
                style={[
                  styles.modalOptionText,
                  { color: rescuerEmergency === "trapped" ? "#ffffff" : "#dc2626" },
                ]}
              >
                TRAPPED
              </Text>
            </TouchableOpacity>

            {/* Injured Option */}
            <TouchableOpacity
              onPress={() => {
                onUpdateRescuerEmergency("injured");
                setShowSosModal(false);
              }}
              style={[
                styles.modalOptionRow,
                {
                  backgroundColor: rescuerEmergency === "injured" ? "#d97706" : "#ffffff",
                  borderColor: "#d97706",
                },
              ]}
            >
              <View
                style={[
                  styles.modalOptionDot,
                  { backgroundColor: rescuerEmergency === "injured" ? "#ffffff" : "#d97706" },
                ]}
              />
              <Text
                style={[
                  styles.modalOptionText,
                  { color: rescuerEmergency === "injured" ? "#ffffff" : "#d97706" },
                ]}
              >
                INJURED
              </Text>
            </TouchableOpacity>

            {/* Safe / Clear Option */}
            {rescuerEmergency !== null && (
              <TouchableOpacity
                onPress={() => {
                  onUpdateRescuerEmergency(null);
                  setShowSosModal(false);
                }}
                style={[
                  styles.modalOptionRow,
                  {
                    backgroundColor: "#15803d",
                    borderColor: "#15803d",
                  },
                ]}
              >
                <View style={[styles.modalOptionDot, { backgroundColor: "#ffffff" }]} />
                <Text style={[styles.modalOptionText, { color: "#ffffff" }]}>
                  RESOLVE / I'M SAFE
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setShowSosModal(false)}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  toggleText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: '#4b5563',
  },
  toggleTextActive: {
    color: '#111827',
  },
});
