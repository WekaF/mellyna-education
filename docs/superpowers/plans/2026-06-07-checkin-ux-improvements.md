# Check-In UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve tutor check-in UX dengan dua perbaikan: (1) modal reminder otomatis jika ada jadwal hari ini tapi belum absen, dan (2) pesan error GPS yang jelas berbahasa Indonesia.

**Architecture:** Kedua perbaikan hanya menyentuh satu file: `components/dashboard/TutorDailyCheckIn.tsx`. Modal dikelola dengan state internal + `sessionStorage` per hari agar tidak muncul berulang dalam sesi yang sama. GPS error dibedakan per kode error standar Geolocation API.

**Tech Stack:** React 18, Next.js 14, TailwindCSS, Lucide Icons, browser Geolocation API

---

## File yang Dimodifikasi

| File | Perubahan |
|---|---|
| `components/dashboard/TutorDailyCheckIn.tsx` | Tambah state `showModal`, GPS error handler per kode, render modal overlay |

---

## Task 1: GPS Permission Error Messages

**Files:**
- Modify: `components/dashboard/TutorDailyCheckIn.tsx`

- [ ] **Step 1: Ganti error callback GPS**

Ganti baris 63–66 di `components/dashboard/TutorDailyCheckIn.tsx`:

```typescript
// LAMA:
      (err) => {
        setStatus('error')
        setErrorMsg(`Gagal mendapatkan GPS: ${err.message}`)
      },
```

```typescript
// BARU:
      (err) => {
        setStatus('error')
        if (err.code === 1) {
          setErrorMsg(
            'Izin lokasi ditolak. Klik ikon 🔒 di address bar browser → "Izinkan lokasi", lalu coba lagi.',
          )
        } else if (err.code === 2) {
          setErrorMsg('GPS tidak tersedia. Pastikan Location/GPS aktif di pengaturan perangkat Anda.')
        } else if (err.code === 3) {
          setErrorMsg('GPS timeout. Pindah ke area lebih terbuka atau periksa sinyal, lalu coba lagi.')
        } else {
          setErrorMsg('Gagal mendapatkan lokasi GPS.')
        }
      },
```

- [ ] **Step 2: Verifikasi TypeScript**

```bash
cd /Users/weka/project/mellyna-education && npx tsc --noEmit 2>&1 | grep -v node_modules | grep "TutorDailyCheckIn" | head -5
```

Expected: tidak ada output (tidak ada error).

- [ ] **Step 3: Commit**

```bash
cd /Users/weka/project/mellyna-education
git add components/dashboard/TutorDailyCheckIn.tsx
git commit -m "fix: improve GPS permission error messages to Indonesian with actionable hints"
```

---

## Task 2: Check-In Reminder Modal

**Files:**
- Modify: `components/dashboard/TutorDailyCheckIn.tsx`

Modal muncul otomatis saat component mount jika:
- `hasScheduleToday === true` DAN `!initialCheckedIn`
- Belum di-dismiss hari ini (`sessionStorage` key `checkin-modal-dismissed-YYYY-MM-DD` tidak ada)

Tombol di modal:
- **"Absen Sekarang"** → tutup modal + jalankan `handleAbsen()`
- **"Nanti"** → tutup modal + simpan dismissed key ke sessionStorage

