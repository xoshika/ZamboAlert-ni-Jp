import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Rect, G } from 'react-native-svg';
import { Navigation, ShieldAlert, ChevronRight, MapPin, X, Layers, LifeBuoy, AlertTriangle } from 'lucide-react-native';
import { Mono, PulsingDot } from './SharedUI';
import { VICTIM_COORDS, situationColors } from '../assets/mockData';
import { styles } from '../theme/styles';

export function MapView({
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
              <View
                style={
                  rescuerEmergency === "trapped"
                    ? styles.userIconPingTrapped
                    : rescuerEmergency === "injured"
                    ? styles.userIconPingInjured
                    : styles.userIconPing
                }
              />
              <View
                style={
                  rescuerEmergency === "trapped"
                    ? styles.userIconPulseTrapped
                    : rescuerEmergency === "injured"
                    ? styles.userIconPulseInjured
                    : styles.userIconPulse
                }
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
                {rescuerEmergency ? (
                  <AlertTriangle size={8} color="#ffffff" />
                ) : (
                  <Navigation size={8} color="#ffffff" fill="#ffffff" style={{ transform: [{ rotate: '45deg' }] }} />
                )}
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

// ── Pods View ──────────────────────────────────────────────────────────────
