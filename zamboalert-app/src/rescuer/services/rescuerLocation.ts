import { API_BASE_URL } from '../../config';

export interface RescuerCoords {
  lat: number;
  lng: number;
  accuracy: number | null;
}

/**
 * Outcome of one location upload.
 * - ok:           200, location stored
 * - unauthorized: 401, token invalid/expired; caller should stop using this token
 * - no_profile:   404, logged-in user has no rescuer profile
 * - error:        network failure or any other status
 */
export type RescuerLocationResult = 'ok' | 'unauthorized' | 'no_profile' | 'error';

/**
 * POST the rescuer's current GPS position to the backend.
 * Never throws: failures are reported through the returned result.
 */
export async function postRescuerLocation(
  token: string,
  coords: RescuerCoords,
): Promise<RescuerLocationResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/rescuers/me/location`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
      }),
    });
    if (response.ok) return 'ok';
    if (response.status === 401) return 'unauthorized';
    if (response.status === 404) return 'no_profile';
    console.warn(`Rescuer location upload failed (${response.status}).`);
    return 'error';
  } catch (error) {
    console.warn('Rescuer location upload failed', error);
    return 'error';
  }
}
