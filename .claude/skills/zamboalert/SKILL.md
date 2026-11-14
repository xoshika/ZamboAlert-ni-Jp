---
name: zamboalert
description: Work on the ZamboAlert emergency communication system (Express/SQLite backend, Expo React Native app, React+Vite web dashboard, ESP32 LoRa firmware). Use when changing API routes, auth, SOS/telemetry, rescuer verification, the mobile or web UI, deployment on Render, or the gateway/pod firmware.
---

# ZamboAlert

IoT emergency communication for barangay disaster response in Zamboanga City: LoRa mesh with Bluetooth fallback when cellular/power is down.

## Layout

| Path | What | Run |
|---|---|---|
| `backend/src/index.js`, `database.js` | Express + SQLite (`zamboalert.db`), port 3000, all routes in `index.js` | `npm run dev` |
| `zamboalert-app/` | Expo RN app (citizens + rescuers) | `npm start`; BLE needs `npm run android` (native build, not Expo Go) |
| `zamboalert-web/` | React + Vite + Tailwind v4 dashboard (barangay officials) | `npm run dev` / `npm run build` |
| `firmware/zamboalert-gateway`, `zamboalert-pod` | ESP32 PlatformIO (LoRa gateway; deployable pod with BLE scan + GPS that works placed stationary or carried/moved) | PlatformIO |

Backend needs `backend/.env` (copy `.env.example`; set `GATEWAY_API_KEY`, `JWT_SECRET`).

## Rules that bite

1. **Rescuer dual-table sync.** Rescuers live in `users` (mobile auth) and `rescuers` (web admin). Any approval path must update both `users.is_rescuer_verified` and `rescuers.is_verified`. Reference implementations: `POST /api/rescuers/verify/:id` and `POST /api/admin/rescuers/:id/approve`. Touching one without the other is the known bug class.
2. **Dual password hashes.** Every user stores SHA-256 (mobile) and bcrypt (web). Signup, password change and reset must write both.
3. **Auth differs by client.** Mobile: session token returned on login. Web (`barangay_official`): bcrypt, then 2FA email code, then JWT stored in `localStorage` as `zamboalert_auth` (has `expiry`; `PrivateRoute` enforces). Dashboard routes are guarded server-side by `requireOfficial` (Bearer JWT, official/admin roles); new dashboard routes must use it, and the web must call them via `apiFetch`/`downloadFile` so the token is sent.
4. **Live data is in-memory.** `podTelemetry[]` (90s TTL) and `citizenSos[]` (10 min TTL) reset on restart. Don't persist-assume them.
5. **Route order.** Declare `/api/incidents/export` and `/api/manpower/export` before any `/:id` route with the same prefix.
6. **Gateway auth.** `POST /api/telemetry` requires `X-Gateway-Key` matching `GATEWAY_API_KEY`; the key is shared with gateway firmware.
7. **Admin routes.** `/api/admin/*` is guarded by `ADMIN_API_KEY`; in production (`NODE_ENV=production`) it must fail closed if unset. Don't log fallback verification codes in production.
8. **Mobile API URL** is hardcoded in `zamboalert-app/src/config.ts` (`API_BASE_URL`); changing it requires a rebuild. Web uses `VITE_API_BASE_URL`.

## Key API surface

- `POST /api/telemetry` (gateway), `GET /api/telemetry` (web polls every 3s)
- `POST /api/sos` (citizen phone SOS, mirrored as a virtual telemetry pod)
- `POST /api/auth/login` (unified; token for mobile, 2FA for web)
- `GET /api/rescuers` (joins `rescuers` + `users`, includes ID photo URIs)
- `/api/incidents`, `/api/households`, `/api/logs/casualties`, `/api/manpower/*` (web CRUD)

## App structure

- Mobile: `App.tsx` -> `RootNavigator` -> `CitizenNavigator` (SOS, Status, Log, Settings) or `RescuerNavigator` (PodsView, LogView, `src/rescuer/*`). Auth: Welcome -> Login/SignUp -> email verification -> home; unapproved rescuers see `RescuerVerificationScreen`. Providers: `AuthContext`, `AppStateContext`.
- Web: `LoginPage` -> `DashboardPage` (Leaflet/Mapbox tactical map), `SettingsPage`, `PersonnelAlertPage`. Firebase is initialized but the Express REST API is the real data source.

## Deployment (Render, `render.yaml`)

`zamboalert-backend` (Node, root `backend/`) and `zamboalert-web` (static, root `zamboalert-web/`, serves `dist/`). Set manually on Render: `GATEWAY_API_KEY`, `JWT_SECRET` (backend exits without it), `ADMIN_API_KEY`, and email via `GMAIL_USER`+`GMAIL_APP_PASSWORD` or `RESEND_API_KEY`/`BREVO_API_KEY`.

## Workflow

- Backend change: read the relevant block in `index.js` first; keep conventions (all routes in one file, SQLite via `database.js`). Check both clients' callers (`zamboalert-app/src`, `zamboalert-web/src`) before changing a response shape.
- Auth/verification change: check rules 1-3 above.
- Verify: backend `npm run dev` and hit the endpoint; web `npm run build`; mobile type-check with `npx tsc --noEmit` in `zamboalert-app`. Firmware cannot be tested without hardware, so say so rather than claiming it works.
