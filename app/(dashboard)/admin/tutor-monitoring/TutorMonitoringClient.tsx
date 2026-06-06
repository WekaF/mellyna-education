'use client'

import { useState } from 'react'
import { MapPin, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock } from 'lucide-react'

type CheckInRecord = {
  id: string
  date: string
  checkedInAt: string
  distanceM: number
  isWithinRadius: boolean
}

type TutorRow = {
  id: string
  name: string
  email: string
  suspended: boolean
  totalScheduleDays: number
  totalValidDays: number
  attendanceRate: number | null
  avgDistanceM: number | null
  lastCheckIn: string | null
  recentCheckIns: CheckInRecord[]
}

interface Props {
  initialData: TutorRow[]
}

function RateBadge({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-slate-400 text-sm">—</span>
  const cls =
    rate >= 80
      ? 'bg-emerald-100 text-emerald-700'
      : rate >= 50
        ? 'bg-amber-100 text-amber-700'
        : 'bg-rose-100 text-rose-600'
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{rate}%</span>
}

export default function TutorMonitoringClient({ initialData }: Props) {
  const [data] = useState<TutorRow[]>(initialData)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const filtered = data.filter(
    (t) =>
      t.name.toLowerCase().includes(filter.toLowerCase()) ||
      t.email.toLowerCase().includes(filter.toLowerCase()),
  )

  const totalTutors = data.length
  const activeTutors = data.filter((t) => !t.suspended).length
  const totalCheckInDays = data.reduce((s, t) => s + t.totalValidDays, 0)
  const avgRate =
    data.filter((t) => t.attendanceRate !== null).length > 0
      ? Math.round(
          data
            .filter((t) => t.attendanceRate !== null)
            .reduce((s, t) => s + t.attendanceRate!, 0) /
            data.filter((t) => t.attendanceRate !== null).length,
        )
      : null

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-teal-600 to-teal-800 p-8 text-white shadow-xl shadow-teal-600/10">
        <div className="flex items-center gap-3 mb-2">
          <MapPin className="h-7 w-7" />
          <h1 className="text-3xl font-extrabold tracking-tight">Monitoring Kehadiran Tutor</h1>
        </div>
        <p className="text-teal-100">
          Rekap absensi harian tutor bulan ini — satu absensi per hari per tutor.
          Radius wajib: 500m dari titik pusat bimbel.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {[
          { label: 'Total Tutor', value: totalTutors, sub: `${activeTutors} aktif` },
          { label: 'Hari Hadir (Bulan Ini)', value: totalCheckInDays, sub: 'total valid check-in' },
          {
            label: 'Rata-rata Kehadiran',
            value: avgRate !== null ? `${avgRate}%` : '—',
            sub: 'dari hari ada jadwal',
          },
          {
            label: 'Tutor Belum Absen',
            value: data.filter((t) => t.totalValidDays === 0).length,
            sub: 'bulan ini',
          },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-white border border-slate-100 shadow-xs p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
            <p className="text-2xl font-extrabold text-slate-800 mt-1">{card.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Cari nama atau email tutor..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 max-w-sm px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500"
        />
        <span className="text-sm text-slate-400">{filtered.length} tutor</span>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
            <p className="text-3xl">🔍</p>
            <p className="mt-2 text-sm">Tidak ada tutor yang cocok.</p>
          </div>
        ) : (
          filtered.map((tutor) => {
            const isExpanded = expandedId === tutor.id
            return (
              <div
                key={tutor.id}
                className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : tutor.id)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm shrink-0">
                      {tutor.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-800">{tutor.name}</p>
                        {tutor.suspended && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">
                            SUSPEND
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{tutor.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 sm:gap-8 shrink-0">
                    <div className="hidden sm:flex flex-col items-end gap-0.5">
                      <p className="text-xs text-slate-400">Hari Jadwal</p>
                      <p className="text-sm font-bold text-slate-700">{tutor.totalScheduleDays}</p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-0.5">
                      <p className="text-xs text-slate-400">Hari Hadir</p>
                      <p className="text-sm font-bold text-slate-700">
                        {tutor.totalValidDays}/{tutor.totalScheduleDays}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <p className="text-xs text-slate-400">Rate</p>
                      <RateBadge rate={tutor.attendanceRate} />
                    </div>
                    <div className="hidden md:flex flex-col items-end gap-0.5">
                      <p className="text-xs text-slate-400">Avg Jarak</p>
                      <p className="text-sm font-medium text-slate-600">
                        {tutor.avgDistanceM !== null ? `${tutor.avgDistanceM}m` : '—'}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    {tutor.recentCheckIns.length === 0 ? (
                      <div className="px-6 py-6 text-center text-sm text-slate-400">
                        Belum ada data absensi bulan ini.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        <div className="px-6 py-2.5 flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Riwayat Absensi Terbaru
                          </p>
                        </div>
                        {tutor.recentCheckIns.map((ci) => {
                          const dateLabel = new Date(`${ci.date}T00:00:00+07:00`).toLocaleDateString(
                            'id-ID',
                            { weekday: 'short', day: 'numeric', month: 'short' },
                          )
                          const timeLabel = new Date(ci.checkedInAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                          return (
                            <div
                              key={ci.id}
                              className="px-6 py-3 flex items-center justify-between gap-4"
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-700">{dateLabel}</p>
                                <p className="text-xs text-slate-400">Absen pukul {timeLabel}</p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs text-slate-500">{ci.distanceM}m</span>
                                {ci.isWithinRadius ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-rose-500" />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 flex items-start gap-3">
        <MapPin className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-teal-800">Titik Pusat Absensi</p>
          <p className="text-xs text-teal-600 mt-0.5">
            Koordinat: -7.041736, 113.558258 • Radius: 500 meter • 1 absensi per hari per tutor
          </p>
        </div>
      </div>
    </div>
  )
}
