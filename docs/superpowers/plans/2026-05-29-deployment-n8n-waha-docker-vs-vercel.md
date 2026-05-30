# Deployment Architecture: n8n + Waha (Docker vs Vercel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy seluruh stack Mellyna Education ke production dengan n8n dan Waha berjalan di Docker (bukan Vercel).

**Architecture:** Dua opsi tersedia. n8n dan Waha **tidak bisa** jalan di Vercel karena butuh persistent process, WebSocket, dan Docker runtime. Pilih salah satu arsitektur di bawah.

**Tech Stack:** Docker Compose, Next.js, n8n, Waha (WhatsApp HTTP API), PostgreSQL, MinIO, Caddy/Nginx reverse proxy.

---

## Kenapa n8n dan Waha Tidak Bisa di Vercel

| Service | Kenapa Tidak Bisa di Vercel |
|---|---|
| **n8n** | Butuh persistent process (workflow scheduler), WebSocket, penyimpanan file lokal `/home/node/.n8n` |
| **Waha** | Butuh Docker, persistent session WhatsApp di `/tmp/waha-sessions`, WebSocket ke WhatsApp |
| **PostgreSQL** | Serverless DB tidak cocok untuk Prisma + migration |
| **MinIO** | Object storage, butuh persistent disk |

Vercel hanya cocok untuk **Next.js app** (stateless serverless). Semua service lain **harus Docker**.

---

## Dua Opsi Arsitektur

### Opsi A: Full Docker di Satu VPS (Recommended ✅)

```
VPS (Sumopod / DigitalOcean / dll)
├── app (Next.js)        :3000  ─┐
├── postgres             :5432  ─┤── Docker internal network
├── minio                :9000  ─┤
├── waha                 :3001  ─┤
├── n8n                  :5678  ─┘
└── caddy (reverse proxy) :80/:443
    ├── app.mellyna.id   → app:3000
    ├── n8n.mellyna.id   → n8n:5678
    └── waha.mellyna.id  → waha:3000
```

**Pro:** Sudah terkonfigurasi di `docker-compose.prod.yml`, networking internal (tanpa expose port ke public), satu deployment target.
**Con:** Scale manual, semua di satu server.

### Opsi B: Next.js di Vercel + Services di VPS Docker

```
Vercel
└── app.mellyna.id (Next.js)
      │  butuh akses public ke:
      ▼
VPS Docker
├── postgres  (expose :5432 ke internet — RISIKO!)
├── minio     (expose :9000)
├── waha      (expose :3001)
└── n8n       (expose :5678)
```

**Pro:** Zero-config deploy untuk app (git push → live).
**Con:** PostgreSQL harus exposed ke internet (risiko security), latency antar Vercel dan VPS, lebih kompleks setup networking, harus kelola 2 deployment target.

**Rekomendasi: Gunakan Opsi A.** Konfigurasi sudah ada di `docker-compose.prod.yml`. Lebih simple, lebih aman.

---

## File yang Terlibat

| File | Status | Keterangan |
|---|---|---|
| `docker-compose.prod.yml` | Modify | Tambah Caddy reverse proxy |
| `Caddyfile` | Create | Reverse proxy config |
| `.env.prod` | Create | Production environment variables |
| `docker-compose.prod.yml` | Modify | Fix WEBHOOK_URL n8n ke domain publik |

---

## Task 1: Siapkan VPS dan Environment Variables

**Files:**
- Create: `.env.prod` (jangan di-commit, masuk `.gitignore`)

- [ ] **Step 1: Buat file `.env.prod`**

```bash
# PostgreSQL
POSTGRES_USER=mellyna
POSTGRES_PASSWORD=<password-kuat-random>
POSTGRES_DB=mellyna_db
DATABASE_URL=postgresql://mellyna:<password>@postgres:5432/mellyna_db

# NextAuth
NEXTAUTH_URL=https://app.mellyna.id
NEXTAUTH_SECRET=<random-32-char-string>

# MinIO
MINIO_ACCESS_KEY=<random>
MINIO_SECRET_KEY=<random-kuat>

# Midtrans
MIDTRANS_IS_PRODUCTION=true
MIDTRANS_SERVER_KEY=<dari-midtrans-dashboard>
MIDTRANS_CLIENT_KEY=<dari-midtrans-dashboard>
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=<sama-dengan-MIDTRANS_CLIENT_KEY>

# Waha
WAHA_API_KEY=<random-kuat>

# n8n
N8N_USER=admin
N8N_PASSWORD=<password-kuat>
N8N_PUBLIC_URL=https://n8n.mellyna.id/

# App → n8n
N8N_WEBHOOK_BASE_URL=https://n8n.mellyna.id
N8N_WEBHOOK_SECRET=<random-kuat>
```

