---
name: zamboalert-debugging
description: Debug ZamboAlert issues - SOS/telemetry not appearing, login/2FA failures, rescuer approval mismatches, mobile-to-backend connectivity, BLE problems, gateway/pod firmware. Use when something is broken or behaving unexpectedly.
---

# Debugging ZamboAlert

Locate the layer first, then narrow down. Reproduce with curl before touching UI code.

## Triage by symptom

| Symptom | Check |
|---|---|
| SOS/pod missing on dashboard | `GET /api/telemetry`. Empty after a backend restart is expected (`podTelemetry` 90s TTL, `citizenSos` 10 min TTL, in-memory). Gateway posts need `X-Gateway-Key` == `GATEWAY_API_KEY` (401/403 otherwise). |
| Mobile app can't reach backend | `zamboalert-app/src/config.ts` `API_BASE_URL` (LAN IP changes; Render free tier cold starts). Phone and PC must share a network; Windows firewall must allow port 3000. Rebuild after changing it. |
| Login works on mobile, fails on web (or reverse) | Dual hashes: SHA-256 (mobile) vs bcrypt (web). A user created/reset by a path that wrote only one hash breaks the other client. Inspect the `users` row. |
| Web login stuck after password | 2FA email not sent: verify `GMAIL_USER`/`GMAIL_APP_PASSWORD` or `RESEND_API_KEY`/`BREVO_API_KEY`; read backend logs. |
| Web 401 after a while | JWT / `expiry` in `localStorage` key `zamboalert_auth`; `JWT_SECRET` changed or missing (backend exits without it). |
| Rescuer approved but still blocked / listed pending | Dual-table drift: compare `users.is_rescuer_verified` vs `rescuers.is_verified`. Fix the approval path to update both. |
| `/api/incidents/export` returns an incident or 404 | Route order: export routes must precede `/:id`. |
| BLE advertise/scan fails | Expo Go can't do it; needs `npm run android` native build and runtime permissions on the device. |
| `zamboalert.db-shm` shows modified in git | DB files are tracked; don't commit incidental changes. |

## Method

1. Read the actual error: backend terminal, `adb logcat`/Metro for the app, browser console and Network tab for web.
2. Hit the endpoint directly:
   - `curl -s localhost:3000/api/telemetry`
   - `curl -s -X POST localhost:3000/api/telemetry -H "X-Gateway-Key: $KEY" -H "Content-Type: application/json" -d '{...}'`
3. Inspect SQLite: `sqlite3 backend/src/zamboalert.db "select id,email,role,is_rescuer_verified from users;"` (or a node one-liner using `database.js`).
4. Bisect client vs server: if curl works the bug is in the client; if not, the backend.
5. Firmware: `pio device monitor` in `firmware/zamboalert-gateway` or `-pod`; confirm the LoRa payload matches what `POST /api/telemetry` parses.
6. Fix the root cause, re-run the failing repro, and remove any debug logging. Never log verification codes in production.
