import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { AlertTriangle, MapPin } from 'lucide-react-native';
import { Mono, PulsingDot } from '../components/SharedUI';
import { styles } from '../theme/styles';
import { CitizenSosReport } from '../services/telemetry';

export interface PodNode {
  id: string;
  rssi: number;
  snr: number;
  hops: number;
  receivedAt: string;
  hasGpsFix: boolean;
  isSos?: boolean;
  bleVictims?: number;
  nearestVictimId?: string;
  gatewayId?: string;
}

interface PodsViewProps {
  nodes: PodNode[];
  citizenSosList?: CitizenSosReport[];
  onSelectSos?: (id: string) => void;
}

export function PodsView({ nodes, citizenSosList = [], onSelectSos }: PodsViewProps) {
  const podSosCount = nodes.filter((n) => n.isSos || (n.bleVictims && n.bleVictims > 0)).length;
  const totalSosCount = podSosCount + citizenSosList.length;

  return (
    <View style={styles.viewContainer}>
      <View style={styles.podsOverviewGrid}>
        <View style={styles.podsOverviewCard}>
          <Mono style={[styles.podsOverviewVal, { color: '#000000' }]}>{nodes.length}</Mono>
          <Mono style={styles.podsOverviewLabel}>RECENT PODS</Mono>
        </View>

        <View style={[styles.podsOverviewCard, totalSosCount > 0 ? { borderColor: '#fca5a5', backgroundColor: '#fef2f2' } : null]}>
          <Mono style={[styles.podsOverviewVal, { color: totalSosCount > 0 ? '#dc2626' : '#22c55e' }]}>
            {totalSosCount}
          </Mono>
          <Mono style={[styles.podsOverviewLabel, totalSosCount > 0 ? { color: '#dc2626' } : null]}>
            ACTIVE SOS
          </Mono>
        </View>
      </View>

      {/* Citizen Direct App SOS Section */}
      {citizenSosList.length > 0 && (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <AlertTriangle size={14} color="#dc2626" />
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#dc2626', letterSpacing: 0.5 }}>
              DIRECT CITIZEN SOS ALERTS ({citizenSosList.length})
            </Text>
          </View>

          {citizenSosList.map((sos) => (
            <View
              key={sos.id || sos.clientId}
              style={[styles.podCard, { borderColor: '#fca5a5', backgroundColor: '#fff5f5' }]}
            >
              <View style={styles.podCardHeader}>
                <View style={styles.podCardLeft}>
                  <PulsingDot color="#ef4444" />
                  <View style={styles.podCardMeta}>
                    <Mono style={[styles.podCardTitle, { color: '#b91c1c' }]}>
                      CITIZEN SOS: {sos.name || 'Citizen'}
                    </Mono>
                    <Mono style={styles.podCardSubText}>
                      {new Date(sos.receivedAt).toLocaleTimeString()} · GPS {sos.lat?.toFixed(5)}, {sos.lng?.toFixed(5)}
                    </Mono>
                  </View>
                </View>
                <View style={{ backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 }}>
                  <Text style={[styles.miniBadgeText, { color: '#ffffff' }]}>
                    {(sos.disasterType || 'EMERGENCY').toUpperCase()}
                  </Text>
                </View>
              </View>

              {onSelectSos && (
                <TouchableOpacity
                  onPress={() => onSelectSos(sos.id || `SOS-${sos.clientId}`)}
                  style={{
                    marginTop: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: '#dc2626',
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <MapPin size={13} color="#ffffff" />
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#ffffff' }}>
                    LOCATE ON MAP / RADAR
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* LoRa Pods List */}
      <View style={styles.listContainer}>
        {nodes.length === 0 ? (
          <View style={styles.podCard}>
            <Text style={styles.podCardSubText}>No recent pod telemetry received from the gateway.</Text>
          </View>
        ) : nodes.map((node) => {
            const hasSosAlert = node.isSos || (typeof node.bleVictims === 'number' && node.bleVictims > 0);
            return (
              <View
                key={node.id}
                style={[styles.podCard, hasSosAlert ? { borderColor: '#fca5a5', backgroundColor: '#fffdfd' } : null]}
              >
                <View style={styles.podCardHeader}>
                  <View style={styles.podCardLeft}>
                    <PulsingDot color={hasSosAlert ? "#ef4444" : "#22c55e"} />
                    <View style={styles.podCardMeta}>
                      <Mono style={[styles.podCardTitle, hasSosAlert ? { color: '#dc2626' } : null]}>
                        POD {node.id}
                        {node.gatewayId === 'CITIZEN-APP-GATEWAY' ? ' (App Beacon)' : ''}
                      </Mono>
                      <Mono style={styles.podCardSubText}>
                        {new Date(node.receivedAt).toLocaleTimeString()} · {node.hasGpsFix ? 'GPS fix' : 'No GPS fix'}
                      </Mono>
                    </View>
                  </View>
                  {hasSosAlert ? (
                    <View style={{ backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 }}>
                      <Text style={[styles.miniBadgeText, { color: '#ffffff' }]}>SOS ALERT</Text>
                    </View>
                  ) : (
                    <Text style={styles.miniBadgeText}>RECENT</Text>
                  )}
                </View>

                {hasSosAlert && (
                  <View style={styles.podAlertBanner}>
                    <AlertTriangle size={13} color="#dc2626" />
                    <Text style={styles.podAlertText}>
                      SOS Beacon Active · {node.bleVictims || 1} victim(s) in range
                      {node.nearestVictimId ? ` (${node.nearestVictimId})` : ''}
                    </Text>
                  </View>
                )}

                <View style={[styles.podStatsRow, hasSosAlert ? { marginTop: 10 } : null]}>
                  <View style={styles.podStatCol}>
                    <Text style={styles.podStatLabel}>LoRa RSSI</Text>
                    <Mono style={styles.podStatVal}>{node.rssi} dBm</Mono>
                  </View>
                  <View style={styles.podStatCol}>
                    <Text style={styles.podStatLabel}>SNR</Text>
                    <Mono style={styles.podStatVal}>{node.snr.toFixed(1)} dB</Mono>
                  </View>
                  <View style={styles.podStatCol}>
                    <Text style={styles.podStatLabel}>Hops</Text>
                    <Mono style={styles.hopsVal}>{node.hops}</Mono>
                  </View>
                </View>
              </View>
            );
          })}
      </View>
    </View>
  );
}

