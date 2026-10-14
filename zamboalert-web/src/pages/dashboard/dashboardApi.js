/** Barangay admin API (zamboalert-web/backend) — login, rescuers, households, etc. */
const configuredAdminPort = Number(import.meta.env.VITE_API_PORT || 5000);
export const ADMIN_API_PORTS = [...new Set([configuredAdminPort, 5000, 5001, 5002, 5003, 5010])];

/**
 * Pod telemetry + citizen SOS live on root backend :3000.
 * Web backend :5000 also proxies GET /api/telemetry and GET /api/sos when upstream is up.
 *
 * Cloud: set VITE_TELEMETRY_URL (or VITE_API_BASE_URL) to the full origin, e.g.
 *   VITE_TELEMETRY_URL=https://api.example.com
 * Local: leave unset to use localhost port fallbacks.
 */
const configuredTelemetryPort = Number(import.meta.env.VITE_TELEMETRY_PORT || 3000);
export const TELEMETRY_API_PORTS = [
  ...new Set([configuredTelemetryPort, 3000, ...ADMIN_API_PORTS]),
];

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_TELEMETRY_URL ||
  ""
).replace(/\/$/, "");

const CLOUD_ORIGIN = API_BASE_URL;

/** @deprecated Use ADMIN_API_PORTS — kept for any older imports */
export const API_PORTS = ADMIN_API_PORTS;

async function fetchAcrossPorts(ports, endpoint, options = {}) {
  const { headers, ...rest } = options;
  let lastError;

  for (const port of ports) {
    try {
      const response = await fetch(`http://localhost:${port}${endpoint}`, {
        ...rest,
        headers: {
          "Content-Type": "application/json",
          ...(headers || {}),
        },
      });

      // Skip wrong server (route missing) or empty proxy when gateway backend is down
      if (response.status === 404 || response.status === 502 || response.status === 503) {
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return fetch(`http://localhost:${ports[0]}${endpoint}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
  });
}

/** Prefer cloud origin when set; otherwise try localhost ports. */
async function fetchLiveEndpoint(endpoint, options = {}) {
  if (CLOUD_ORIGIN) {
    const { headers, ...rest } = options;
    return fetch(`${CLOUD_ORIGIN}${endpoint}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
      },
    });
  }
  return fetchAcrossPorts(TELEMETRY_API_PORTS, endpoint, options);
}

/** Admin / CRUD calls → cloud backend origin or local web backend (:5000+) */
export async function apiFetch(endpoint, options = {}) {
  if (API_BASE_URL) {
    const { headers, ...rest } = options;
    return fetch(`${API_BASE_URL}${endpoint}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
      },
    });
  }
  return fetchAcrossPorts(ADMIN_API_PORTS, endpoint, options);
}

/** Live pod telemetry → cloud origin or root :3000 / web proxy */
export async function fetchTelemetry(options = {}) {
  return fetchLiveEndpoint("/api/telemetry", options);
}

/** Live citizen phone-GPS SOS → cloud origin or root :3000 / web proxy */
export async function fetchCitizenSos(options = {}) {
  return fetchLiveEndpoint("/api/sos", options);
}
