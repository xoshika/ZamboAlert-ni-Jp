# ZamboAlert — Agent Knowledge Base

> Generated project analysis for AI agents and developers working in this repository.
> Capstone project: College of Computing Studies, Western Mindanao State University.
> Last analyzed: 2026-10-14

---

## 1. Project Overview

**ZamboAlert** is an IoT-based emergency communication system for barangay disaster response in Zamboanga City. It keeps SOS signaling and rescuer situational awareness working when cellular networks and power are down, using:

1. **Bluetooth Low Energy (BLE)** — citizen phones broadcast offline SOS
2. **LoRa mesh (433 MHz)** — rescuer pods relay alerts toward a barangay gateway
3. **HTTP telemetry** — gateway posts to a LAN backend; dashboards/apps poll for live data

### Problem
During typhoons, floods, and storm surges, Zamboanga City often loses cellular and power service. Trapped citizens cannot call for help; rescuers cannot locate them.

### What it does
| Actor | Capability |
|-------|------------|
| **Citizen** | Mobile app broadcasts offline SOS via BLE |
| **Rescuer** | Wearable ESP32 pod + mobile app for radar/map/pods/logs |
| **Barangay official** | Web dashboard for tactical map, dispatch, households, manpower |

### End-to-end data flow

```
Citizen phone ──BLE SOS advertise──► Rescuer Pod (ESP32 + LoRa + GPS + BLE scan)
                                            │ LoRa mesh (multi-hop, TTL)
                                            ▼
                                   Barangay Gateway (ESP32 + Wi‑Fi)
                                            │ POST /api/telemetry + X-Gateway-Key
                                            ▼
                              Root backend :3000 (JSON db.json)
                                   │                    │
                    Mobile app auth / telemetry poll    │ Web dashboard polls pods
                                   │                    │
                                   │         zamboalert-web/backend :5000 (SQLite)
                                   │              ▲     │
                      rescuer dual-register ──────┘     ▼
                                              Vite web UI :5173
```

---

## 2. Repository Structure

```
ZamboAlert-merge/
├── README.md                 # System overview + LAN hardware test guide
├── package.json              # Root workspace; `npm start` → backend only
├── package-lock.json
├── agent.md                  # This file
├── backend/                  # Mobile + gateway API (port 3000, JSON DB)
├── firmware/                 # ESP32 PlatformIO projects (pod + gateway)
├── zamboalert-app/           # React Native / Expo mobile app (citizen + rescuer)
├── zamboalert-web/           # Vite React barangay dashboard + its own backend
└── node_modules/             # Root workspace installs
```

| Path | Role |
|------|------|
| `backend/` | Auth for mobile users, LoRa telemetry ingest/read, simple rescuer-approval admin UI |
| `zamboalert-app/` | Single Expo app branching on role: Citizen vs Rescuer |
| `zamboalert-web/` | Officials dashboard (Vite) |
| `zamboalert-web/backend/` | Admin portal API (SQLite): officials auth, households, incidents, manpower |
| `firmware/zamboalert-pod/` | Portable rescuer node firmware |
| `firmware/zamboalert-gateway/` | Fixed barangay hall bridge firmware |

**Important architectural fact:** there are **two Node backends** and **two databases**. They do not share a users table. Telemetry lives only on root `backend` (:3000). Most barangay CRUD lives on `zamboalert-web/backend` (:5000).

---

## 3. Tech Stack (actual vs README)

| Layer | Actual implementation | README claim (may be outdated) |
|-------|----------------------|--------------------------------|
| Mobile | React Native + Expo SDK ~57, TypeScript | React Native |
| Root backend | Node.js, Express 5, **JSON file** (`db.json`) | Node/Express |
| Web backend | Node.js ESM, Express 4, **SQLite** (`zamboalert.db`) | — |
| Web frontend | React 18, Vite 5, Tailwind 4, Mapbox + Leaflet | — |
| Gateway DB | JSON telemetry store in root backend | PostgreSQL (outdated) |
| Hardware | ESP32, LoRa SX1278 433 MHz, NEO-6M GPS | Same |
| Realtime | HTTP polling only (no WebSockets/MQTT consumer in Node) | “real time” via poll |

---

## 4. `zamboalert-app` — Mobile Application

### 4.1 Identity
- npm name: `zamboalert-citizen`
- Display: **ZamboAlert App**
- Bundle ID: `com.zamboalert.citizen`
- Entry: `expo/AppEntry.js` → `App.tsx`
- Dual role in one binary: **citizen** | **rescuer**