- [ ] **Step 1: Ganti seluruh isi `components/dashboard/TutorDailyCheckIn.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { MapPin, CheckCircle2, AlertTriangle, Loader2, X, CalendarCheck } from 'lucide-react'

interface Props {
  todayLabel: string
  initialCheckedIn: boolean
  initialCheckedInAt?: string
  initialDistanceM?: number
  hasScheduleToday: boolean
  todayDateKey: string // format "YYYY-MM-DD", dikirim dari server agar konsisten WIB
}

type Status = 'idle' | 'locating' | 'sending' | 'success' | 'outside' | 'error' | 'no-schedule'

export function TutorDailyCheckIn({
  todayLabel,
  initialCheckedIn,
  initialCheckedInAt,
  initialDistanceM,
  hasScheduleToday,
  todayDateKey,
}: Props) {
  const [status, setStatus] = useState<Status>(
    initialCheckedIn ? 'success' : !hasScheduleToday ? 'no-schedule' : 'idle',
  )
  const [checkedInAt, setCheckedInAt] = useState<string | null>(initialCheckedInAt ?? null)
  const [distanceM, setDistanceM] = useState<number | null>(initialDistanceM ?? null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const dismissedKey = `checkin-modal-dismissed-${todayDateKey}`

  useEffect(() => {
    if (hasScheduleToday && !initialCheckedIn) {
      const alreadyDismissed = typeof window !== 'undefined' && sessionStorage.getItem(dismissedKey)
      if (!alreadyDismissed) {
        setShowModal(true)
      }
    }
  }, [hasScheduleToday, initialCheckedIn, dismissedKey])

  const handleDismissModal = () => {
    sessionStorage.setItem(dismissedKey, '1')
    setShowModal(false)
  }

  const handleAbsenFromModal = () => {
    setShowModal(false)
    handleAbsen()
  }

  const handleAbsen = () => {
    if (!navigator.geolocation) {
      setStatus('error')
      setErrorMsg('Browser tidak mendukung GPS.')
      return
    }
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setStatus('sending')
        try {
          const res = await fetch('/api/tutor-checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          })
          const data = await res.json()
          if (data.isWithinRadius) {
            setStatus('success')
            setCheckedInAt(data.checkedInAt)
            setDistanceM(data.distanceM)
          } else {
            setStatus('outside')
            setErrorMsg(data.message)
          }
        } catch {
          setStatus('error')
          setErrorMsg('Gagal menghubungi server.')
        }
      },
      (err) => {
        setStatus('error')
        if (err.code === 1) {
          setErrorMsg(
            'Izin lokasi ditolak. Klik ikon 🔒 di address bar browser → "Izinkan lokasi", lalu coba lagi.',
          )
        } else if (err.code === 2) {
          setErrorMsg('GPS tidak tersedia. Pastikan Location/GPS aktif di pengaturan perangkat Anda.')
        } else if (err.code === 3) {
          setErrorMsg('GPS timeout. Pindah ke area lebih terbuka atau periksa sinyal, lalu coba lagi.')
        } else {
          setErrorMsg('Gagal mendapatkan lokasi GPS.')
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  }

  const checkedInTime = checkedInAt
    ? new Date(checkedInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <>
      {/* Modal Reminder Absensi */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-5 flex items-start gap-3">
              <CalendarCheck className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">Ada Jadwal Mengajar Hari Ini</p>
                <p className="text-xs text-slate-500 mt-0.5">{todayLabel}</p>
              </div>
              <button
                onClick={handleDismissModal}
                className="ml-auto p-1 rounded-full hover:bg-amber-100 text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-600 leading-relaxed">
                Kamu belum absen hari ini. Harap lakukan absensi sebelum mengajar agar kehadiranmu tercatat.
              </p>
              <p className="text-xs text-slate-400 mt-2">
                📍 Absensi hanya berlaku dalam radius 500m dari lokasi bimbel.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={handleAbsenFromModal}
                className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <MapPin className="h-4 w-4" />
                Absen Sekarang
              </button>
              <button
                onClick={handleDismissModal}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Nanti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner Absensi */}
      <div
        className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
          status === 'success'
            ? 'bg-emerald-50 border-emerald-200'
            : status === 'outside' || status === 'error'
              ? 'bg-rose-50 border-rose-200'
              : status === 'no-schedule'
                ? 'bg-slate-50 border-slate-200'
                : 'bg-teal-50 border-teal-200'
        }`}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <MapPin
              className={`h-4 w-4 shrink-0 ${
                status === 'success'
                  ? 'text-emerald-600'
                  : status === 'outside' || status === 'error'
                    ? 'text-rose-500'
                    : 'text-teal-600'
              }`}
            />
            <p className="font-bold text-slate-800 text-sm">Absensi Harian</p>
          </div>
          <p className="text-xs text-slate-500">{todayLabel}</p>

          {status === 'success' && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm font-semibold text-emerald-700">
                Sudah absen pukul {checkedInTime}
                {distanceM !== null && (
                  <span className="font-normal text-emerald-600"> ({distanceM}m dari lokasi)</span>
                )}
              </p>
            </div>
          )}

          {(status === 'outside' || status === 'error') && (
            <div className="flex items-start gap-1.5 mt-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-600">{errorMsg}</p>
            </div>
          )}

          {status === 'no-schedule' && (
            <p className="text-sm text-slate-400 mt-1">Tidak ada jadwal mengajar hari ini.</p>
          )}

          {(status === 'locating' || status === 'sending') && (
            <p className="text-sm text-teal-600 mt-1 flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {status === 'locating' ? 'Mendeteksi lokasi GPS...' : 'Menyimpan absensi...'}
            </p>
          )}
        </div>

        {(status === 'idle' || status === 'outside' || status === 'error') && (
          <button
            onClick={handleAbsen}
            disabled={status === 'locating' || status === 'sending'}
            className="shrink-0 flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
          >
            <MapPin className="h-4 w-4" />
            Absen Sekarang
          </button>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Update pemanggilan TutorDailyCheckIn di tutor dashboard**

Buka `app/(dashboard)/tutor/page.tsx`, tambahkan prop `todayDateKey` pada pemanggilan `TutorDailyCheckIn`:

```tsx
      <TutorDailyCheckIn
        todayLabel={todayLabel}
        initialCheckedIn={todayCheckIn?.isWithinRadius ?? false}
        initialCheckedInAt={todayCheckIn?.checkedInAt.toISOString()}
        initialDistanceM={todayCheckIn ? Math.round(todayCheckIn.distanceM) : undefined}
        hasScheduleToday={!!hasScheduleToday}
        todayDateKey={today}
      />
```

`today` sudah ada di file tersebut (hasil `getTodayWIB()`), sehingga tidak perlu perubahan data fetching.

- [ ] **Step 3: Verifikasi TypeScript**

```bash
cd /Users/weka/project/mellyna-education && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: tidak ada error baru (ada 1 error pre-existing di `app/api/media/upload/route.ts` — abaikan).

- [ ] **Step 4: Jalankan semua test**

```bash
cd /Users/weka/project/mellyna-education && npx jest --no-coverage 2>&1 | tail -5
```

Expected: All tests pass (sekitar 100 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/weka/project/mellyna-education
git add components/dashboard/TutorDailyCheckIn.tsx "app/(dashboard)/tutor/page.tsx"
git commit -m "feat: add check-in reminder modal and Indonesian GPS error messages"
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| Modal muncul otomatis jika ada jadwal & belum absen | Task 2 (`showModal` state + `useEffect`) |
| Modal tidak muncul lagi di sesi yang sama setelah dismiss | Task 2 (`sessionStorage` per hari) |
| Tombol "Absen Sekarang" di modal langsung trigger GPS | Task 2 (`handleAbsenFromModal`) |
| Tombol "Nanti" tutup modal tanpa absen | Task 2 (`handleDismissModal`) |
| GPS error PERMISSION_DENIED — pesan Indonesian + panduan | Task 1 (err.code === 1) |
| GPS error POSITION_UNAVAILABLE — pesan Indonesian | Task 1 (err.code === 2) |
| GPS error TIMEOUT — pesan Indonesian + saran | Task 1 (err.code === 3) |

### Placeholder Scan

Tidak ada TBD, TODO, atau placeholder.

### Type Consistency

- `todayDateKey: string` ditambahkan ke `Props` interface dan dipakai di `dismissedKey` — konsisten
- `handleAbsenFromModal` memanggil `handleAbsen()` yang sudah ada — tidak ada duplikasi logika
- `err.code` adalah `GeolocationPositionError.code` (number 1/2/3) — sesuai Geolocation API spec
