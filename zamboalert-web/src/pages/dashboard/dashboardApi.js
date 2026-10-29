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

/**
 * Generic fetch wrapper — all API calls go to the unified backend.
 * @param {string} endpoint - e.g. '/api/rescuers'
 * @param {RequestInit} options - standard fetch options
 */
export async function apiFetch(endpoint, options = {}) {
  const { headers, ...rest } = options;
  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
  });
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