### 4.2 Stack
- Expo ~57, React 19.2, React Native 0.86
- React Navigation 7 (native-stack + bottom-tabs)
- BLE: `react-native-ble-advertiser` (patched via `patch-package`)
- Maps (rescuer): Leaflet inside `react-native-webview`
- Location: `expo-location`; photos: `expo-image-picker`; haptics: `expo-haptics`
- Fonts: Inter (`@expo-google-fonts/inter`)
- EAS builds: `eas.json` (development / preview / production)

### 4.3 Directory structure
```
zamboalert-app/
├── App.tsx
├── app.json / eas.json / package.json / babel.config.js / tsconfig.json
├── patches/                         # BLE advertiser patch
├── android/                         # Native Android (required for BLE advertise)
└── src/
    ├── config.ts                    # API_BASE_URL (hardcoded LAN IP)
    ├── components/                  # Shared UI
    ├── context/                     # AuthContext, AppStateContext
    ├── navigation/                  # RootNavigator
    ├── screens/
    │   ├── auth/                    # Welcome, Login, SignUp, RescuerVerification
    │   ├── Citizen/                 # SOS, Status, Log, Settings
    │   └── RescuerPlaceholderScreen.tsx  # legacy; unused when role=rescuer
    ├── theme/
    ├── services/                    # mostly empty; telemetry under rescuer/
    └── rescuer/
        ├── navigation/MainTabNavigator.tsx
        ├── screens/                 # PodsView, LogView
        ├── components/              # RadarView, MapView, SessionComponents, SharedUI
        ├── services/telemetry.ts
        ├── context/ToastContext.tsx
        ├── assets/displayConfig.ts
        └── utils/
```

### 4.4 Navigation & roles

```
!user                     → AuthStack (Welcome / Login / SignUp / RescuerVerification)
user.role === 'rescuer'   → RescuerTabNavigator (Radar | Map | Pods | Log)
else                      → CitizenTabs (SOS | Status | Log | Settings)
```

Rescuers must be admin-verified (`isRescuerVerified !== false`) before login succeeds on the root backend.

### 4.5 Citizen features
| Feature | Behavior |
|---------|----------|
| SOS | Disaster types: earthquake, flood, landslide; confirm modal; optional photo (local URI only — not uploaded) |
| BLE beacon | Service UUID `fef10001-7b82-4b93-b2c2-0f81ea3300a1`; company ID `0xffff`; non-connectable |
| Status | GPS coords; network status placeholder |
| Log | Local event history from `AppStateContext` |
| Settings | Emergency profile, MFA UI, session, logout; some toggles are UI-only |

**Critical:** Citizen SOS does **not** POST to HTTP. Visibility depends on BLE → pod → LoRa → gateway → `POST /api/telemetry`. Expo Go cannot advertise BLE; use a native/dev build (`expo run:android`).

### 4.6 Rescuer features
| Tab | Purpose |
|-----|---------|
| Radar | Compass/radar toward selected victim when bearing/distance available |
| Map | Leaflet/OSM WebView + indoor floor overlay; navigation mode; victim situation updates; rescuer self-SOS |
| Pods | Live LoRa pod list (nodeId, RSSI/SNR, hops, GPS, receivedAt) |
| Log | Casualty logging by disaster type (local + toasts) |

- Polls `GET /api/telemetry` every **~5 seconds**
- Live SOS victims derived from `msgType === 1` or `bleVictims > 0`
- Victim status codes: 1 safe, 2 injured, 3 trapped, 4 lost/unable to move

### 4.7 Auth & state
| Context | Responsibility |
|---------|----------------|
| `AuthContext` | Login/signup/verify/reset/MFA/logout; offline demo fallback users |
| `AppStateContext` | SOS active flag, disaster type, BLE start/stop, GPS, citizen log |
| `ToastContext` | Rescuer toasts |

API base: `src/config.ts` → `API_BASE_URL` (currently a LAN IP on `:3000`). Change this for each network.

Demo offline accounts (when backend unreachable):
| Role | Email | Password |
|------|-------|----------|
| Citizen | citizen@test.com | test1234 |
| Rescuer | rescuer@test.com | test1234 |

