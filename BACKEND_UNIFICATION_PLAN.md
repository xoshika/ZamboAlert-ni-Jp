# 📋 ZamboAlert Backend Unification Master Plan
**Archived for Future Execution & Capstone Implementation**

---

## 📌 Executive Summary
Currently, the ZamboAlert system has **two fragmented backends**:
1. **Root Backend (`backend/`)**: Runs on port `3000`, uses `db.json`, serves LoRa gateways & Mobile App (`zamboalert-app`).
2. **Web Backend (`zamboalert-web/backend/`)**: Runs on port `5000`, uses `zamboalert.db` (SQLite), serves Web Dashboard (`zamboalert-web`).

This fragmentation causes:
- Mobile rescuer signups are invisible to the web admin approval panel.
- Live SOS alerts and telemetry require an unreliable `localhost` proxy that breaks on cloud deployments (Render).
- Deploying to Render requires managing two separate Web Services and environment variables.

---

## 🏗️ Target Unified Architecture
```
ZamboALert-merge/
├── backend/                   <-- THE ONLY BACKEND (Powers Mobile, Web & LoRa)
│   ├── src/
│   │   ├── index.js           <-- Unified Express Server (Port 3000 / process.env.PORT)
│   │   ├── database.js        <-- Unified SQLite / Cloud DB connection
│   │   └── routes/
│   │       ├── auth.js        <-- Combined Web + Mobile Authentication
│   │       ├── telemetry.js   <-- Gateway LoRa & Citizen Phone GPS SOS
│   │       ├── rescuers.js    <-- Verification, dispatch, status tracking
│   │       ├── incidents.js   <-- Casualty logs & incident management
│   │       └── settings.js    <-- Barangay configurations & rules
│   ├── package.json
│   └── .env
├── zamboalert-web/            <-- Frontend Dashboard (React + Vite)
│   └── (backend folder removed)
└── zamboalert-app/            <-- Field Mobile App (React Native + Expo)
```

---

## 🛠️ Complete Route Inventory to Consolidate

All of these endpoints will live under the single server (`backend/`):

### 1. Authentication & Accounts
| Route | Method | Used By | Description |
|---|---|---|---|
| `/api/auth/register` | `POST` | Web & Mobile | Unified user signup (supports Citizen, Rescuer, Official) |
| `/api/auth/login` | `POST` | Web & Mobile | Universal login (supports email/username, password, optional role check) |
| `/api/auth/verify-email` | `POST` | Web & Mobile | 6-digit email OTP verification via Nodemailer |
| `/api/auth/resend-code` | `POST` | Web & Mobile | Resends verification or reset codes |
| `/api/auth/forgot-password` | `POST` | Web & Mobile | Sends password recovery code |
| `/api/auth/reset-password` | `POST` | Web & Mobile | Validates reset code & updates password hash |
| `/api/auth/verify-2fa` | `POST` | Web (optional) | Two-factor confirmation fallback |

### 2. Emergency Operations (Hardware & SOS)
| Route | Method | Used By | Description |
|---|---|---|---|
| `/api/telemetry` | `POST` | Hardware Gateway | LoRa packet ingestion (GPS, BLE victim count, RSSI, SNR) |
| `/api/telemetry` | `GET` | Web Map & Rescuer | Returns live pods with active TTL filtering |
| `/api/sos` | `POST` | Citizen Mobile | Citizen phone GPS distress beacon |
| `/api/sos` | `GET` | Web Map & Rescuer | Returns active emergency SOS distress signals |
| `/api/sos` | `DELETE` | Citizen / Rescuer | Clears/resolves citizen distress signal |

### 3. Rescuer & Field Management
| Route | Method | Used By | Description |
|---|---|---|---|
| `/api/rescuers` | `GET` | Web Admin | List all registered rescuers with verification status |
| `/api/rescuers/verify/:id` | `POST` | Web Admin | Approves a rescuer application |
| `/api/rescuers/:id` | `DELETE` | Web Admin | Rejects/deletes a rescuer record |
| `/api/rescuers/location` | `POST` | Mobile Rescuer | Live GPS tracking of rescue teams |
| `/api/rescuers/dispatch` | `POST` | Web Admin | Dispatches a team to an SOS target |
| `/api/rescuers/resolve/:id` | `POST` | Mobile / Web | Marks rescue mission as resolved |

### 4. Admin Management & Logs
| Route | Method | Used By | Description |
|---|---|---|---|
| `/api/settings` | `GET` / `POST` | Web Admin | System dispatch rules, thresholds, radius |
| `/api/logs/casualties` | `GET` / `POST` | Web Admin | Casualties, injuries, and rescued counts |
| `/api/incidents` | `GET` / `POST` | Web Admin | Incident logs & disaster reporting |
| `/api/incidents/export` | `GET` | Web Admin | CSV / PDF report export |
| `/api/households` | `GET` / `POST` | Web Admin | Barangay household census & evacuation status |
| `/api/households/broadcast`| `POST` | Web Admin | Sends emergency broadcast alerts |
| `/api/manpower/barangays` | `GET` | Web Admin | Mutual aid transfers & partner agencies |

---

## 🗄️ Database Unification Strategy
Currently, `backend/` uses JSON (`db.json`) while `zamboalert-web/backend/` uses SQLite (`zamboalert.db`).
- **Recommended DB for Unified Backend:** **SQLite (`zamboalert.db`)** or **PostgreSQL** (Render native).
- SQLite is self-contained in a single file, handles relational tables cleanly, supports indexed queries, and requires zero cloud database setup during local development.

---

## ☁️ Render Deployment Blueprint (`render.yaml`)
Once merged, you only need **one Web Service** on Render:

```yaml
services:
  # Single Unified API Service
  - type: web
    name: zamboalert-api
    runtime: node
    plan: free
    rootDir: backend
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_VERSION
        value: 20.0.0
      - key: GMAIL_USER
        sync: false
      - key: GMAIL_APP_PASSWORD
        sync: false
      - key: GATEWAY_API_KEY
        sync: false
      - key: JWT_SECRET
        generateValue: true

  # Web Dashboard (Static Site)
  - type: web
    name: zamboalert-web
    runtime: static
    rootDir: zamboalert-web
    buildCommand: npm install && npm run build
    staticPublishPath: dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: VITE_API_BASE_URL
        fromService:
          type: web
          name: zamboalert-api
          property: host
```

---

## 📱 Frontend Configurations (Post-Merge)

1. **Web Dashboard (`zamboalert-web/.env`):**
   ```env
   VITE_API_BASE_URL=https://zamboalert-api.onrender.com
   ```
2. **Mobile App (`zamboalert-app/src/config.ts`):**
   ```typescript
   export const API_BASE_URL = 'https://zamboalert-api.onrender.com';
   ```

---

## 🎓 Capstone Defense Talking Points
1. **Unified Emergency Operations Center:** All emergency requests (citizen app SOS, hardware LoRa gateway telemetry, and manual hotline logs) converge into a single centralized dispatcher database.
2. **End-to-End Real-Time Feedback Loop:** Rescuer credentials submitted on mobile are verified live in the web command center without manual database imports.
3. **Fault-Tolerant Hybrid Architecture:** Mobile app has local offline caching (`SESSION_USERS` & Bluetooth mesh) when cloud connection drops, syncing back to the unified API when network is restored.
