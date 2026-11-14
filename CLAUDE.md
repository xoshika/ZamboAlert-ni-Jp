# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ZamboAlert is an IoT-based emergency communication system for barangay disaster response in Zamboanga City. It operates over LoRa mesh networks with Bluetooth fallback when cellular/power is unavailable. The repo is a monorepo with three deployable components plus ESP32 firmware.

## Repository Structure

```
backend/          Node.js/Express unified backend (port 3000)
zamboalert-app/   React Native mobile app (Expo, citizens + rescuers)
zamboalert-web/   React + Vite web dashboard (barangay officials)
firmware/         ESP32 PlatformIO projects
  zamboalert-gateway/   LoRa gateway (reports to backend)
  zamboalert-pod/       Deployable signal pod (BLE scan + GPS); works placed stationary or carried/moved
```

## Commands

### Backend
```sh
cd backend
npm install
npm start          # production (node src/index.js)
npm run dev        # development (nodemon)
```
Requires `backend/.env` — copy from `backend/.env.example` and set `GATEWAY_API_KEY`.

### Mobile App
```sh
cd zamboalert-app
npm install
npm start          # Expo dev server (LAN)
npm run android    # build & install on connected Android device (requires Android SDK)
```
BLE advertisement requires a native build — `expo run:android`, not Expo Go.

### Web Dashboard
```sh
cd zamboalert-web
npm install
npm run dev        # Vite dev server
npm run build      # outputs to dist/
```
Configure `VITE_API_BASE_URL` env var for production deployments (see `render.yaml`).

## Architecture

### Backend (`backend/src/`)
Single Express server (`index.js`) with one SQLite database (`zamboalert.db` via `database.js`). All API routes are in `index.js`. Two in-memory stores reset on restart: `podTelemetry[]` (LoRa pods, 90s TTL) and `citizenSos[]` (citizen phone SOS, 10min TTL).

Auth strategy differs by role:
- **Mobile** (citizen/rescuer): SHA-256 password hash, session token returned directly on login
- **Web dashboard** (barangay_official): bcrypt hash, JWT issued after 2FA email code

Both hashes are stored for every user so either client can authenticate.

Web dashboard routes (`/api/rescuers/*` except `POST /register`, `/api/settings`, `/api/logs/casualties*`, `/api/households*`, `/api/incidents*`, `/api/manpower/*`) require `Authorization: Bearer <JWT>` via the `requireOfficial` middleware (roles `barangay_official`/`admin`). The web sends it through `apiFetch`/`downloadFile` in `zamboalert-web/src/pages/dashboard/dashboardApi.js`; a 401 clears the session and returns to `/login`.

Key API surface:
- `POST /api/telemetry` — LoRa gateway reports (requires `X-Gateway-Key` header)
- `POST /api/sos` — citizen phone GPS SOS (mirrors as virtual telemetry pod)
- `POST /api/auth/login` — unified login; returns token for mobile, triggers 2FA for web
- `GET /api/rescuers` — lists rescuers with ID photo URIs (joins `rescuers` + `users` tables)
- `/api/incidents`, `/api/households`, `/api/logs/casualties`, `/api/manpower/*` — web dashboard CRUD

### Mobile App (`zamboalert-app/src/`)
React Native / Expo. Entry: `App.tsx` → `RootNavigator` → role-based navigator.

- **Citizens**: `CitizenNavigator` → `SOSScreen`, `StatusScreen`, `LogScreen`, `SettingsScreen`
- **Rescuers**: `RescuerNavigator` (bottom tabs) → `PodsView`, `LogView`, plus rescuer-specific components under `src/rescuer/`
- Auth flow: `WelcomeScreen` → `LoginScreen` / `SignUpScreen` → email verification → role-based home
- Rescuers pending admin approval get `RescuerVerificationScreen` after email verification
- API base URL is hardcoded in `src/config.ts` — change `API_BASE_URL` for LAN IP or Render URL, then rebuild

Context providers: `AuthContext` (user session), `AppStateContext` (app-wide state).

### Web Dashboard (`zamboalert-web/src/`)
React + Vite + Tailwind CSS v4. Single-page app with React Router.

Pages: `LoginPage` → (JWT in localStorage) → `DashboardPage`, `SettingsPage`, `PersonnelAlertPage`

`DashboardPage` polls `GET /api/telemetry` every 3 seconds and displays pods on a Leaflet/Mapbox Tactical Map. Firebase is initialized in `firebase.js` but the primary data store is the Express backend over REST.

Auth token stored in `localStorage` as `zamboalert_auth` with `expiry` field; `PrivateRoute` enforces it.

## Deployment

`render.yaml` defines two Render services:
- `zamboalert-backend`: Node.js web service, root `backend/`, `npm start`
- `zamboalert-web`: static site, root `zamboalert-web/`, `npm run build`, serves `dist/`

Required env vars on Render (set manually, not in `render.yaml`):
- `GATEWAY_API_KEY` — shared secret with ESP32 gateway firmware
- `JWT_SECRET` — required; backend exits at startup without it
- `NODE_ENV=production` — set in `render.yaml`; hides fallback codes in logs and makes `/api/admin/*` fail closed without `ADMIN_API_KEY`
- `ADMIN_API_KEY` — guard on `/api/admin/*` routes (required in production)
- `GMAIL_USER` + `GMAIL_APP_PASSWORD` — email for verification/2FA codes (or use `RESEND_API_KEY` / `BREVO_API_KEY` as alternatives)

## Key Constraints

- **Rescuer dual-table sync**: rescuers exist in both `users` (mobile auth) and `rescuers` (web admin panel). Approval in either must sync `is_rescuer_verified` in `users` and `is_verified` in `rescuers` — see `POST /api/rescuers/verify/:id` and `POST /api/admin/rescuers/:id/approve`.
- **Live telemetry is ephemeral**: `podTelemetry` and `citizenSos` are in-memory arrays. A backend restart clears all active SOS signals and pod positions.
- **BLE advertising**: `react-native-ble-advertiser` requires a native Android build. Must use `expo run:android` — Expo Go won't work.
- **Route order matters**: In `index.js`, `/api/incidents/export` and `/api/manpower/export` must be declared before any `/:id` wildcard routes for the same prefix.
