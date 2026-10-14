// src/context/AppStateContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import * as Location from 'expo-location';
const BLEAdvertiser = require('react-native-ble-advertiser') as typeof import('react-native-ble-advertiser');

import { API_BASE_URL } from '../config';
import { useAuth } from './AuthContext';

const SOS_SERVICE_UUID = 'fef10001-7b82-4b93-b2c2-0f81ea3300a1';

type LogEntry = {
  id: string;
  type: 'info' | 'sos' | 'detected';
  message: string;
  time: string;
};

type Coords = {
  lat: number;
  lng: number;
};

type DisasterType = 'earthquake' | 'flood' | 'fire' | 'landslide' | null;

type AppStateContextType = {
  sosActive: boolean;
  disasterType: DisasterType;
  bluetoothOn: boolean;
  gpsLocked: boolean;
  coords: Coords | null;
  log: LogEntry[];
  startBeacon: (type: string) => Promise<void>;
  stopBeacon: () => Promise<void>;
};

const AppStateContext = createContext<AppStateContextType | null>(null);

function createClientId() {
  return `phone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const clientIdRef = useRef(createClientId());

  const [sosActive, setSosActive]       = useState(false);
  const [disasterType, setDisasterType] = useState<DisasterType>(null);
  const [bluetoothOn, setBluetoothOn]   = useState(false);
  const [gpsLocked, setGpsLocked]       = useState(false);
  const [coords, setCoords]             = useState<Coords | null>(null);
  const [log, setLog]                   = useState<LogEntry[]>([
    { id: '1', type: 'info', message: 'App initialized', time: nowLabel() },
  ]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({});
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLocked(true);
      } catch (e) {
        setGpsLocked(false);
      }
    })();
  }, []);

  function addLog(type: LogEntry['type'], message: string) {
    setLog((prev) => [{ id: String(Date.now()), type, message, time: nowLabel() }, ...prev]);
  }

  async function refreshCoords(): Promise<Coords | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return coords;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(next);
      setGpsLocked(true);
      return next;
    } catch {
      return coords;
    }
  }

  /** Best-effort phone GPS upload for web/cloud map (does not block BLE SOS). */
  async function postCitizenSos(type: string, position: Coords | null) {
    if (!position) {
      addLog('info', 'Map upload skipped — no GPS fix yet');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientIdRef.current,
          lat: position.lat,
          lng: position.lng,
          disasterType: type,
          name: user?.name || 'Citizen',
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      addLog(
        'sos',
        `Phone GPS sent to map — ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`,
      );
    } catch (error) {
      console.error('Failed to post citizen SOS GPS', error);
      addLog('info', 'Could not reach server to place SOS on web map (BLE still active)');
    }
  }

  async function clearCitizenSos() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/sos?clientId=${encodeURIComponent(clientIdRef.current)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      addLog('info', 'Phone GPS SOS cleared from map');
    } catch (error) {
      console.error('Failed to clear citizen SOS', error);
      addLog('info', 'Could not clear SOS pin on server (beacon stopped locally)');
    }
  }

  async function startBeacon(type: string) {
    try {
      if (
        !BLEAdvertiser ||
        typeof BLEAdvertiser.isActive !== 'function' ||
        typeof BLEAdvertiser.setCompanyId !== 'function' ||
        typeof BLEAdvertiser.broadcast !== 'function'
      ) {
        throw new Error('The BLE advertiser is missing from this app build. Rebuild and reinstall the native app.');
      }

      if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
        const permissions = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        const denied = Object.values(permissions).some(
          (permission) => permission !== PermissionsAndroid.RESULTS.GRANTED,
        );
        if (denied) throw new Error('Allow Nearby devices permissions to broadcast an SOS.');
      }

      if (!(await BLEAdvertiser.isActive())) {
        throw new Error('Turn on Bluetooth to broadcast an SOS.');
      }

      BLEAdvertiser.setCompanyId(0xffff);
      await BLEAdvertiser.broadcast(SOS_SERVICE_UUID, [], {
        advertiseMode: 2,
        txPowerLevel: 3,
        includeDeviceName: false,
        includeTxPowerLevel: false,
        connectable: false,
      });

      setBluetoothOn(true);
      setSosActive(true);
      setDisasterType(type as DisasterType);
      addLog('sos', `SOS beacon started — ${type.toUpperCase()} emergency — broadcasting over BLE`);

      const position = await refreshCoords();
      void postCitizenSos(type, position);
    } catch (error) {
      console.error('Failed to start BLE SOS beacon', error);
      const message = error instanceof Error ? error.message : 'Bluetooth advertising failed.';
      Alert.alert('Could not start SOS beacon', message);
    }
  }

  async function stopBeacon() {
    try {
      await BLEAdvertiser.stopBroadcast();
      addLog('info', 'SOS beacon stopped');
    } catch (error) {
      console.error('Failed to stop BLE SOS beacon', error);
      Alert.alert('Could not confirm beacon stop', 'Bluetooth may have stopped broadcasting, but the app could not confirm it.');
    }

    setBluetoothOn(false);
    setSosActive(false);
    setDisasterType(null);
    void clearCitizenSos();
  }

  return (
    <AppStateContext.Provider
      value={{ sosActive, disasterType, bluetoothOn, gpsLocked, coords, log, startBeacon, stopBeacon }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}

function nowLabel() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
