'use client'

import { formatRupiah } from '@/lib/utils'
import { Users, BookOpen, Calendar, AlertCircle, TrendingUp, Activity } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts'

type Stats = {
  totalStudents: number
  totalClasses: number
  schedulesToday: number
  overdueCount: number
  revenueThisMonth: number
  attendanceRateThisMonth: number | null
}

type MonthRevenue = { month: string; revenue: number }
type InvoiceStatusItem = { status: string; count: number; amount: number }
type ProgramItem = { program: string; count: number }
type AttendanceWeek = { label: string; rate: number }
type InvoiceItem = {
  id: string
  studentName: string
  description: string
  amount: number
  dueDate: string
  isOverdue: boolean
}
type ScheduleItem = {
  id: string
  className: string
  tutorName: string
  startTime: string
  endTime: string
  topic: string | null
  status: string
}

type Props = {
  stats: Stats
  revenueByMonth: MonthRevenue[]
  invoiceDistribution: InvoiceStatusItem[]
  programDistribution: ProgramItem[]
  attendanceTrend: AttendanceWeek[]
  invoicesNeedingAttention: InvoiceItem[]
  todaySchedules: ScheduleItem[]
}

const INVOICE_COLORS: Record<string, string> = {
  Lunas: '#10b981',
  Pending: '#f59e0b',
  Terlambat: '#ef4444',
  Dibatalkan: '#94a3b8',
}

const PROGRAM_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316',
]

const SCHEDULE_STATUS: Record<string, { label: string; cls: string }> = {
  PUBLISHED: { label: 'Aktif', cls: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Selesai', cls: 'bg-emerald-100 text-emerald-700' },
  DRAFT: { label: 'Draft', cls: 'bg-slate-100 text-slate-600' },
  CANCELLED: { label: 'Batal', cls: 'bg-rose-100 text-rose-600' },
}

function shortCurrency(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}rb`
  return String(value)
}

export default function DashboardClient({
  stats,
  revenueByMonth,
  invoiceDistribution,
  programDistribution,
  attendanceTrend,
  invoicesNeedingAttention,
  todaySchedules,
}: Props) {
  const statCards = [
    {
      label: 'Siswa Aktif',
      value: stats.totalStudents,
      icon: Users,
      bg: 'bg-indigo-50',
      text: 'text-indigo-600',
    },
    {
      label: 'Total Kelas',
      value: stats.totalClasses,
      icon: BookOpen,
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
    },
    {
      label: 'Jadwal Hari Ini',
      value: stats.schedulesToday,
      icon: Calendar,
      bg: 'bg-amber-50',
      text: 'text-amber-600',
    },
    {
      label: 'Tagihan Terlambat',
      value: stats.overdueCount,
      icon: AlertCircle,
      bg: 'bg-rose-50',
      text: 'text-rose-600',
    },
    {
      label: 'Pendapatan Bulan Ini',
      value: formatRupiah(stats.revenueThisMonth),
      icon: TrendingUp,
      bg: 'bg-green-50',
      text: 'text-green-600',
    },
    {
      label: 'Kehadiran Bulan Ini',
      value: stats.attendanceRateThisMonth !== null ? `${stats.attendanceRateThisMonth}%` : '—',
      icon: Activity,
      bg: 'bg-sky-50',
      text: 'text-sky-600',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-indigo-600 to-indigo-800 p-5 sm:p-8 text-white shadow-xl shadow-indigo-600/10">
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">Dashboard Admin 👋</h1>
        <p className="mt-2 text-sm sm:text-base text-indigo-100">
          Selamat datang! Berikut ringkasan operasional Mellyna Education hari ini.
        </p>
      </div>

      {/* 6 Stats Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {statCards.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.label}
              className="rounded-2xl bg-white p-4 shadow-xs border border-slate-100 flex items-center gap-3"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
                <Icon className={`h-5 w-5 ${s.text}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 truncate leading-tight">
                  {s.label}
                </p>
                <p className="mt-0.5 text-xl font-extrabold text-slate-800 truncate">{s.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts Row 1: Revenue + Invoice Status Donut */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6">
          <h2 className="font-bold text-slate-800 mb-4">📈 Pendapatan 6 Bulan Terakhir</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueByMonth} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={shortCurrency} tick={{ fontSize: 11 }} width={40} />
              <Tooltip
                formatter={(value) => [formatRupiah(Number(value)), 'Pendapatan']}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6">
          <h2 className="font-bold text-slate-800 mb-4">💰 Status Tagihan (Semua)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={invoiceDistribution}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
              >
                {invoiceDistribution.map((entry) => (
                  <Cell key={entry.status} fill={INVOICE_COLORS[entry.status] ?? '#94a3b8'} />
                ))}
              </Pie>
              <Legend formatter={(v) => <span style={{ fontSize: 12 }}>{v}</span>} />
              <Tooltip
                formatter={(value, _name, entry) => [
                  `${value} tagihan · ${formatRupiah((entry.payload as { amount?: number })?.amount ?? 0)}`,
                  (entry.payload as { status?: string })?.status ?? '',
                ]}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: Program Distribution + Attendance Trend */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6">
          <h2 className="font-bold text-slate-800 mb-4">🎓 Distribusi Siswa per Program</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={programDistribution}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="program" tick={{ fontSize: 12 }} width={80} />
              <Tooltip
                formatter={(value) => [`${value} siswa`, 'Jumlah']}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {programDistribution.map((entry, i) => (
                  <Cell key={entry.program} fill={PROGRAM_COLORS[i % PROGRAM_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6">
          <h2 className="font-bold text-slate-800 mb-4">📊 Tren Kehadiran (8 Minggu)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={attendanceTrend} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={40} />
              <Tooltip
                formatter={(value) => [`${value}%`, 'Kehadiran']}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#attendGrad)"
                dot={{ fill: '#6366f1', r: 4 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row: Today's Schedules + Invoices Needing Attention */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Schedules */}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-800">🗓️ Jadwal Hari Ini</h2>
            <a href="/admin/schedules" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
              Lihat Semua →
            </a>
          </div>
          {todaySchedules.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <p className="text-3xl">📅</p>
              <p className="mt-2 font-medium text-sm">Tidak ada jadwal hari ini.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {todaySchedules.map((s) => {
                const cfg = SCHEDULE_STATUS[s.status] ?? { label: s.status, cls: 'bg-slate-100 text-slate-600' }
                return (
                  <div key={s.id} className="flex items-start justify-between px-6 py-3 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-slate-800 truncate">{s.className}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {s.tutorName}
                        {s.topic ? ` — ${s.topic}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <span className="text-xs font-medium text-slate-600">
                        {s.startTime}–{s.endTime}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Invoices Needing Attention */}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-800">💳 Tagihan Perlu Perhatian</h2>
            <a href="/admin/billing" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
              Lihat Semua →
            </a>
          </div>
          {invoicesNeedingAttention.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <p className="text-3xl">🎉</p>
              <p className="mt-2 font-medium text-sm">Semua tagihan sudah lunas!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {invoicesNeedingAttention.map((inv) => (
                <div key={inv.id} className="flex items-start justify-between px-6 py-3 gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-slate-800 truncate">{inv.studentName}</p>
                      {inv.isOverdue && (
                        <span className="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-600">
                          TERLAMBAT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{inv.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm text-slate-800">{formatRupiah(inv.amount)}</p>
                    <p className={`text-xs ${inv.isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
                      {new Date(inv.dueDate).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