### 4.8 Backend endpoints used by the app
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/signup` | Signup |
| POST | `/api/auth/verify-email` | Email verify |
| POST | `/api/auth/resend-code` | Resend code |
| POST | `/api/auth/request-reset` | Password reset request |
| POST | `/api/auth/reset-password` | Apply new password |
| POST | `/api/auth/rescuer-verify` | Submit rescuer ID docs |
| GET | `/api/telemetry` | Pod telemetry poll |

**Dual write on rescuer verify:** also best-effort `POST` to web backend `:5000/api/rescuers/register` so barangay Approvals stay in sync.

---

## 5. `zamboalert-web` — Barangay Dashboard

### 5.1 Frontend stack
- React 18 + React Router DOM 7
- Vite 5, Tailwind CSS 4
- Mapbox GL 3 (tactical map), Leaflet 1.9 (settings location)
- lucide-react icons
- Firebase client present in `firebase.js` but **unused by pages**

### 5.2 Structure
```
zamboalert-web/
├── index.html / vite.config.js / styles.css
├── .env                         # VITE_MAPBOX_TOKEN, VITE_API_PORT
├── src/
│   ├── main.jsx / App.jsx
│   ├── firebase.js              # scaffolding only
│   └── pages/
│       ├── login/               # register, verify, 2FA, forgot password
│       ├── dashboard/           # map, SOS, residents, units, reports, approvals…
│       ├── settings/            # account, activity, rescuers, location
│       └── personnel-alert/     # manpower matrix / mutual aid
└── backend/                     # separate Express + SQLite API
    ├── server.js                # ~1460 lines, all routes
    ├── zamboalert.db
    └── .env
```

### 5.3 Frontend routes
| Path | Guard | Page |
|------|-------|------|
| `/` | — | Redirect → `/login` |
| `/login` | public | Officials login/register/2FA |
| `/dashboard` | PrivateRoute | Main ops dashboard |
| `/settings` | private | Settings |
| `/personnel-alert`, `/manpower-alert` | private | Manpower UI |

Session: JWT in `localStorage` as `{ user, token, expiry }` (~1h). Key: `zamboalert_auth`.

### 5.4 Dashboard tabs
| Tab | Feature |
|-----|---------|
| `map` | Mapbox tactical map: buildings, rescuers, victims, pods, dispatch routes |
| `alerts` | SOS stream (client state) |
| `victims` | Casualty DB |
| `residents` | Household registry + broadcast UI |
| `units` | Rescuers/tanods status & dispatch |
| `personnel` | Manpower / mutual aid |
| `reports` | Incident analytics + CSV |
| `approvals` | Pending rescuer approvals |
| `settings` | Embedded settings |

**Polling:** pods every **3s** via `fetchTelemetry()` (prefers `:3000`, then web `:5000` proxy); other resources ~every **12s** via `apiFetch()` (`:5000+`).  
Web backend proxies `GET /api/telemetry` → `TELEMETRY_BACKEND_URL` (default `http://127.0.0.1:3000`). Do **not** move the web backend onto port 3000. Login stays on **5000+**.

### 5.5 Web backend (`zamboalert-web/backend`) — port 5000+
Auth for **barangay officials**: email verify + email 2FA + JWT (bcrypt passwords).

Key route groups:
- `/api/auth/*` — register, verify-email, login, verify-2fa, resend, forgot/reset
- `/api/logs/casualties` — victim logs
- `/api/rescuers/*` — register, verify, dispatch, resolve, assign-zone, location
- `/api/settings` — key/value ops rules
- `/api/households` — registry + broadcast stub (no real SMS gateway)
- `/api/incidents` — analytics + CSV export
- `/api/manpower/*` — barangay inventory, deficit alerts, mutual-aid transfer, agency escalation

#### SQLite tables
`users`, `rescuers`, `casualty_logs`, `settings`, `households`, `incidents`, `barangays`, `manpower_alerts`, `manpower_transfers`, `manpower_escalations`

Firebase Admin may init if env set; **Firestore is not used in route handlers**.

---

## 6. Root `backend/` — Mobile + Gateway API

### 6.1 Stack
- Express 5 (CommonJS)
- Persistence: `backend/src/db.json` (override with `ZAMBOALERT_DB_PATH`)
- Email: nodemailer + Gmail App Password
- Listens on `0.0.0.0:3000` (LAN-reachable for ESP32)
- Static admin UI in `backend/public/` for rescuer approve/reject

### 6.2 Endpoints

#### Telemetry
| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/telemetry` | Requires `X-Gateway-Key` = `GATEWAY_API_KEY`; upsert by `nodeId` |
| GET | `/api/telemetry` | Reports received in last **90 seconds**, newest first |

#### Auth (mobile)
| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/signup` | SHA-256 password hash; email verify (code hashed, 10 min) |
| POST | `/api/auth/verify-email` | Activate; may return session |
| POST | `/api/auth/resend-code` | Resend verification |
| POST | `/api/auth/login` | Role-aware; rescuer must be approved |
| POST | `/api/auth/request-reset` | May return `devCode` in JSON (dev-oriented) |
| POST | `/api/auth/reset-password` | Apply reset |
| POST | `/api/auth/rescuer-verify` | ID docs → pending until admin approve |

