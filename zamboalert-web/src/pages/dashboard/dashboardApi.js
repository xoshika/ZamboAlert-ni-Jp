/**
 * dashboardApi.js — Unified API client for zamboalert-web
 *
 * All endpoints now live on the single unified backend (default: http://localhost:3000).
 * Set VITE_API_BASE_URL in zamboalert-web/.env to override (e.g. for LAN demos or cloud).
 *
 * Example .env:
 *   VITE_API_BASE_URL=http://localhost:3000
 *   # LAN demo: VITE_API_BASE_URL=http://192.168.x.x:3000
 */

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_TELEMETRY_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const AUTH_STORAGE_KEY = 'zamboalert_auth';

/** The dashboard session token saved at login (JWT from 2FA), or ''. */
function getAuthToken() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
    return typeof saved?.token === 'string' ? saved.token : '';
  } catch {
    return '';
  }
}

/** The backend rejected the session: clear it and return to the login page. */
function handleUnauthorized() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  if (window.location.pathname !== '/login') window.location.assign('/login');
}

/**
 * Generic fetch wrapper — all API calls go to the unified backend.
 * Sends the dashboard session token; a 401 signs the user out.
 * @param {string} endpoint - e.g. '/api/rescuers'
 * @param {RequestInit} options - standard fetch options
 */
export async function apiFetch(endpoint, options = {}) {
  const { headers, ...rest } = options;
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });
  if (response.status === 401) handleUnauthorized();
  return response;
}

/**
 * Downloads a protected file (e.g. a CSV export) with the session token.
 * A plain link or window.open can't send the Authorization header.
 */
export async function downloadFile(endpoint, fallbackName) {
  const response = await apiFetch(endpoint);
  if (!response.ok) throw new Error(`Download failed (${response.status}).`);
  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Live pod telemetry — LoRa hardware nodes & citizen virtual pods.
 * Served directly from the unified backend at /api/telemetry.
 */
export async function fetchTelemetry(options = {}) {
  return apiFetch('/api/telemetry', options);
}

/**
 * Live citizen phone-GPS SOS signals.
 * Served directly from the unified backend at /api/sos.
 */
export async function fetchCitizenSos(options = {}) {
  return apiFetch('/api/sos', options);
}

// ── Legacy exports kept for backward-compat with any older imports ─────────────
/** @deprecated Use API_BASE_URL */
export const ADMIN_API_PORTS = [3000];
/** @deprecated Use API_BASE_URL */
export const TELEMETRY_API_PORTS = [3000];
/** @deprecated Use API_BASE_URL */
export const API_PORTS = [3000];
