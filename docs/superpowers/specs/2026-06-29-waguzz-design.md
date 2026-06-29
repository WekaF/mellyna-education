# Waguzz Design Spec

**Date:** 2026-06-29  
**Status:** Approved  
**Project location:** `C:\Users\weka\project\waguzz` (separate repo)

---

## Goal

Build **Waguzz** — a self-hosted WhatsApp HTTP API service (like WAHA) packaged as a single Docker container. Mellyna-education calls Waguzz instead of WhatDesks. Waguzz handles WA session persistence, auto-reconnect, and exposes a clean REST API + React dashboard.

---

## Architecture

Two auth layers, intentionally separate:

### Layer 1: Dashboard auth (human admin)
Username + password → JWT access token (15 min) + refresh token (7 days, httpOnly cookie).  
Axios interceptor on frontend: if 401 → try refresh once → if fail → redirect `/login`. Never loops.

### Layer 2: mellyna → Waguzz (server-to-server)
Static API key in `X-Api-Key` header. No expiry. No JWT. No logout risk.

### WA Engine
Baileys (`@whiskeysockets/baileys`) — single session, auth state persisted to `./data/auth_state/` on disk.  
QR scan once → session survives container restarts (via Docker volume).

### Reconnect strategy
```
ConnectionClosed  → reconnect with backoff (2s → 4s → 8s → max 60s)
TimedOut          → reconnect immediately
LoggedOut         → STOP, delete auth_state, set status DISCONNECTED, show QR on dashboard
```
Anti-ban: random 1–3 second delay between outgoing messages.

---

## File Structure

```
waguzz/
├─ backend/
│   ├─ src/
│   │   ├─ index.ts           # Express app + static serve frontend
│   │   ├─ auth.ts            # JWT login / refresh / logout handlers
│   │   ├─ middleware.ts      # requireDashboardAuth, requireApiKey
│   │   ├─ wa-engine.ts       # Baileys singleton, reconnect logic, status
│   │   ├─ logger.ts          # Circular in-memory log buffer (500 entries) + console
│   │   └─ routes/
│   │       ├─ auth.ts        # POST /auth/login, /auth/refresh, /auth/logout
│   │       ├─ wa.ts          # GET /wa/status, /wa/qr, POST /wa/send-text, /wa/send-file, /wa/disconnect, /wa/reconnect
│   │       └─ logs.ts        # GET /logs
│   ├─ package.json
│   └─ tsconfig.json
├─ frontend/
│   ├─ src/
│   │   ├─ main.tsx
│   │   ├─ App.tsx            # React Router: /login, /dashboard, /logs
│   │   ├─ api.ts             # axios instance, request interceptor (attach token), response interceptor (refresh on 401)
│   │   ├─ auth-store.ts      # In-memory accessToken state (NOT localStorage — XSS safe)
│   │   └─ pages/
│   │       ├─ Login.tsx      # username/password form
│   │       ├─ Dashboard.tsx  # WA status, QR panel, reconnect/disconnect buttons
│   │       └─ Logs.tsx       # log table, auto-refresh 5s, filter ALL/ERROR/INFO
│   ├─ index.html
│   ├─ package.json
│   └─ vite.config.ts
├─ data/                      # mounted as Docker volume
│   └─ auth_state/            # Baileys session files (persist across restarts)
├─ Dockerfile                 # multi-stage
├─ docker-compose.yml         # local dev (port 3000)
└─ .env.example
```

---

## API Endpoints

### Auth (Dashboard — JWT)
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/auth/login` | none | `{ username, password }` | `{ accessToken }` + set `refreshToken` cookie |
| POST | `/auth/refresh` | refreshToken cookie | none | `{ accessToken }` |
| POST | `/auth/logout` | cookie | none | clears cookie |

### WA Control
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| GET | `/wa/status` | apiKey OR jwt | none | `{ status, phone, lastActivity }` |
| GET | `/wa/qr` | apiKey OR jwt | none | `{ qr: 'data:image/png;base64,...' }` or 404 if connected |
| POST | `/wa/disconnect` | jwt | none | `{ ok: true }` |
| POST | `/wa/reconnect` | jwt | none | `{ ok: true }` |

### Messaging (mellyna server-to-server)
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/wa/send-text` | apiKey | `{ phone, message }` | `{ ok: true }` |
| POST | `/wa/send-file` | apiKey | `{ phone, base64, filename, mimetype, caption }` | `{ ok: true }` |

