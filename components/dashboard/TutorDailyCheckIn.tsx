'use client'

import { useEffect, useState } from 'react'
import { MapPin, CheckCircle2, AlertTriangle, Loader2, Clock } from 'lucide-react'
import { getLocationPermission, type LocationPermission } from '@/lib/location-permission'

const DENIED_MSG = 'Izin lokasi diblokir. Buka izin lokasi untuk situs ini, lalu tekan "Coba Lagi".'

interface Props {
  todayLabel: string
  opensAt: string
  checkedInAt: string | null
  distanceM: number | null
  radiusM: number
}

type Status = 'idle' | 'locating' | 'sending' | 'success' | 'outside' | 'error'

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })

export function TutorDailyCheckIn({ todayLabel, opensAt, checkedInAt, distanceM, radiusM }: Props) {
  const [status, setStatus] = useState<Status>(checkedInAt ? 'success' : 'idle')
  const [checkedAt, setCheckedAt] = useState(checkedInAt)
  const [distance, setDistance] = useState(distanceM)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // null saat render server supaya tidak hydration mismatch; diisi di client.
  const [now, setNow] = useState<number | null>(null)
  const [permission, setPermission] = useState<LocationPermission | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    getLocationPermission().then((p) => {
      if (!cancelled) setPermission(p)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const open = now !== null && now >= new Date(opensAt).getTime()
  const late = status === 'success' && checkedAt !== null && new Date(checkedAt).getTime() > new Date(opensAt).getTime()

  const handleAbsen = () => {
    if (!navigator.geolocation) {
      setStatus('error')
      setErrorMsg('Browser tidak mendukung GPS.')
      return
    }
    setStatus('locating')
    setErrorMsg(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setPermission('granted')
        setStatus('sending')
        try {
          const res = await fetch('/api/tutor-checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            }),
          })
          const data = await res.json()
          if (data.isWithinRadius) {
            setStatus('success')
            setCheckedAt(data.checkedInAt)
            setDistance(data.distanceM)
          } else {
            setStatus(data.isWithinRadius === false ? 'outside' : 'error')
            setErrorMsg(data.message ?? data.error ?? 'Gagal absen.')
          }
        } catch {
          setStatus('error')
          setErrorMsg('Gagal menghubungi server.')
        }
      },
      (err) => {
        let msg = 'Gagal mendapatkan lokasi GPS.'
        if (err.code === 1) {
          msg = DENIED_MSG
          setPermission('denied')
        } else if (err.code === 2) {
          msg = 'GPS tidak tersedia. Pastikan Location/GPS aktif di pengaturan perangkat Anda.'
        } else if (err.code === 3) {
          msg = 'GPS timeout. Pindah ke area lebih terbuka atau periksa sinyal, lalu coba lagi.'
        }
        setStatus('error')
        setErrorMsg(msg)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  }

  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
      <div className="flex items-center gap-2 mb-0.5">
        <MapPin className="h-4 w-4 shrink-0 text-teal-600" />
        <p className="font-bold text-slate-800 text-sm">Absensi Harian</p>
      </div>
      <p className="text-xs text-slate-500">{todayLabel} • absen sekali, pukul 15:00</p>

      <div
        className={`mt-3 rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
          status === 'success'
            ? 'border-emerald-200'
            : status === 'outside' || status === 'error'
              ? 'border-rose-200'
              : 'border-slate-200'
        }`}
      >
        <div className="flex-1 min-w-0">
          {status === 'success' && checkedAt && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm font-semibold text-emerald-700">
                Sudah absen pukul {formatTime(checkedAt)}
                {distance !== null && <span className="font-normal text-emerald-600"> ({distance}m dari lokasi)</span>}
              </p>
              {late && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  TERLAMBAT
                </span>
              )}
            </div>
          )}

          {(status === 'outside' || status === 'error') && (
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-600">{errorMsg}</p>
            </div>
          )}

          {(status === 'locating' || status === 'sending') && (
            <p className="text-sm text-teal-600 flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {status === 'locating' ? 'Mendeteksi lokasi GPS...' : 'Menyimpan absensi...'}
            </p>
          )}

          {status === 'idle' && !open && (
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Absen dibuka pukul {formatTime(opensAt)}
            </p>
          )}

          {status === 'idle' && open && (
            <p className="text-xs text-slate-400">📍 Radius absen {radiusM}m dari titik absen.</p>
          )}

          {permission === 'denied' && status !== 'success' && (
            <p className="text-xs text-rose-500 mt-1">Izin lokasi diblokir — buka izin lokasi lalu coba lagi.</p>
          )}
        </div>

        {open && (status === 'idle' || status === 'outside' || status === 'error') && (
          <button
            onClick={handleAbsen}
            className="shrink-0 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <MapPin className="h-4 w-4" />
            Absen Sekarang
          </button>
        )}
      </div>
    </div>
  )
}