- [ ] **Step 2: Generate random secrets**

```bash
# Jalankan di terminal untuk generate secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Jalankan 5x untuk: `POSTGRES_PASSWORD`, `NEXTAUTH_SECRET`, `MINIO_SECRET_KEY`, `WAHA_API_KEY`, `N8N_WEBHOOK_SECRET`.

- [ ] **Step 3: Tambah `.env.prod` ke `.gitignore`**

Buka `.gitignore`, pastikan ada:
```
.env.prod
.env.local
.env*.local
```

- [ ] **Step 4: Commit `.gitignore` update**

```bash
git add .gitignore
git commit -m "chore: ensure .env.prod excluded from git"
```

---

## Task 2: Tambah Caddy Reverse Proxy ke docker-compose.prod.yml

**Files:**
- Create: `Caddyfile`
- Modify: `docker-compose.prod.yml`

Tanpa reverse proxy, port aplikasi harus di-expose langsung ke internet dan tidak ada HTTPS otomatis. Caddy menangani SSL Let's Encrypt secara otomatis.

- [ ] **Step 1: Buat `Caddyfile`**

Ganti `mellyna.id` dengan domain kamu yang sebenarnya.

```caddy
app.mellyna.id {
    reverse_proxy app:3000
}

n8n.mellyna.id {
    reverse_proxy n8n:5678
}

waha.mellyna.id {
    reverse_proxy waha:3000
}

minio.mellyna.id {
    reverse_proxy minio:9000
}

minio-console.mellyna.id {
    reverse_proxy minio:9001
}
```

- [ ] **Step 2: Tambah service Caddy ke `docker-compose.prod.yml`**

Buka `docker-compose.prod.yml`, tambah di bagian `services:` sebelum `volumes:`:

```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app
      - n8n
      - waha
      - minio
```

- [ ] **Step 3: Tambah volume Caddy di `docker-compose.prod.yml`**

Di bagian `volumes:`, tambah:

```yaml
  caddy_data:
  caddy_config:
```

- [ ] **Step 4: Update WEBHOOK_URL n8n**

Di service `n8n` dalam `docker-compose.prod.yml`, pastikan:

```yaml
  n8n:
    image: n8nio/n8n
    restart: unless-stopped
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - WEBHOOK_URL=${N8N_PUBLIC_URL}
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
    volumes:
      - n8n_data:/home/node/.n8n
```

- [ ] **Step 5: Hapus expose ports dari service yang tidak perlu diakses publik**

Di `docker-compose.prod.yml`, hapus block `ports:` dari service `postgres` (tidak boleh exposed). Service `waha` dan `n8n` tidak perlu port karena sudah via Caddy:

```yaml
  postgres:
    # TIDAK ADA ports: di sini — hanya akses internal Docker
    image: postgres:16-alpine
    ...
```

- [ ] **Step 6: Commit perubahan**

```bash
git add docker-compose.prod.yml Caddyfile
git commit -m "feat(infra): add Caddy reverse proxy with auto-SSL to prod stack"
```

---

## Task 3: Build dan Push Docker Image App

**Files:**
- Verify: `Dockerfile` (pastikan ada)

- [ ] **Step 1: Cek Dockerfile ada**

```bash
ls Dockerfile
```

Jika tidak ada, buat `Dockerfile`:

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

- [ ] **Step 2: Pastikan `next.config` ada `output: 'standalone'`**

Buka `next.config.js` atau `next.config.ts`, pastikan:

```js
const nextConfig = {
  output: 'standalone',
  // ... config lain
}
```

- [ ] **Step 3: Build image lokal untuk test**

```bash
docker build -t mellyna-app:test .
```

Expected: Build berhasil tanpa error.

- [ ] **Step 4: Setup GitHub Actions untuk auto-build (opsional)**

Jika pakai GitHub Container Registry (sudah dikonfigurasi di `docker-compose.prod.yml` dengan `ghcr.io`), pastikan GitHub Actions workflow ada di `.github/workflows/docker-publish.yml`. Ini opsional - bisa juga build manual di VPS.

---

## Task 4: Deploy ke VPS

- [ ] **Step 1: SSH ke VPS dan install Docker**

```bash
# Di VPS (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Logout dan login lagi agar group berlaku
```

- [ ] **Step 2: Clone repo ke VPS**

```bash
git clone https://github.com/<username>/mellyna-education.git
cd mellyna-education
```

- [ ] **Step 3: Buat `.env.prod` di VPS**

Copy isi `.env.prod` yang sudah dibuat di Task 1 ke VPS:

```bash
nano .env.prod
# Paste isi file, save dengan Ctrl+X → Y → Enter
```

- [ ] **Step 4: Point domain ke IP VPS**

Di DNS provider (Cloudflare/Niagahoster/dll), tambah A record:

```
app.mellyna.id     → <IP VPS>
n8n.mellyna.id     → <IP VPS>
waha.mellyna.id    → <IP VPS>
minio.mellyna.id   → <IP VPS>
```

Tunggu DNS propagasi (1-5 menit jika Cloudflare, hingga 1 jam jika lain).

- [ ] **Step 5: Jalankan stack**

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Expected: Semua container status `Up`.

- [ ] **Step 6: Cek status**

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs app --tail=50
```

