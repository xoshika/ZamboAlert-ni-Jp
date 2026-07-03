import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Circle, Line, Rect, G } from 'react-native-svg';
import { Navigation, ShieldAlert, HeartPulse, ChevronRight, MapPin, X } from 'lucide-react-native';
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