#### Admin
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/admin/rescuers` | List + verification state |
| POST | `/api/admin/rescuers/:id/approve` | Approve |
| POST | `/api/admin/rescuers/:id/reject` | Reject |
| GET | `/api/admin/stats` | Counts |

### 6.3 `db.json` shape
- **`users[]`**: id, names, email, passwordHash, role (`citizen`|`rescuer`), verification/MFA fields, rescuer ID docs + `isRescuerVerified`
- **`podTelemetry[]`**: latest per `nodeId` — seq, msgType, GPS, bleVictims, nearestRssi, hopCount, loraRssi/Snr, receivedAt, gateway coords, etc.

### 6.4 Env (`backend/.env.example`)
| Variable | Purpose |
|----------|---------|
| `PORT` | Default 3000 |
| `GATEWAY_API_KEY` | Shared secret with gateway firmware |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Verification emails |
| `ZAMBOALERT_DB_PATH` | Optional DB path override |

Root scripts: `npm start` (from repo root) → `cd backend && npm start`.

---

## 7. `firmware/` — ESP32 LoRa Pod & Gateway

### 7.1 Projects
| Project | Role |
|---------|------|
| `firmware/zamboalert-pod` | Portable rescuer node: GPS + BLE scan + LoRa TX/RX/relay + buzzer/LED |
| `firmware/zamboalert-gateway` | Fixed bridge: LoRa RX → Serial JSON + HTTP (and optional MQTT) |

Build: PlatformIO, board `esp32dev`, Arduino framework. Shared wire format in identical `include/mesh_packet.h` copies — **keep both in sync**.

### 7.2 Architecture
- **Pod**: originates telemetry/SOS; scans BLE for citizen SOS; meshes with TTL + seen-cache dedupe
- **Gateway**: receive-only sink; surveyed fixed lat/lng; no GPS module; Wi‑Fi forwarder
- Gateway does **not** relay LoRa packets

### 7.3 LoRa / hardware (common)
- SX1278 / Ra-01: 433 MHz, SF9, BW 125 kHz, sync `0x12`, CR 4/5, CRC on
- SPI pins: SCK 18, MISO 19, MOSI 23, NSS 5, RST 14, DIO0 26
- Pod GPS: UART2 RX 16 / TX 17 @ 9600 (NEO-6M)
- Pod BLE: name prefix `ZA-SOS`; service UUID matches citizen app
- Pod mesh TTL: typically 4
- Gateway: `FORWARD_VIA_HTTP` typically 1; `FORWARD_VIA_MQTT` typically 0

### 7.4 MeshPacket (36 bytes, packed)
| Field | Meaning |
|-------|---------|
| `magic` | `0xAA` |
| `msgType` | 0 telemetry / 1 SOS |
| `nodeId`, `seq` | Origin + sequence |
| `lat_e6`, `lng_e6`, `sats`, `gpsFix` | GPS |
| `bleVictims`, `nearestRssi`, `victimId[8]`, `victimStatus` | BLE SOS summary |
| `hopCount`, `uptimeSec` | Mesh TTL + uptime |

Encode/decode via raw `memcpy`. Dedup: small hash ring (`SeenFilter`), not a true Bloom filter.

### 7.5 Pod timing (defaults)
| Interval | Value |
|----------|-------|
| Telemetry TX | ~10 s + 0–1.5 s jitter |
| BLE scan | every 5 s, 3 s active |
| SOS retransmit while beacon active | every 5 s |
| GPS status print | every 30 s |

Proximity cue: LED/buzzer when victims nearby and RSSI above threshold; forces SOS LoRa TX.

### 7.6 Gateway → backend JSON
Posted to `SERVER_URL` (must be LAN IP of backend host — **never `localhost` on ESP32**) with header `X-Gateway-Key`. Body includes `gatewayId`, gateway coords, `nodeId`, `seq`, `msgType`, GPS, BLE fields, hopCount, uptime, `loraRssi`, `loraSnr`.

Also always prints `JSON:{...}` on Serial (115200) for USB debugging. Serial cmds `s`/`t` can inject simulated SOS/telemetry on gateway; pods have similar test cmds.

### 7.7 Secrets in firmware config
`firmware/zamboalert-gateway/include/config.h` holds Wi‑Fi credentials, `SERVER_URL`, and `GATEWAY_API_KEY`. Treat as secrets; do not publish real values. Match `GATEWAY_API_KEY` exactly with backend `.env`.

---

## 8. Cross-Cutting Integrations

| Concern | Status |
|---------|--------|
| WebSockets / Socket.IO | None — HTTP polling only |
| MQTT | Firmware optional publish; **default off**; no Node MQTT consumer |
| Firebase | Scaffolding only (web client + optional admin) |
| SMS broadcast | Simulated in web backend (logs recipients) |
| Mapbox | Required for web tactical map (`VITE_MAPBOX_TOKEN`) |
| Citizen photo SOS | Local UI only; not uploaded |
| Rescuer approval | Split across two DBs; mobile dual-registers to both |

### Port map
| Service | Default port |
|---------|--------------|
| Root backend (mobile + telemetry) | 3000 |
| Web backend (officials API) | 5000 (+ fallbacks 5001…) |
| Vite web dashboard | 5173 |
| Expo metro | LAN packager |

---

## 9. Local Hardware / Dev Test Checklist

1. Create `backend/.env` from `.env.example` with a long random `GATEWAY_API_KEY`; run `npm --prefix backend install` and `npm start`. Allow inbound TCP 3000 on the LAN.
2. Set the same API key + backend LAN IP in `firmware/zamboalert-gateway/include/config.h` (Wi‑Fi + surveyed gateway coords). Flash gateway.
3. Configure/flash pod (`config.h` BLE UUID must match app). Pod needs GPS fix (or indoor fallback) to appear correctly on maps.
4. Install app: `npm --prefix zamboalert-app install`, then `npm --prefix zamboalert-app run android` (native build for BLE). Set `src/config.ts` `API_BASE_URL` to `http://<LAN-IP>:3000`.
5. Optionally run web: `cd zamboalert-web/backend && npm start`, then `cd zamboalert-web && npm run dev`. Configure Mapbox token.
6. Verify: citizen SOS → pod Serial/buzzer → gateway `JSON:` / HTTP 200 → `GET /api/telemetry` → web map + rescuer Pods tab.

