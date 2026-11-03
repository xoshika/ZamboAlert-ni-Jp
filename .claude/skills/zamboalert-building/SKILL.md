---
name: zamboalert-building
description: Build, run, and deploy ZamboAlert components - backend, Expo Android app, Vite web dashboard, ESP32 firmware, Render deployment. Use when asked to build, run, install, release, or deploy.
---

# Building ZamboAlert

Run commands from each component's directory.

## Backend (`backend/`)
```
npm install
copy .env.example .env     # set GATEWAY_API_KEY, JWT_SECRET (required), email provider vars
npm run dev                # nodemon, port 3000
npm start                  # production mode
```

## Mobile app (`zamboalert-app/`)
```
npm install                # postinstall runs patch-package
npm start                  # Expo dev server (LAN)
npm run android            # native build + install; REQUIRED for BLE (Expo Go won't work)
npx tsc --noEmit           # type check
```
Prereqs: Android SDK, USB debugging or an emulator. Set `API_BASE_URL` in `src/config.ts` to the PC's LAN IP (or Render URL) before building; it is baked in. `npm run clear` resets the Metro cache; `npm run tunnel` when LAN fails.

## Web dashboard (`zamboalert-web/`)
```
npm install
npm run dev                # Vite dev server
npm run build              # outputs dist/
```
Set `VITE_API_BASE_URL` for non-local backends.

## Firmware (`firmware/zamboalert-gateway`, `firmware/zamboalert-pod`)
```
pio run                    # build
pio run -t upload          # flash ESP32
pio device monitor         # serial logs
```
The gateway key and backend URL in firmware must match the backend's `GATEWAY_API_KEY` and deployed URL.

## Deploy (Render, `render.yaml`)
- `zamboalert-backend`: root `backend/`, `npm start`. `zamboalert-web`: static, root `zamboalert-web/`, `npm run build`, serves `dist/`.
- Set manually: `GATEWAY_API_KEY`, `JWT_SECRET`, `ADMIN_API_KEY`, and `GMAIL_USER`+`GMAIL_APP_PASSWORD` (or `RESEND_API_KEY` / `BREVO_API_KEY`).
- Render's filesystem is ephemeral: the SQLite file resets on redeploy unless a persistent disk is attached.
- After deploying, update the app's `API_BASE_URL` and rebuild the APK.

## Verify
A build isn't done until it compiles and runs: backend logs that it is listening, web produces `dist/`, the app installs and reaches `/api/*`.
