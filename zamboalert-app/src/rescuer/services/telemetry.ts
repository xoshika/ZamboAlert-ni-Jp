import { API_BASE_URL } from '../../config';

export interface PodTelemetry {
  nodeId: string;
  gatewayId?: string;
  seq: number;
  msgType: number;
  fix: boolean;
  lat: number | null;
  lng: number | null;
  gatewayLat: number;
  gatewayLng: number;
  sats: number;
  bleVictims: number;
  nearestRssi: number;
  nearestVictimId: string;
  victimStatus: number;
  hopCount: number;
  loraRssi: number;
  loraSnr: number;
  receivedAt: string;
}

export interface CitizenSosReport {
  id: string;
  clientId: string;
  name: string;
  lat: number;
  lng: number;
  disasterType: string;
  status: string;
  receivedAt: string;
}

function isPodTelemetry(value: unknown): value is PodTelemetry {
  if (typeof value !== 'object' || value === null) return false;
  const report = value as Record<string, unknown>;
  return (
    typeof report.nodeId === 'string' &&
    typeof report.seq === 'number' &&
    typeof report.msgType === 'number' &&
    typeof report.fix === 'boolean' &&
    (report.lat === null || typeof report.lat === 'number') &&
    (report.lng === null || typeof report.lng === 'number') &&
    typeof report.gatewayLat === 'number' &&
    typeof report.gatewayLng === 'number' &&
    typeof report.sats === 'number' &&
    typeof report.bleVictims === 'number' &&
    typeof report.nearestRssi === 'number' &&
    typeof report.nearestVictimId === 'string' &&
    typeof report.victimStatus === 'number' &&
    typeof report.hopCount === 'number' &&
    typeof report.loraRssi === 'number' &&
    typeof report.loraSnr === 'number' &&
    typeof report.receivedAt === 'string'
  );
}

export async function fetchPodTelemetry(): Promise<PodTelemetry[]> {
  const response = await fetch(`${API_BASE_URL}/api/telemetry`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Gateway telemetry request failed (${response.status}).`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload) || !payload.every(isPodTelemetry)) {
    throw new Error('Gateway returned telemetry in an unexpected format.');
  }
  return payload;
}

export async function fetchCitizenSos(): Promise<CitizenSosReport[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sos`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return [];
    return payload as CitizenSosReport[];
  } catch (error) {
    console.error('Failed to fetch citizen SOS reports', error);
    return [];
  }
}

