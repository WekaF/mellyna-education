'use client'

import { useEffect, useState } from 'react'
import { MapPin, CheckCircle2, AlertTriangle, Loader2, X, CalendarCheck, ShieldAlert, Clock } from 'lucide-react'
import { getLocationPermission, type LocationPermission } from '@/lib/location-permission'
import { CHECKIN_RADIUS_METERS } from '@/lib/geolocation'

const DENIED_MSG = 'Izin lokasi diblokir. Buka izin lokasi untuk situs ini, lalu tekan "Coba Lagi".'

export interface CheckInScheduleItem {
  scheduleId: string
  className: string
  startTime: string
  endTime: string
  opensAt: string
  startsAt: string
  checkedInAt: string | null
  distanceM: number | null
}

interface Props {
  todayLabel: string
  todayDateKey: string
  schedules: CheckInScheduleItem[]
}

type RowStatus = 'idle' | 'locating' | 'sending' | 'success' | 'outside' | 'error'

interface RowState {
  status: RowStatus
  checkedInAt: string | null
  distanceM: number | null
  errorMsg: string | null
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })

export function TutorDailyCheckIn({ todayLabel, todayDateKey, schedules }: Props) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      schedules.map((s) => [
        s.scheduleId,
        {
          status: s.checkedInAt ? 'success' : 'idle',
          checkedInAt: s.checkedInAt,
          distanceM: s.distanceM,
          errorMsg: null,
        } satisfies RowState,
      ]),
    ),
  )
  // null saat render server supaya tidak hydration mismatch; diisi di client.
  const [now, setNow] = useState<number | null>(null)
  const [modalFor, setModalFor] = useState<string | null>(null)
  const [permission, setPermission] = useState<LocationPermission | null>(null)

  const patchRow = (scheduleId: string, patch: Partial<RowState>) =>
    setRows((prev) => ({
      ...prev,
      [scheduleId]: {
        ...(prev[scheduleId] ?? { status: 'idle', checkedInAt: null, distanceM: null, errorMsg: null }),
        ...patch,
      },
    }))

  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

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

  const isOpen = (s: CheckInScheduleItem) => now !== null && now >= new Date(s.opensAt).getTime()

  // Jadwal pertama yang sudah bisa diabsen tapi belum diabsen → diingatkan lewat modal.
  const pendingId =
    schedules.find((s) => rows[s.scheduleId]?.status !== 'success' && isOpen(s))?.scheduleId ?? null

  const dismissedKey = (scheduleId: string) => `checkin-modal-dismissed-${todayDateKey}-${scheduleId}`

  useEffect(() => {
    if (pendingId && !sessionStorage.getItem(dismissedKey(pendingId))) setModalFor(pendingId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingId])

  const handleDismissModal = () => {
    if (modalFor) sessionStorage.setItem(dismissedKey(modalFor), '1')
    setModalFor(null)
  }

  const handleAbsen = (scheduleId: string) => {
    if (!navigator.geolocation) {
      patchRow(scheduleId, { status: 'error', errorMsg: 'Browser tidak mendukung GPS.' })
      return
    }
    patchRow(scheduleId, { status: 'locating', errorMsg: null })
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setPermission('granted')
        patchRow(scheduleId, { status: 'sending' })
        try {
          const res = await fetch('/api/tutor-checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scheduleId,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            }),
          })
          const data = await res.json()
          if (data.isWithinRadius) {
            patchRow(scheduleId, {
              status: 'success',
              checkedInAt: data.checkedInAt,
              distanceM: data.distanceM,
            })
          } else {
            patchRow(scheduleId, {
              status: data.isWithinRadius === false ? 'outside' : 'error',
              errorMsg: data.message ?? data.error ?? 'Gagal absen.',
            })
          }
        } catch {
          patchRow(scheduleId, { status: 'error', errorMsg: 'Gagal menghubungi server.' })
        }
      },
      (err) => {
        let errorMsg = 'Gagal mendapatkan lokasi GPS.'
        if (err.code === 1) {
          errorMsg = DENIED_MSG
          setPermission('denied')
          setModalFor(scheduleId)
        } else if (err.code === 2) {
          errorMsg = 'GPS tidak tersedia. Pastikan Location/GPS aktif di pengaturan perangkat Anda.'
        } else if (err.code === 3) {
          errorMsg = 'GPS timeout. Pindah ke area lebih terbuka atau periksa sinyal, lalu coba lagi.'
        }
        patchRow(scheduleId, { status: 'error', errorMsg })
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  }

  const handleAbsenFromModal = () => {
    const scheduleId = modalFor
    setModalFor(null)
    if (scheduleId) handleAbsen(scheduleId)
  }

  const modalSchedule = schedules.find((s) => s.scheduleId === modalFor)

  return (
    <>
      {modalSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-5 flex items-start gap-3">
              <CalendarCheck className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">Absen: {modalSchedule.className}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {todayLabel} • {modalSchedule.startTime}–{modalSchedule.endTime}
                </p>
              </div>
              <button
                onClick={handleDismissModal}
                className="ml-auto p-1 rounded-full hover:bg-amber-100 text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
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
                  Kamu belum absen untuk sesi ini. Absen wajib dilakukan agar kehadiranmu tercatat dan laporan
                  sesi ini bisa ditulis.
                </p>
                {permission === 'prompt' && (
                  <p className="text-sm text-slate-600 leading-relaxed mt-2">
                    Absensi memakai lokasi GPS. Setelah menekan tombol di bawah, browser akan meminta izin lokasi —
                    pilih <span className="font-semibold">Izinkan</span>.
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  📍 Absensi hanya berlaku di lokasi bimbel (radius {CHECKIN_RADIUS_METERS}m dari titik absen).
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
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
        <div className="flex items-center gap-2 mb-0.5">
          <MapPin className="h-4 w-4 shrink-0 text-teal-600" />
          <p className="font-bold text-slate-800 text-sm">Absensi per Jadwal</p>
        </div>
        <p className="text-xs text-slate-500">{todayLabel} • absen sekali untuk tiap sesi</p>

        {schedules.length === 0 ? (
          <p className="text-sm text-slate-400 mt-2">Tidak ada jadwal mengajar hari ini.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {schedules.map((s) => {
              const row: RowState = rows[s.scheduleId] ?? {
                status: s.checkedInAt ? 'success' : 'idle',
                checkedInAt: s.checkedInAt,
                distanceM: s.distanceM,
                errorMsg: null,
              }
              const open = isOpen(s)
              const late =
                row.status === 'success' &&
                row.checkedInAt !== null &&
                new Date(row.checkedInAt).getTime() > new Date(s.startsAt).getTime()
              return (
                <div
                  key={s.scheduleId}
                  className={`rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                    row.status === 'success'
                      ? 'border-emerald-200'
                      : row.status === 'outside' || row.status === 'error'
                        ? 'border-rose-200'
                        : 'border-slate-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{s.className}</p>
                    <p className="text-xs text-slate-500">
                      {s.startTime}–{s.endTime}
                    </p>

                    {row.status === 'success' && row.checkedInAt && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <p className="text-sm font-semibold text-emerald-700">
                          Sudah absen pukul {formatTime(row.checkedInAt)}
                          {row.distanceM !== null && (
                            <span className="font-normal text-emerald-600"> ({row.distanceM}m dari lokasi)</span>
                          )}
                        </p>
                        {late && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            TERLAMBAT
                          </span>
                        )}
                      </div>
                    )}

                    {(row.status === 'outside' || row.status === 'error') && (
                      <div className="flex items-start gap-1.5 mt-1.5">
                        <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-rose-600">{row.errorMsg}</p>
                      </div>
                    )}

                    {(row.status === 'locating' || row.status === 'sending') && (
                      <p className="text-sm text-teal-600 mt-1 flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {row.status === 'locating' ? 'Mendeteksi lokasi GPS...' : 'Menyimpan absensi...'}
                      </p>
                    )}

                    {row.status === 'idle' && !open && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Absen dibuka pukul {formatTime(s.opensAt)}
                      </p>
                    )}
                  </div>

                  {open && (row.status === 'idle' || row.status === 'outside' || row.status === 'error') && (
                    <button
                      onClick={() => handleAbsen(s.scheduleId)}
                      className="shrink-0 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
                    >
                      <MapPin className="h-4 w-4" />
                      Absen Sekarang
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