Expected: App berjalan, Prisma migrate deploy berhasil.

- [ ] **Step 7: Verifikasi HTTPS**

Buka browser:
- `https://app.mellyna.id` → Next.js app
- `https://n8n.mellyna.id` → n8n dashboard (login dengan N8N_USER/N8N_PASSWORD)
- `https://waha.mellyna.id/dashboard` → Waha dashboard

---

## Task 5: Setup Waha Session WhatsApp

- [ ] **Step 1: Buka Waha dashboard**

Buka `https://waha.mellyna.id/dashboard`, login dengan API Key dari `.env.prod`.

- [ ] **Step 2: Mulai session**

Di dashboard Waha, klik **Start Session** → nama session: `mellyna`.

- [ ] **Step 3: Scan QR Code**

QR code muncul di dashboard. Scan dengan WhatsApp Business nomor Mellyna.

- [ ] **Step 4: Verifikasi webhook**

Setelah session aktif, kirim pesan WhatsApp ke nomor tersebut. Cek log app:

```bash
docker compose -f docker-compose.prod.yml logs app --tail=20
```

Expected: Log masuk ke `/api/webhooks/waha`.

---

## Task 6: Setup n8n Workflows

- [ ] **Step 1: Buka n8n dashboard**

Buka `https://n8n.mellyna.id`, login dengan N8N_USER/N8N_PASSWORD.

- [ ] **Step 2: Import workflow yang ada**

Jika ada file workflow JSON di repo, import via n8n UI: **Settings → Import**.

- [ ] **Step 3: Verifikasi webhook n8n dari app**

Di app, trigger aksi yang memanggil n8n (misal: publish jadwal → broadcast WA). Cek di n8n **Executions** apakah workflow terpicu.

- [ ] **Step 4: Set timezone n8n**

Di n8n **Settings → General**, set timezone ke `Asia/Jakarta`.

---

## Jika Tetap Ingin Pakai Vercel untuk App (Opsi B)

Jika kamu memilih Vercel untuk Next.js app, berikut perbedaan konfigurasi:

- [ ] **Modifikasi `docker-compose.prod.yml` — hapus service `app`**

Service `app` (Next.js) tidak dijalankan di Docker. Jalankan hanya:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d postgres minio waha n8n caddy
```

- [ ] **Expose PostgreSQL ke internet (RISIKO TINGGI)**

Tambah `ports:` ke service postgres:
```yaml
postgres:
  ports:
    - "5432:5432"
```

**WAJIB:** Tambah firewall rule — hanya izinkan IP Vercel (tidak tetap, sulit dikonfigurasi). Lebih aman: gunakan managed PostgreSQL (Supabase, Neon, dll) sebagai pengganti.

- [ ] **Set environment variables di Vercel dashboard**

Di Vercel Project → Settings → Environment Variables, masukkan semua env vars termasuk:
- `DATABASE_URL` → poin ke PostgreSQL VPS (IP publik:5432) atau managed DB
- `WAHA_BASE_URL` → `https://waha.mellyna.id`
- `N8N_WEBHOOK_BASE_URL` → `https://n8n.mellyna.id`
- Semua env vars lain dari `.env.prod`

- [ ] **Deploy ke Vercel**

```bash
npx vercel --prod
```

**Catatan:** Opsi B lebih rumit dan kurang aman daripada Opsi A. Pertimbangkan matang-matang.

---

## Self-Review

### Spec Coverage
- ✅ Penjelasan kenapa n8n/Waha tidak bisa di Vercel
- ✅ Dua opsi arsitektur dengan trade-off jelas
- ✅ Reverse proxy dengan HTTPS otomatis (Caddy)
- ✅ Environment variables setup
- ✅ Waha session setup
- ✅ n8n workflow setup
- ✅ Fallback Vercel option dengan caveats

### Rekomendasi Final

**Gunakan Opsi A (Full Docker).** Konfigurasi `docker-compose.prod.yml` sudah hampir lengkap — hanya perlu tambah Caddy dan setup `.env.prod`. Lebih simple, lebih aman, semua service satu jaringan Docker internal.
