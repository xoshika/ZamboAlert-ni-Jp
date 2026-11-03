---
name: zamboalert-implementing
description: Implement features or changes in ZamboAlert - new API routes, DB columns, mobile screens, web pages, auth changes. Use when adding or modifying behavior across backend, app, and web.
---

# Implementing in ZamboAlert

## Before coding
- Read surrounding code and match its style. The backend is a single `backend/src/index.js` plus `database.js` (SQLite); don't add frameworks or split files unless asked.
- Also load the `zamboalert` skill for the rules that bite (dual-table sync, dual hashes, route order, in-memory telemetry).

## Backend
1. Schema changes go in `database.js` as idempotent migrations (`CREATE TABLE IF NOT EXISTS`, guarded `ALTER TABLE ADD COLUMN`) so existing `zamboalert.db` files and deploys keep working.
2. Add the route in `index.js`; literal paths (`/export`) go before `/:id`.
3. Use the right auth: gateway key for `/api/telemetry`, JWT for web dashboard routes, session token for mobile, `ADMIN_API_KEY` for `/api/admin/*` (fail closed in production).
4. Parameterized SQL only. Validate inputs; return consistent JSON errors.
5. Anything touching passwords writes both SHA-256 and bcrypt hashes. Anything touching rescuer approval updates both `users` and `rescuers`.

## Mobile (`zamboalert-app/src`)
- Screens in `screens/`, rescuer UI in `rescuer/`, shared UI in `components/`, API calls in `services/`, base URL from `config.ts`, tokens from `theme/`.
- Register new screens in the matching navigator (`CitizenNavigator` / `RescuerNavigator`). Use `AuthContext` for the user and `AppStateContext` for app-wide state.
- Keep types accurate; run `npx tsc --noEmit`.

## Web (`zamboalert-web/src`)
- Pages in `pages/`, components in `components/`, routes in `App.jsx` (wrap protected ones in `PrivateRoute`). Tailwind v4 utilities; API base from `VITE_API_BASE_URL`.

## Finish
- Exercise the change end to end (curl for API, run the client).
- Update `CLAUDE.md` or the skills if you add a rule or endpoint others must know.
- Commit only when asked.
