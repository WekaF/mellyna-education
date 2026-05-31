# Fix Media Subdomain DNS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buat `media.mellyna-education.my.id` bisa diakses di prod (sekarang DNS_PROBE_FINISHED_NXDOMAIN).

**Root Cause:** DNS A record `media.mellyna-education.my.id` belum dibuat di DNS provider. Caddyfile sudah benar (line 13-15), docker-compose.prod.yml sudah benar (`MINIO_PUBLIC_URL: https://media.mellyna-education.my.id`), MinIO sudah running di VPS. Hanya DNS yang kurang.

**Architecture:** VPS 43.133.152.91 → Caddy reverse proxy → `minio:9000`. Public bucket policy sudah di-set via `ensureBucket()` di `lib/storage.ts`.

**Tech Stack:** DNS provider (Cloudflare/Niagahoster), Caddy 2, MinIO, SSH ke VPS Ubuntu.

---

## Task 1: Tambah DNS A Record

Buka dashboard DNS provider kamu (Cloudflare, Niagahoster, atau provider lain).

- [ ] **Step 1: Login ke DNS provider**

Buka dashboard DNS untuk domain `mellyna-education.my.id`.

- [ ] **Step 2: Tambah A record untuk media subdomain**

Tambah record berikut:

```
Type : A
Name : media
Value: 43.133.152.91
TTL  : Auto (atau 300)
```

**Jika pakai Cloudflare:** Set "Proxy status" ke **DNS only** (ikon awan abu-abu, BUKAN orange). MinIO video streaming tidak kompatibel dengan Cloudflare proxy karena Cloudflare membatasi upload/streaming > 100MB di free plan.

- [ ] **Step 3: Verifikasi DNS sudah propagasi**

Tunggu 1-5 menit, lalu cek dari browser atau terminal:

```bash
# Di terminal lokal (Windows PowerShell)
Resolve-DnsName media.mellyna-education.my.id

# Expected output:
# Name                           Type   TTL   Section    IPAddress
# media.mellyna-education.my.id  A      300   Answer     43.133.152.91
```

Atau cek via https://dnschecker.org dengan domain `media.mellyna-education.my.id`.

---

## Task 2: Verifikasi MinIO & Caddy di VPS

Setelah DNS propagasi, verifikasi stack berjalan benar.

- [ ] **Step 1: SSH ke VPS**

```bash
ssh ubuntu@43.133.152.91
```

- [ ] **Step 2: Cek container MinIO running**

```bash
cd ~/mellyna-education
docker compose -f docker-compose.prod.yml ps
```

Expected: Container `minio` status `Up`. Jika `Exited`, jalankan:

```bash
docker compose -f docker-compose.prod.yml up -d minio
```

- [ ] **Step 3: Cek Caddy logs untuk media domain**

```bash
docker compose -f docker-compose.prod.yml logs caddy --tail=30
```

Jika ada error SSL certificate untuk `media.mellyna-education.my.id`, Caddy butuh waktu ~30 detik untuk issue cert dari Let's Encrypt (DNS harus sudah propagasi dulu).

- [ ] **Step 4: Test akses MinIO langsung dari VPS**

```bash
curl -I http://localhost:9000/minio/health/live
```

Expected: `HTTP/1.1 200 OK`

- [ ] **Step 5: Test akses media via Caddy (HTTPS)**

Dari terminal lokal, coba akses file:

```bash
# Ganti filename dengan file yang ada di bucket
curl -I https://media.mellyna-education.my.id/mellyna-media/1780240161991-1000762609.mp4
```

Expected: `HTTP/1.1 200 OK` atau `HTTP/1.1 206 Partial Content`.

---

## Task 3: Fix MinIO Bucket Policy (Jika File 403)

Jika DNS sudah OK tapi file masih tidak bisa diakses (HTTP 403), bucket policy perlu di-reset.

- [ ] **Step 1: Cek apakah bucket mellyna-media ada**

SSH ke VPS, lalu:

```bash
docker exec -it mellyna-education-minio-1 mc alias set local http://localhost:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY
docker exec -it mellyna-education-minio-1 mc ls local/mellyna-media --first 5
```

Ganti `$MINIO_ACCESS_KEY` dan `$MINIO_SECRET_KEY` dengan nilai dari `.env.prod`.

- [ ] **Step 2: Set bucket policy ke public read**

```bash
docker exec -it mellyna-education-minio-1 mc anonymous set download local/mellyna-media
```

Expected output: `Access permission for 'local/mellyna-media' is set to 'download'`

- [ ] **Step 3: Test akses file lagi**

```bash
curl -I https://media.mellyna-education.my.id/mellyna-media/1780240161991-1000762609.mp4
```

Expected: `HTTP/1.1 200 OK`

---

## Task 4: (Opsional) Security — Tutup Port MinIO yang Terbuka

Saat ini `docker-compose.prod.yml` expose port 9000 dan 9001 langsung ke internet (semua IP). Akses publik seharusnya hanya via Caddy (HTTPS).

- [ ] **Step 1: Ubah ports MinIO di docker-compose.prod.yml**

Buka `docker-compose.prod.yml`, ubah bagian `minio`:

**Sebelum:**
```yaml
  minio:
    ports:
      - "9000:9000"
      - "9001:9001"
```

**Sesudah:**
```yaml
  minio:
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"
```

Ini membuat port hanya bisa diakses dari localhost VPS, tidak dari internet. Caddy tetap bisa proxy karena berada di Docker network yang sama.

- [ ] **Step 2: Restart stack**

```bash
# Di VPS
cd ~/mellyna-education
git pull
docker compose -f docker-compose.prod.yml up -d minio
```

- [ ] **Step 3: Verifikasi Caddy masih bisa proxy ke MinIO**

```bash
curl -I https://media.mellyna-education.my.id/mellyna-media/1780240161991-1000762609.mp4
```

Expected: `HTTP/1.1 200 OK` (akses via Caddy masih OK, akses langsung `http://43.133.152.91:9000` sudah tidak bisa dari luar).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.prod.yml
git commit -m "fix(security): restrict MinIO ports to localhost only, access via Caddy"
git push
```

---

## Ringkasan Diagnosis

| Problem | Status | Fix |
|---------|--------|-----|
| DNS A record `media.mellyna-education.my.id` | ❌ Missing | Task 1: Tambah di DNS provider |
| Caddyfile config | ✅ Benar (line 13-15) | Tidak perlu ubah |
| MinIO `MINIO_PUBLIC_URL` env | ✅ Benar di docker-compose.prod.yml | Tidak perlu ubah |
| Bucket public policy | ✅ Di-set via `ensureBucket()` | Task 3 jika masih 403 |
| MinIO port exposed ke internet | ⚠️ Minor security risk | Task 4 (opsional) |
