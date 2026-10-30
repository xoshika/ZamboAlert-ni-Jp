/**
 * Root backend (auth + telemetry + citizen SOS GPS).
 * Local LAN: http://<PC-LAN-IP>:3000
 * Cloud/Render: https://your-app-name.onrender.com
 *
 * ── HOW TO SWITCH ─────────────────────────────────────────────────────────
 * LAN dev:   set to  http://192.168.x.x:3000   (run ipconfig to find your IP)
 * Render:    set to  https://your-app-name.onrender.com
 *
 * After changing this value, rebuild the app (expo run:android) for it to take effect.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const API_BASE_URL = 'http://192.168.254.120:3000';
