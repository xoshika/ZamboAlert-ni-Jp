import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { ArrowUp } from 'lucide-react-native';
import { Mono, PulsingDot } from './SharedUI';
import { situationColors } from '../assets/mockData';
import { styles } from '../theme/styles';
import { useAnimatedValue } from '../utils/hooks';

export function RadarView({
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
                  <View style={[styles.miniBadge, { backgroundColor: config.bg }]}>
                    <Text style={[styles.miniBadgeText, { color: config.text }]}>
                      {v.situation.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Map View ───────────────────────────────────────────────────────────────