### Logs
| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/logs` | jwt | `{ logs: [{ ts, level, msg }] }` last 500 |

---

## Auth Guard — Anti-Logout Loop

Frontend `api.ts` interceptor:
```
request → attach Authorization: Bearer <accessToken>
response 401 → if not already retrying:
    call POST /auth/refresh
    if refresh ok → update token in memory, retry original request once
    if refresh fail → clear token → redirect to /login
response 401 (already retried) → clear token → redirect /login
```

Key: `retried` flag per request — never loops. Refresh called at most once per original request.

---

## Environment Variables

### Waguzz server (`.env`)
```
# Dashboard admin
WAGUZZ_USERNAME=admin
WAGUZZ_PASSWORD=<strong-password>

# JWT
JWT_SECRET=<random-256-bit>
JWT_ACCESS_TTL=900         # 15 minutes in seconds
JWT_REFRESH_TTL=604800     # 7 days in seconds

# API key for mellyna server-to-server
WAGUZZ_API_KEY=<random-key>

# WA
WA_LOG_LEVEL=silent        # silent | error | info
```

### mellyna-education `.env` additions
```
WAGUZZ_BASE_URL=http://localhost:3000    # or https://waguzz.mellyna-education.my.id
WAGUZZ_API_KEY=<same as above>
```

---

## mellyna-education Changes

Only `lib/waha.ts` changes. All 13+ routes importing from `lib/waha` stay unchanged.

```typescript
// New lib/waha.ts — Waguzz adapter
function cfg() {
  return {
    base: process.env.WAGUZZ_BASE_URL ?? 'http://localhost:3000',
    apiKey: process.env.WAGUZZ_API_KEY ?? '',
  }
}

function headers() {
  return { 'Content-Type': 'application/json', 'X-Api-Key': cfg().apiKey }
}

export async function sendWhatsApp(phone, message): Promise<boolean>
export async function sendWhatsAppFile(phone, base64, filename, mimetype, caption): Promise<{ok: true} | {ok: false, error: string}>
export async function getSessionStatus(): Promise<string>  // returns 'WORKING' | 'STOPPED' | 'OFFLINE'
```

---

## Docker

### Single container, two stages
```dockerfile
# Stage 1: Build React frontend
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Production backend
FROM node:20-alpine AS runner
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ .
RUN npx tsc
COPY --from=frontend /build/dist ./public
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### docker-compose.yml (local dev)
```yaml
services:
  waguzz:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    env_file: .env
    restart: unless-stopped
```

---

## Dashboard UI Screens

### `/login`
- Centered card: Waguzz logo + username/password form
- Error message on failed login

### `/dashboard`
- Header: "Waguzz" + status badge + nav links (Dashboard | Logs | Logout)
- **Status card**: CONNECTED (green) / CONNECTING (yellow) / DISCONNECTED (red)
  - Connected: shows phone number + last activity time
  - Disconnected: QR code image (polls `/wa/qr` every 3s), instruction "Scan dengan WhatsApp"
- **Action buttons**: Reconnect | Disconnect (only visible when relevant)

### `/logs`
- Filter tabs: ALL | ERROR | INFO
- Table: timestamp | level (color-coded) | message
- Auto-refresh every 5s
- Max 500 rows displayed

---

## Production Deployment (mellyna server)

Caddy entry to add:
```
waguzz.mellyna-education.my.id {
    reverse_proxy localhost:3000
}
```

Run alongside existing stack — separate `docker-compose.yml` in `/home/ubuntu/waguzz/`.

---

## What's NOT in scope

- Multiple WA sessions (one session only)
- Webhook from Waguzz to mellyna (mellyna does not need inbound events)
- Message history / database
- User management (single admin user via env var)
