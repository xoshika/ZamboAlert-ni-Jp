import { useState, useRef, useEffect } from 'react';
import * as Location from 'expo-location';
import { postRescuerLocation, RescuerCoords } from '../services/rescuerLocation';

export function useAnimatedValue(target: number, speed = 0.08) {
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

/**
 * Watches the device's foreground GPS while `enabled` is true.
 * Returns the latest fix, or null until one arrives (or if permission is denied).
 * `onPermissionDenied` is called at most once per mount.
 */
export function useRescuerGps(enabled: boolean, onPermissionDenied?: () => void) {
  const [coords, setCoords] = useState<RescuerCoords | null>(null);
  const deniedRef = useRef(onPermissionDenied);
  deniedRef.current = onPermissionDenied;
  const deniedNotifiedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setCoords(null);
      return;
    }

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          if (!deniedNotifiedRef.current) {
            deniedNotifiedRef.current = true;
            deniedRef.current?.();
          }
          return;
        }
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 5,
            timeInterval: 5000,
          },
          (pos) => {
            if (cancelled) return;
            const { latitude, longitude, accuracy } = pos.coords;
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
            setCoords({
              lat: latitude,
              lng: longitude,
              accuracy: typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : null,
            });
          },
        );
        if (cancelled) {
          sub.remove();
        } else {
          subscription = sub;
        }
      } catch (error) {
        console.warn('Rescuer GPS watch failed', error);
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      subscription = null;
    };
  }, [enabled]);

  return coords;
}

const LOCATION_SEND_INTERVAL_MS = 10000;
const LOCATION_RESEND_UNCHANGED_MS = 30000;

/**
 * Uploads the rescuer's latest coords to the backend every 10 s while a token and coords exist.
 * Skips a tick when coords are unchanged since the last successful send and that send was < 30 s ago.
 * Never overlaps requests. A token that gets a 401 is not retried (logged once).
 */
export function useRescuerLocationSync(token: string | null | undefined, coords: RescuerCoords | null) {
  const coordsRef = useRef(coords);
  coordsRef.current = coords;

  useEffect(() => {
    // Offline sessions carry a locally generated token the backend can never accept.
    if (!token || token.startsWith('offline-')) return;

    let active = true;
    let inFlight = false;
    let tokenRejected = false;
    let noProfileLogged = false;
    let lastSent: { lat: number; lng: number; accuracy: number | null; at: number } | null = null;

    const tick = async () => {
      if (!active || inFlight || tokenRejected) return;
      const current = coordsRef.current;
      if (!current) return;

      const now = Date.now();
      if (
        lastSent &&
        lastSent.lat === current.lat &&
        lastSent.lng === current.lng &&
        lastSent.accuracy === current.accuracy &&
        now - lastSent.at < LOCATION_RESEND_UNCHANGED_MS
      ) {
        return;
      }

      inFlight = true;
      try {
        const result = await postRescuerLocation(token, current);
        if (!active) return;
        if (result === 'ok') {
          lastSent = { ...current, at: Date.now() };
        } else if (result === 'unauthorized') {
          tokenRejected = true;
          console.warn('Rescuer location upload rejected (401); session token not accepted. Not retrying for this session.');
        } else if (result === 'no_profile') {
          // Throttle retries to the unchanged-resend window instead of every tick.
          lastSent = { ...current, at: Date.now() };
          if (!noProfileLogged) {
            noProfileLogged = true;
            console.warn('Rescuer location upload: no rescuer profile for this account (404).');
          }
        }
      } catch (error) {
        console.warn('Rescuer location upload failed', error);
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const timer = setInterval(() => {
      void tick();
    }, LOCATION_SEND_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token]);
}
