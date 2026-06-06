'use client'

import { useState } from 'react'
import { MapPin, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

interface Props {
  todayLabel: string
  initialCheckedIn: boolean
  initialCheckedInAt?: string
  initialDistanceM?: number
  hasScheduleToday: boolean
}

type Status = 'idle' | 'locating' | 'sending' | 'success' | 'outside' | 'error' | 'no-schedule'

export function TutorDailyCheckIn({
  todayLabel,
  initialCheckedIn,
  initialCheckedInAt,
  initialDistanceM,
  hasScheduleToday,
}: Props) {
  const [status, setStatus] = useState<Status>(
    initialCheckedIn ? 'success' : !hasScheduleToday ? 'no-schedule' : 'idle',
  )
  const [checkedInAt, setCheckedInAt] = useState<string | null>(initialCheckedInAt ?? null)
  const [distanceM, setDistanceM] = useState<number | null>(initialDistanceM ?? null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

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
        setErrorMsg(`Gagal mendapatkan GPS: ${err.message}`)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  }

  const checkedInTime = checkedInAt
    ? new Date(checkedInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
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

        {status === 'outside' && (
          <div className="flex items-start gap-1.5 mt-1.5">
            <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-600">{errorMsg}</p>
          </div>
        )}

        {status === 'error' && (
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
          className="shrink-0 flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
        >
          <MapPin className="h-4 w-4" />
          Absen Sekarang
        </button>
      )}
    </div>
  )
}
