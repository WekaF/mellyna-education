# Tutor Check-in Location Permission Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tutor bisa absen harian: browser benar-benar memunculkan prompt izin lokasi, dan UI memandu tutor sebelum (pre-permission) dan sesudah izin ditolak.

**Architecture:**
Root cause: `next.config.ts` mengirim header `Permissions-Policy: geolocation=()` ke semua route. Nilai `()` = geolocation dimatikan untuk SEMUA origin termasuk situs sendiri, jadi `navigator.geolocation.getCurrentPosition` langsung gagal dengan `PERMISSION_DENIED` (code 1) tanpa pernah menampilkan prompt — tutor tidak punya cara untuk mengizinkan. Fix utama: ubah ke `geolocation=(self)`.
Di atas fix itu, tambah UX "pre-permission modal": modal reminder yang sudah ada di `TutorDailyCheckIn` dibuat sadar status izin (Permissions API) — `prompt` → jelaskan dulu kenapa butuh lokasi lalu tombol "Izinkan & Absen" (prompt browser muncul dari user gesture); `denied` → instruksi cara membuka izin per platform (Android Chrome, PWA terpasang, iPhone Safari); `granted` → langsung absen seperti sekarang.

**Rekomendasi (kenapa modal, bukan auto-request saat load):**
- Prompt izin yang muncul tanpa konteks saat halaman dibuka cenderung ditolak, dan sekali ditolak browser tidak akan bertanya lagi — tutor harus reset manual. Modal penjelas dulu → klik → baru prompt browser = tingkat izin lebih tinggi.
- iOS Safari hanya memunculkan prompt dari user gesture yang reliabel; tombol di modal memenuhi itu.
- Modal reminder sudah ada → cukup ubah isinya, tidak tambah komponen baru.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind, lucide-react, Jest (testEnvironment `node`, tanpa React Testing Library).

---

## File Structure

| File | Aksi | Tanggung jawab |
|------|------|----------------|
| `next.config.ts` | Modify baris 9 | Header `Permissions-Policy` izinkan geolocation untuk origin sendiri |
| `lib/location-permission.ts` | Create | `getLocationPermission()` — baca status izin lokasi, fallback aman untuk browser tanpa Permissions API |
| `components/dashboard/TutorDailyCheckIn.tsx` | Modify | Modal & tombol absen sadar status izin; instruksi saat ditolak |
| `__tests__/lib/location-permission.test.ts` | Create | Unit test helper |
| `__tests__/lib/permissions-policy.test.ts` | Create | Regression guard: header tidak boleh memblokir geolocation lagi |

Tidak ada perubahan API (`app/api/tutor-checkin/route.ts`) — validasi koordinat & radius di server sudah benar.

---

### Task 1: Fix header Permissions-Policy (root cause)

**Files:**
- Modify: `next.config.ts:9`
- Test: `__tests__/lib/permissions-policy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/permissions-policy.test.ts`:

```ts
import { readFileSync } from 'fs'
import { join } from 'path'

// ponytail: cek teks config, bukan import next.config (withPWA berat di jest). Ganti ke import kalau securityHeaders dipindah ke modul sendiri.
describe('Permissions-Policy header', () => {
  const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')

  it('allows geolocation for own origin (needed for tutor check-in)', () => {
    expect(config).toMatch(/geolocation=\(self\)/)
  })

  it('does not block geolocation for every origin', () => {
    expect(config).not.toMatch(/geolocation=\(\)/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/permissions-policy.test.ts`
Expected: FAIL — kedua test gagal (`geolocation=()` masih ada).

- [ ] **Step 3: Write minimal implementation**

`next.config.ts` baris 9, ganti:

```ts
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
```

menjadi:

```ts
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/permissions-policy.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify header di server nyata**

Run (terminal 1): `npm run dev`
Run (terminal 2): `curl -sI http://localhost:3000/ | grep -i permissions-policy`
Expected: `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`

Lalu login sebagai tutor di Chrome desktop (`http://localhost:3000/tutor`), klik "Absen Sekarang". Expected: browser menampilkan prompt "Izinkan lokasi" (sebelumnya langsung error "Izin lokasi ditolak"). Stop dev server.

- [ ] **Step 6: Commit**

