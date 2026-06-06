'use client'

import { useMemo, useState } from 'react'
import { exportToExcel, exportToPDF } from '@/lib/export'
import { Download } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/common/DataTable'

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

interface Props {
  initialAttendance: AttendanceStat[]
  initialTutors: TutorStat[]
  initialStudents: StudentStat[]
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

export default function AnalyticsClient({ initialAttendance, initialTutors, initialStudents }: Props) {
  const [tab, setTab] = useState<Tab>('attendance')

  const tabs: { key: Tab; label: string; emoji: string }[] = [
    { key: 'attendance', label: 'Absensi Siswa', emoji: '📋' },
    { key: 'tutors', label: 'Performa Tutor', emoji: '👩‍🏫' },
    { key: 'students', label: 'Progress Siswa', emoji: '📈' },
  ]

  const trendIcon = (t: StudentStat['trend']) =>
    t === 'up' ? '📈' : t === 'down' ? '📉' : t === 'stable' ? '➡️' : '—'

  const attendanceColumns = useMemo<ColumnDef<AttendanceStat>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Siswa',
      cell: ({ getValue }) => <span className="font-semibold text-slate-800">{getValue() as string}</span>,
    },
    {
      accessorKey: 'grade',
      header: 'Kelas',
      cell: ({ getValue }) => <span className="text-slate-500">{(getValue() as string | null) || '—'}</span>,
    },
    { accessorKey: 'total', header: 'Total Sesi', cell: ({ getValue }) => <span className="text-slate-600">{getValue() as number}</span> },
    { accessorKey: 'present', header: 'Hadir', cell: ({ getValue }) => <span className="text-emerald-600 font-semibold">{getValue() as number}</span> },
    { accessorKey: 'absent', header: 'Alpha', cell: ({ getValue }) => <span className="text-rose-500 font-semibold">{getValue() as number}</span> },
    { accessorKey: 'sick', header: 'Sakit', cell: ({ getValue }) => <span className="text-amber-500">{getValue() as number}</span> },
    { accessorKey: 'permission', header: 'Izin', cell: ({ getValue }) => <span className="text-blue-500">{getValue() as number}</span> },
    {
      accessorKey: 'rate',
      header: 'Kehadiran',
      cell: ({ getValue }) => <div className="w-36"><RateBar value={getValue() as number | null} /></div>,
    },
  ], [])

  const tutorColumns = useMemo<ColumnDef<TutorStat>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Tutor',
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-slate-800">{row.original.name}</p>
          <p className="text-xs text-slate-400">{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: 'suspended',
      header: 'Status',
      cell: ({ getValue }) => (getValue() as boolean)
        ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">Ditangguhkan</span>
        : <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Aktif</span>,
    },
    { accessorKey: 'totalSchedules', header: 'Total Jadwal', cell: ({ getValue }) => <span className="text-slate-600">{getValue() as number}</span> },
    { accessorKey: 'completedSchedules', header: 'Selesai', cell: ({ getValue }) => <span className="text-slate-600">{getValue() as number}</span> },
    {
      accessorKey: 'reportsFilled',
      header: 'Laporan Terisi',
      cell: ({ row }) => <span className="text-slate-600">{row.original.reportsFilled} / {row.original.totalSchedules}</span>,
    },
    {
      accessorKey: 'reportRate',
      header: 'Rate Laporan',
      cell: ({ getValue }) => <div className="w-32"><RateBar value={getValue() as number | null} /></div>,
    },
    {
      accessorKey: 'avgAttendanceRate',
      header: 'Kehadiran Siswa',
      cell: ({ getValue }) => <div className="w-32"><RateBar value={getValue() as number | null} /></div>,
    },
  ], [])

  const studentColumns = useMemo<ColumnDef<StudentStat>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Siswa',
      cell: ({ row }) => (
        <span className={`font-semibold text-slate-800 ${!row.original.isActive ? 'opacity-50' : ''}`}>
          {row.original.name}
        </span>
      ),
    },
    {
      accessorKey: 'grade',
      header: 'Kelas',
      cell: ({ getValue }) => <span className="text-slate-500">{(getValue() as string | null) || '—'}</span>,
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ getValue }) => (getValue() as boolean)
        ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Aktif</span>
        : <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Nonaktif</span>,
    },
    { accessorKey: 'totalReports', header: 'Laporan', cell: ({ getValue }) => <span className="text-slate-600">{getValue() as number}</span> },
    {
      accessorKey: 'avgScore',
      header: 'Nilai Rata-Rata',
      cell: ({ getValue }) => <span className="font-semibold text-indigo-600">{(getValue() as number | null) ?? '—'}</span>,
    },
    {
      accessorKey: 'lastScore',
      header: 'Nilai Terakhir',
      cell: ({ getValue }) => <span className="text-slate-600">{(getValue() as number | null) ?? '—'}</span>,
    },
    {
      accessorKey: 'trend',
      header: 'Tren',
      cell: ({ getValue }) => <span className="text-lg">{trendIcon(getValue() as StudentStat['trend'])}</span>,
    },
    {
      accessorKey: 'attendanceRate',
      header: 'Kehadiran',
      cell: ({ getValue }) => <div className="w-32"><RateBar value={getValue() as number | null} /></div>,
    },
    {
      accessorKey: 'lastActivity',
      header: 'Aktivitas Terakhir',
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return (
          <span className="text-slate-400 text-xs whitespace-nowrap">
            {v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
          </span>
        )
      },
    },
  ], [trendIcon])

  const handleExportAttendance = (format: 'excel' | 'pdf') => {
    const rows = initialAttendance.map((s) => ({
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
        initialAttendance.map((s) => [s.name, s.grade ?? '—', s.total, s.present, s.absent, s.sick, s.permission, s.rate !== null ? `${s.rate}%` : '—']),
        'laporan-absensi-siswa',
        'Laporan Absensi Siswa — Mellyna Education'
      )
    }
  }

  const handleExportTutors = (format: 'excel' | 'pdf') => {
    const rows = initialTutors.map((t) => ({
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
        initialTutors.map((t) => [t.name, t.suspended ? 'Ditangguhkan' : 'Aktif', t.totalSchedules, t.completedSchedules, t.reportsFilled, t.reportRate !== null ? `${t.reportRate}%` : '—', t.avgAttendanceRate !== null ? `${t.avgAttendanceRate}%` : '—']),
        'laporan-performa-tutor',
        'Laporan Performa Tutor — Mellyna Education'
      )
    }
  }

  const handleExportStudents = (format: 'excel' | 'pdf') => {
    const rows = initialStudents.map((s) => ({
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
        initialStudents.map((s) => [s.name, s.grade ?? '—', s.isActive ? 'Aktif' : 'Nonaktif', s.totalReports, s.avgScore ?? '—', s.lastScore ?? '—', s.trend === 'up' ? 'Meningkat' : s.trend === 'down' ? 'Menurun' : s.trend === 'stable' ? 'Stabil' : '—', s.attendanceRate !== null ? `${s.attendanceRate}%` : '—']),
        'laporan-progress-siswa',
        'Laporan Progress Siswa — Mellyna Education'
      )
    }
  }

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
            onClick={() => setTab(t.key)}
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

      {tab === 'attendance' && (
        <div className="space-y-3">
          {initialAttendance.length > 0 && (
            <div className="flex justify-end gap-2">
              <button onClick={() => handleExportAttendance('excel')} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer border border-emerald-200 transition-colors">
                <Download className="h-3.5 w-3.5" /> Excel
              </button>
              <button onClick={() => handleExportAttendance('pdf')} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer border border-rose-200 transition-colors">
                <Download className="h-3.5 w-3.5" /> PDF
              </button>
            </div>
          )}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
            <DataTable
              columns={attendanceColumns}
              data={initialAttendance}
              searchPlaceholder="Cari nama siswa..."
              emptyMessage="Belum ada data absensi."
              emptyIcon="📋"
            />
          </div>
        </div>
      )}

      {tab === 'tutors' && (
        <div className="space-y-3">
          {initialTutors.length > 0 && (
            <div className="flex justify-end gap-2">
              <button onClick={() => handleExportTutors('excel')} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer border border-emerald-200 transition-colors">
                <Download className="h-3.5 w-3.5" /> Excel
              </button>
              <button onClick={() => handleExportTutors('pdf')} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer border border-rose-200 transition-colors">
                <Download className="h-3.5 w-3.5" /> PDF
              </button>
            </div>
          )}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
            <DataTable
              columns={tutorColumns}
              data={initialTutors}
              searchPlaceholder="Cari nama tutor..."
              emptyMessage="Belum ada data tutor."
              emptyIcon="👩‍🏫"
            />
          </div>
        </div>
      )}

      {tab === 'students' && (
        <div className="space-y-3">
          {initialStudents.length > 0 && (
            <div className="flex justify-end gap-2">
              <button onClick={() => handleExportStudents('excel')} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer border border-emerald-200 transition-colors">
                <Download className="h-3.5 w-3.5" /> Excel
              </button>
              <button onClick={() => handleExportStudents('pdf')} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer border border-rose-200 transition-colors">
                <Download className="h-3.5 w-3.5" /> PDF
              </button>
            </div>
          )}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
            <DataTable
              columns={studentColumns}
              data={initialStudents}
              searchPlaceholder="Cari nama siswa..."
              emptyMessage="Belum ada data siswa."
              emptyIcon="📈"
            />
          </div>
        </div>
      )}
    </div>
  )
}
