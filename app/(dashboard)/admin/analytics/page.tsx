'use client'

import { useState, useEffect, useCallback } from 'react'
import { exportToExcel, exportToPDF } from '@/lib/export'
import { Download } from 'lucide-react'

type Tab = 'attendance' | 'tutors' | 'students'

interface AttendanceStat {
  id: string; name: string; grade: string | null
  total: number; present: number; absent: number; sick: number; permission: number; rate: number | null
}

interface TutorStat {
  id: string; name: string; email: string; suspended: boolean
  totalSchedules: number; completedSchedules: number; reportsFilled: number
  reportRate: number | null; avgAttendanceRate: number | null
}

interface StudentStat {
  id: string; name: string; grade: string | null; isActive: boolean
  totalReports: number; avgScore: number | null; lastScore: number | null
  lastActivity: string | null; attendanceRate: number | null; trend: 'up' | 'down' | 'stable' | null
}

const RateBar = ({ value }: { value: number | null }) => {
  if (value === null) return <span className="text-slate-400 text-xs">—</span>
  const color = value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-700 w-8 text-right">{value}%</span>
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const [tab, setTab] = useState<Tab>('attendance')
  const [attendance, setAttendance] = useState<AttendanceStat[]>([])
  const [tutors, setTutors] = useState<TutorStat[]>([])
  const [students, setStudents] = useState<StudentStat[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async (t: Tab) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/analytics/${t}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (t === 'attendance') setAttendance(data)
      else if (t === 'tutors') setTutors(data)
      else setStudents(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(tab) }, [tab, fetchData])

  const handleExportAttendance = (format: 'excel' | 'pdf') => {
    const rows = filteredAttendance.map((s) => ({
      'Nama Siswa': s.name,
      'Kelas': s.grade ?? '—',
      'Total Sesi': s.total,
      'Hadir': s.present,
      'Alpha': s.absent,
      'Sakit': s.sick,
      'Izin': s.permission,
      'Kehadiran (%)': s.rate ?? '—',
    }))
    if (format === 'excel') {
      exportToExcel(rows, 'laporan-absensi-siswa', 'Absensi')
    } else {
      exportToPDF(
        ['Nama Siswa', 'Kelas', 'Total', 'Hadir', 'Alpha', 'Sakit', 'Izin', 'Kehadiran %'],
        filteredAttendance.map((s) => [s.name, s.grade ?? '—', s.total, s.present, s.absent, s.sick, s.permission, s.rate !== null ? `${s.rate}%` : '—']),
        'laporan-absensi-siswa',
        'Laporan Absensi Siswa — Mellyna Education'
      )
    }
  }

  const handleExportTutors = (format: 'excel' | 'pdf') => {
    const rows = filteredTutors.map((t) => ({
      'Tutor': t.name,
      'Email': t.email,
      'Status': t.suspended ? 'Ditangguhkan' : 'Aktif',
      'Total Jadwal': t.totalSchedules,
      'Jadwal Selesai': t.completedSchedules,
      'Laporan Terisi': t.reportsFilled,
      'Rate Laporan (%)': t.reportRate ?? '—',
      'Kehadiran Siswa (%)': t.avgAttendanceRate ?? '—',
    }))
    if (format === 'excel') {
      exportToExcel(rows, 'laporan-performa-tutor', 'Performa Tutor')
    } else {
      exportToPDF(
        ['Tutor', 'Status', 'Jadwal', 'Selesai', 'Laporan', 'Rate Laporan %', 'Kehadiran %'],
        filteredTutors.map((t) => [t.name, t.suspended ? 'Ditangguhkan' : 'Aktif', t.totalSchedules, t.completedSchedules, t.reportsFilled, t.reportRate !== null ? `${t.reportRate}%` : '—', t.avgAttendanceRate !== null ? `${t.avgAttendanceRate}%` : '—']),
        'laporan-performa-tutor',
        'Laporan Performa Tutor — Mellyna Education'
      )
    }
  }

  const handleExportStudents = (format: 'excel' | 'pdf') => {
    const rows = filteredStudents.map((s) => ({
      'Nama Siswa': s.name,
      'Kelas': s.grade ?? '—',
      'Status': s.isActive ? 'Aktif' : 'Nonaktif',
      'Total Laporan': s.totalReports,
      'Nilai Rata-Rata': s.avgScore ?? '—',
      'Nilai Terakhir': s.lastScore ?? '—',
      'Tren': s.trend === 'up' ? 'Meningkat' : s.trend === 'down' ? 'Menurun' : s.trend === 'stable' ? 'Stabil' : '—',
      'Kehadiran (%)': s.attendanceRate ?? '—',
      'Aktivitas Terakhir': s.lastActivity ? new Date(s.lastActivity).toLocaleDateString('id-ID') : '—',
    }))
    if (format === 'excel') {
      exportToExcel(rows, 'laporan-progress-siswa', 'Progress Siswa')
    } else {
      exportToPDF(
        ['Nama', 'Kelas', 'Status', 'Laporan', 'Avg Nilai', 'Nilai Terakhir', 'Tren', 'Kehadiran %'],
        filteredStudents.map((s) => [s.name, s.grade ?? '—', s.isActive ? 'Aktif' : 'Nonaktif', s.totalReports, s.avgScore ?? '—', s.lastScore ?? '—', s.trend === 'up' ? 'Meningkat' : s.trend === 'down' ? 'Menurun' : s.trend === 'stable' ? 'Stabil' : '—', s.attendanceRate !== null ? `${s.attendanceRate}%` : '—']),
        'laporan-progress-siswa',
        'Laporan Progress Siswa — Mellyna Education'
      )
    }
  }

  const tabs: { key: Tab; label: string; emoji: string }[] = [
    { key: 'attendance', label: 'Absensi Siswa', emoji: '📋' },
    { key: 'tutors', label: 'Performa Tutor', emoji: '👩‍🏫' },
    { key: 'students', label: 'Progress Siswa', emoji: '📈' },
  ]

  const trendIcon = (t: StudentStat['trend']) =>
    t === 'up' ? '📈' : t === 'down' ? '📉' : t === 'stable' ? '➡️' : '—'

  const filteredAttendance = attendance.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
  const filteredTutors = tutors.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
  const filteredStudents = students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">📊 Analitik</h1>
        <p className="text-sm text-slate-500 mt-0.5">Ringkasan performa tutor, absensi, dan perkembangan siswa.</p>
      </div>

      <div className="flex border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch('') }}
            className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              tab === t.key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Cari nama..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-xs px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
      />

      {loading ? (
        <div className="p-10 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
        </div>
      ) : (
        <>
          {tab === 'attendance' && !loading && filteredAttendance.length > 0 && (
            <div className="flex justify-end gap-2">
              <button onClick={() => handleExportAttendance('excel')} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer border border-emerald-200 transition-colors">
                <Download className="h-3.5 w-3.5" /> Excel
              </button>
              <button onClick={() => handleExportAttendance('pdf')} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer border border-rose-200 transition-colors">
                <Download className="h-3.5 w-3.5" /> PDF
              </button>
            </div>
          )}

          {tab === 'attendance' && (
            <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      {['Siswa', 'Kelas', 'Total Sesi', 'Hadir', 'Alpha', 'Sakit', 'Izin', 'Kehadiran'].map((h) => (
                        <th key={h} className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAttendance.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-10 text-slate-400">Belum ada data absensi.</td></tr>
                    ) : filteredAttendance.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3.5 font-semibold text-slate-800">{s.name}</td>
                        <td className="px-5 py-3.5 text-slate-500">{s.grade || '—'}</td>
                        <td className="px-5 py-3.5 text-slate-600">{s.total}</td>
                        <td className="px-5 py-3.5 text-emerald-600 font-semibold">{s.present}</td>
                        <td className="px-5 py-3.5 text-rose-500 font-semibold">{s.absent}</td>
                        <td className="px-5 py-3.5 text-amber-500">{s.sick}</td>
                        <td className="px-5 py-3.5 text-blue-500">{s.permission}</td>
                        <td className="px-5 py-3.5 w-36"><RateBar value={s.rate} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'tutors' && !loading && filteredTutors.length > 0 && (
            <div className="flex justify-end gap-2">
              <button onClick={() => handleExportTutors('excel')} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer border border-emerald-200 transition-colors">
                <Download className="h-3.5 w-3.5" /> Excel
              </button>
              <button onClick={() => handleExportTutors('pdf')} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer border border-rose-200 transition-colors">
                <Download className="h-3.5 w-3.5" /> PDF
              </button>
            </div>
          )}

          {tab === 'tutors' && (
            <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      {['Tutor', 'Status', 'Total Jadwal', 'Selesai', 'Laporan Terisi', 'Rate Laporan', 'Kehadiran Siswa'].map((h) => (
                        <th key={h} className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTutors.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-10 text-slate-400">Belum ada data tutor.</td></tr>
                    ) : filteredTutors.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-slate-800">{t.name}</p>
                          <p className="text-xs text-slate-400">{t.email}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          {t.suspended
                            ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">Ditangguhkan</span>
                            : <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Aktif</span>}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{t.totalSchedules}</td>
                        <td className="px-5 py-3.5 text-slate-600">{t.completedSchedules}</td>
                        <td className="px-5 py-3.5 text-slate-600">{t.reportsFilled} / {t.totalSchedules}</td>
                        <td className="px-5 py-3.5 w-32"><RateBar value={t.reportRate} /></td>
                        <td className="px-5 py-3.5 w-32"><RateBar value={t.avgAttendanceRate} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'students' && !loading && filteredStudents.length > 0 && (
            <div className="flex justify-end gap-2">
              <button onClick={() => handleExportStudents('excel')} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer border border-emerald-200 transition-colors">
                <Download className="h-3.5 w-3.5" /> Excel
              </button>
              <button onClick={() => handleExportStudents('pdf')} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer border border-rose-200 transition-colors">
                <Download className="h-3.5 w-3.5" /> PDF
              </button>
            </div>
          )}

          {tab === 'students' && (
            <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      {['Siswa', 'Kelas', 'Status', 'Laporan', 'Nilai Rata-Rata', 'Nilai Terakhir', 'Tren', 'Kehadiran', 'Aktivitas Terakhir'].map((h) => (
                        <th key={h} className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-10 text-slate-400">Belum ada data siswa.</td></tr>
                    ) : filteredStudents.map((s) => (
                      <tr key={s.id} className={`hover:bg-slate-50/50 ${!s.isActive ? 'opacity-50' : ''}`}>
                        <td className="px-5 py-3.5 font-semibold text-slate-800">{s.name}</td>
                        <td className="px-5 py-3.5 text-slate-500">{s.grade || '—'}</td>
                        <td className="px-5 py-3.5">
                          {s.isActive
                            ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Aktif</span>
                            : <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Nonaktif</span>}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{s.totalReports}</td>
                        <td className="px-5 py-3.5 font-semibold text-indigo-600">{s.avgScore ?? '—'}</td>
                        <td className="px-5 py-3.5 text-slate-600">{s.lastScore ?? '—'}</td>
                        <td className="px-5 py-3.5 text-lg">{trendIcon(s.trend)}</td>
                        <td className="px-5 py-3.5 w-32"><RateBar value={s.attendanceRate} /></td>
                        <td className="px-5 py-3.5 text-slate-400 text-xs whitespace-nowrap">
                          {s.lastActivity ? new Date(s.lastActivity).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