```bash
rtk git add next.config.ts __tests__/lib/permissions-policy.test.ts
rtk git commit -m "fix(checkin): allow geolocation for own origin in Permissions-Policy

geolocation=() blocked GPS on every origin, so browsers rejected
getCurrentPosition without prompting and tutors could never check in.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

### Task 2: Helper `getLocationPermission`

**Files:**
- Create: `lib/location-permission.ts`
- Test: `__tests__/lib/location-permission.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/location-permission.test.ts`:

```ts
import { getLocationPermission } from '@/lib/location-permission'

const geo = {} as Geolocation

function navWith(permissions?: unknown, geolocation: unknown = geo) {
  return { geolocation, permissions } as unknown as Navigator
}

describe('getLocationPermission', () => {
  it('returns unsupported when browser has no geolocation', async () => {
    expect(await getLocationPermission(navWith(undefined, null))).toBe('unsupported')
  })

  it('returns prompt when Permissions API is missing (old Safari)', async () => {
    expect(await getLocationPermission(navWith(undefined))).toBe('prompt')
  })

  it.each(['granted', 'prompt', 'denied'] as const)('returns %s from Permissions API', async (state) => {
    const nav = navWith({ query: jest.fn().mockResolvedValue({ state }) })
    expect(await getLocationPermission(nav)).toBe(state)
  })

  it('queries geolocation permission by name', async () => {
    const query = jest.fn().mockResolvedValue({ state: 'granted' })
    await getLocationPermission(navWith({ query }))
    expect(query).toHaveBeenCalledWith({ name: 'geolocation' })
  })

  it('returns prompt when query throws', async () => {
    const nav = navWith({ query: jest.fn().mockRejectedValue(new TypeError('unsupported name')) })
    expect(await getLocationPermission(nav)).toBe('prompt')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/location-permission.test.ts`
Expected: FAIL — `Cannot find module '@/lib/location-permission'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/location-permission.ts`:

```ts
export type LocationPermission = 'granted' | 'prompt' | 'denied' | 'unsupported'

// ponytail: tanpa Permissions API (Safari lama) status tidak bisa dibaca → anggap 'prompt', getCurrentPosition yang menentukan.
export async function getLocationPermission(nav: Navigator = navigator): Promise<LocationPermission> {
  if (!nav.geolocation) return 'unsupported'
  if (!nav.permissions?.query) return 'prompt'
  try {
    const status = await nav.permissions.query({ name: 'geolocation' })
    return status.state
  } catch {
    return 'prompt'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/location-permission.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/location-permission.ts __tests__/lib/location-permission.test.ts
rtk git commit -m "feat(checkin): add getLocationPermission helper

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

### Task 3: Modal absen sadar status izin

**Files:**
- Modify: `components/dashboard/TutorDailyCheckIn.tsx` (import baris 3-4, state baris 25-31, effect baris 35-42, error handler baris 87-100, modal baris 111-152, tombol kartu baris 211-219)

Perilaku target:

| Status izin | Modal (muncul otomatis jika ada jadwal & belum absen) | Tombol "Absen Sekarang" di kartu |
|---|---|---|
| `granted` | Isi lama, tombol "Absen Sekarang" | Langsung ambil GPS |
| `prompt` | Penjelasan kenapa butuh lokasi + tombol "Izinkan & Absen" | Langsung ambil GPS (memicu prompt browser) |
| `denied` | Instruksi buka izin per platform + tombol "Coba Lagi" | Membuka modal instruksi (tidak memanggil GPS) |
| `unsupported` | Isi lama; klik → error "Browser tidak mendukung GPS." (sudah ada) | Sama |

Saat tutor mengubah izin di pengaturan browser, `PermissionStatus.onchange` memperbarui UI tanpa reload (Chrome/Edge/Firefox; Safari tanpa event → tombol "Coba Lagi").

- [ ] **Step 1: Ubah import & tambah state izin**

Ganti baris 3-4:

```tsx
import { useEffect, useState } from 'react'
import { MapPin, CheckCircle2, AlertTriangle, Loader2, X, CalendarCheck } from 'lucide-react'
```

menjadi:

```tsx
import { useEffect, useState } from 'react'
import { MapPin, CheckCircle2, AlertTriangle, Loader2, X, CalendarCheck, ShieldAlert } from 'lucide-react'
import { getLocationPermission, type LocationPermission } from '@/lib/location-permission'

const DENIED_MSG = 'Izin lokasi diblokir. Buka izin lokasi untuk situs ini, lalu tekan "Coba Lagi".'
```

Setelah baris 31 (`const [showModal, setShowModal] = useState(false)`) tambah:

```tsx
  const [permission, setPermission] = useState<LocationPermission | null>(null)
```

- [ ] **Step 2: Baca & pantau status izin**

Setelah effect modal yang ada (baris 35-42), tambah effect baru:

```tsx
  useEffect(() => {
    let cancelled = false
    let ps: PermissionStatus | null = null
    getLocationPermission().then((p) => {
      if (!cancelled) setPermission(p)
    })
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((s) => {
        if (cancelled) return
        ps = s
        s.onchange = () => setPermission(s.state)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (ps) ps.onchange = null
    }
  }, [])
```

- [ ] **Step 3: Error code 1 → tandai denied & buka modal instruksi**

Di error callback `getCurrentPosition`, ganti blok:

```tsx
        if (err.code === 1) {
          setErrorMsg(
            'Izin lokasi ditolak. Klik ikon 🔒 di address bar browser → "Izinkan lokasi", lalu coba lagi.',
          )
        } else if (err.code === 2) {
```

menjadi:

```tsx
        if (err.code === 1) {
          setErrorMsg(DENIED_MSG)
          setPermission('denied')
          setShowModal(true)
        } else if (err.code === 2) {
```

Dan setelah `navigator.geolocation.getCurrentPosition(` sukses berarti izin granted — di awal success callback (`async (pos) => {`), tambah baris pertama:

```tsx
        setPermission('granted')
```

- [ ] **Step 4: Handler tombol kartu**

Setelah fungsi `handleAbsen` (setelah baris 103), tambah:

```tsx
  const handleAbsenClick = () => {
    if (permission === 'denied') {
      setShowModal(true)
      return
    }
    handleAbsen()
  }
```

Lalu di tombol kartu (baris 212-213) ganti `onClick={handleAbsen}` menjadi `onClick={handleAbsenClick}`.

- [ ] **Step 5: Isi modal bergantung status izin**

Ganti blok body + footer modal (baris 127-149, dari `<div className="px-6 py-5">` sampai penutup `</div>` tombol "Nanti") dengan:

```tsx
            {permission === 'denied' ? (
              <div className="px-6 py-5 space-y-3">
                <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-100 p-3">
                  <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-700">
                    Izin lokasi untuk situs ini diblokir, jadi absensi tidak bisa dilakukan.
                  </p>
                </div>
                <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <p>
                    <span className="font-semibold">Android (Chrome):</span> ketuk ikon 🔒 / ⓘ di sebelah alamat
                    situs → <em>Izin</em> → <em>Lokasi</em> → <em>Izinkan</em>.
                  </p>
                  <p>
                    <span className="font-semibold">Aplikasi terpasang (PWA):</span> tahan ikon aplikasi →{' '}
                    <em>Info aplikasi</em> → <em>Izin</em> → <em>Lokasi</em> → <em>Izinkan</em>.
                  </p>
                  <p>
                    <span className="font-semibold">iPhone (Safari):</span> <em>Pengaturan</em> →{' '}
                    <em>Privasi &amp; Keamanan</em> → <em>Layanan Lokasi</em> (aktifkan) → <em>Situs Web Safari</em>{' '}
                    → <em>Saat Menggunakan App</em>. Lalu di Safari ketuk <em>aA</em> → <em>Pengaturan Situs Web</em>{' '}
                    → <em>Lokasi</em> → <em>Izinkan</em>.
                  </p>
                  <p>Pastikan juga GPS/Lokasi di perangkat menyala.</p>
                </div>
              </div>
            ) : (
              <div className="px-6 py-5">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Kamu belum absen hari ini. Harap lakukan absensi sebelum mengajar agar kehadiranmu tercatat.
                </p>
                {permission === 'prompt' && (
                  <p className="text-sm text-slate-600 leading-relaxed mt-2">
                    Absensi memakai lokasi GPS. Setelah menekan tombol di bawah, browser akan meminta izin lokasi —
                    pilih <span className="font-semibold">Izinkan</span>.
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  📍 Absensi hanya berlaku dalam radius 500m dari lokasi bimbel.
                </p>
              </div>
            )}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={handleAbsenFromModal}
                className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <MapPin className="h-4 w-4" />
                {permission === 'denied' ? 'Coba Lagi' : permission === 'prompt' ? 'Izinkan & Absen' : 'Absen Sekarang'}
              </button>
              <button
                onClick={handleDismissModal}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Nanti
              </button>
            </div>
```

Catatan: "Coba Lagi" memanggil `handleAbsenFromModal` → `handleAbsen` → `getCurrentPosition`. Jika izin masih diblokir, error code 1 membuka modal lagi (Step 3) — loop yang disengaja dan terlihat oleh user, bukan diam-diam.

Judul modal ("Ada Jadwal Mengajar Hari Ini") tetap; modal tetap hanya untuk tutor yang punya jadwal hari ini (kondisi `hasScheduleToday` di effect lama tidak diubah). Tutor tanpa jadwal tidak perlu absen, jadi tidak perlu diminta izin.

- [ ] **Step 6: Typecheck & lint**

Run: `rtk tsc --noEmit`
Expected: tidak ada error baru di `components/dashboard/TutorDailyCheckIn.tsx` atau `lib/location-permission.ts` (bandingkan dengan `tsc-output.txt` jika ada error lama).

Run: `rtk lint components/dashboard/TutorDailyCheckIn.tsx lib/location-permission.ts`
Expected: 0 error.

- [ ] **Step 7: Run full test suite**

Run: `rtk test npx jest`
Expected: semua PASS, termasuk `geolocation.test.ts`, `location-permission.test.ts`, `permissions-policy.test.ts`.

- [ ] **Step 8: Commit**

```bash
rtk git add components/dashboard/TutorDailyCheckIn.tsx
rtk git commit -m "feat(checkin): permission-aware check-in modal for tutors

Explain GPS use before the browser prompt, and show per-platform
steps to re-enable location when permission is blocked.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

### Task 4: Verifikasi manual di browser nyata

Geolocation hanya jalan di secure context (HTTPS atau `localhost`). Tes HP harus lewat domain production/staging HTTPS (Caddy), bukan IP LAN `http://192.168.x.x`.

**Files:** tidak ada.

- [ ] **Step 1: Chrome desktop — izin belum pernah diberikan**

`npm run dev`, login tutor yang punya jadwal hari ini & belum absen. Reset izin dulu: ikon 🔒 di address bar → *Reset permissions*. Reload `/tutor`.
Expected: modal muncul dengan teks "Absensi memakai lokasi GPS…" dan tombol **Izinkan & Absen**. Klik → prompt browser muncul → Allow → status kartu "Sudah absen pukul …" (atau pesan di luar radius jika jauh dari bimbel).

- [ ] **Step 2: Chrome desktop — izin ditolak**

Reset izin, reload, klik **Izinkan & Absen**, pilih *Block*.
Expected: modal berganti ke instruksi (ikon perisai merah, teks Android/PWA/iPhone), tombol **Coba Lagi**. Kartu menampilkan pesan `DENIED_MSG`. Klik tombol kartu "Absen Sekarang" → modal instruksi terbuka (tidak ada request GPS).

- [ ] **Step 3: Buka izin tanpa reload**

Dengan modal instruksi terbuka, ubah izin lokasi ke *Allow* lewat ikon 🔒.
Expected: tombol modal berubah ke **Absen Sekarang** tanpa reload (efek `onchange`). Klik → absen berhasil.

- [ ] **Step 4: HP Android (Chrome + PWA) dan iPhone (Safari) di domain HTTPS**

Ulangi Step 1-2 setelah deploy staging/production. Untuk iPhone tanpa event `onchange`: setelah mengizinkan di Pengaturan, kembali ke Safari, tekan **Coba Lagi** → absen berhasil.
Expected: prompt izin muncul di kedua platform; instruksi cocok dengan menu di perangkat (sesuaikan teks jika berbeda).

- [ ] **Step 5: Report ke user**

Lapor: hasil tiap skenario (lulus/gagal + screenshot/teks error jika gagal). Tidak ada file diedit di task ini.

---

## Di luar scope (sengaja)

- Absensi untuk role selain TUTOR — API memang membatasi `role === 'TUTOR'`.
- Fallback non-GPS (absen manual oleh admin) — tambah kalau tutor tanpa GPS jadi masalah nyata.
- Memindahkan `securityHeaders` ke modul terpisah agar dites lewat import — regression test berbasis teks cukup untuk sekarang.