Do not expose the shared-key telemetry HTTP endpoint to the public Internet.

---

## 10. Agent Working Notes & Pitfalls

1. **Two backends, two auth models, two DBs** — never assume one API or shared users.
2. Telemetry is always root `:3000`; barangay CRUD/login is `:5000`.
3. README “PostgreSQL (gateway)” is outdated — use JSON telemetry store.
4. README app structure mentions older `.js` paths; current app is TypeScript under `src/` with a full `rescuer/` module.
5. Changing LAN IPs requires updates in: `zamboalert-app/src/config.ts`, gateway `config.h` `SERVER_URL`, and optionally Expo `start:ip` host.
6. BLE UUID must stay synchronized: citizen advertiser ↔ pod scanner ↔ docs.
7. Keep both `mesh_packet.h` and LoRa radio defines identical across pod and gateway.
8. Password reset on root backend may return `devCode` (dev convenience).
9. Prefer not committing secrets: `.env`, gateway Wi‑Fi/API key, Mapbox tokens, Gmail app passwords.
10. When editing features, follow existing patterns: Context for mobile state; Express monolith files for backends; PlatformIO `config.h` for hardware constants.

---

## 11. Quick Command Reference

```powershell
# Root backend (telemetry + mobile auth)
npm --prefix backend install
npm start

# Web backend (officials)
cd zamboalert-web/backend
npm install
npm start

# Web frontend
cd zamboalert-web
npm install
npm run dev

# Mobile app
npm --prefix zamboalert-app install
npm --prefix zamboalert-app run android   # native BLE
# or Expo Go for non-BLE UI only:
npm --prefix zamboalert-app start

# Firmware (PlatformIO CLI examples)
pio run -d firmware/zamboalert-pod -t upload
pio run -d firmware/zamboalert-gateway -t upload
```

---

## 12. Feature Inventory Summary

| Domain | Implemented |
|--------|-------------|
| Citizen BLE SOS | Yes (native build) |
| Citizen auth + email verify | Yes (root backend) |
| Rescuer radar / map / pods / log | Yes (polls telemetry) |
| Rescuer ID verification + approval | Yes (root admin + web approvals; dual-register) |
| LoRa mesh relay among pods | Yes |
| Gateway HTTP telemetry forward | Yes |
| Gateway MQTT forward | Code present, default off |
| Barangay tactical map + dispatch | Yes (web) |
| Household registry | Yes (SQLite) |
| Incident analytics + CSV | Yes |
| Manpower / mutual aid / escalation | Yes (web) |
| SMS / real cellular fallback | Stub only |
| Shared single database | No — intentional split |
| WebSockets push | No — polling |

---

*This file is the canonical agent-oriented map of the ZamboAlert-merge repository. Prefer updating this document when architecture, ports, or data contracts change.*
