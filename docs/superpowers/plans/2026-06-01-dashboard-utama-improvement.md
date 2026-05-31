# Dashboard Admin - Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the admin dashboard from a basic 4-card + invoice list into a full bimbel analytics hub: 6 KPI cards, revenue trend bar chart, invoice status donut chart, program distribution horizontal bar chart, attendance trend area chart, enriched today-schedule list, and invoices-needing-attention list.

**Architecture:** `page.tsx` (Server Component) runs all Prisma queries at request time and passes serialized plain objects as props to `DashboardClient.tsx` (Client Component), which renders Recharts visualizations. No new API routes needed.

**Tech Stack:** Next.js 15, Recharts (new dep), Prisma, Tailwind CSS, TypeScript, date-fns (already in deps)

---

## Dashboard Layout After Improvement

```
┌─────────────────────────────────────────────────────────────────────┐
│  Header gradient (unchanged)                                         │
├────────┬────────┬────────┬──────────────┬──────────────┬────────────┤
│ Siswa  │ Kelas  │ Jadwal │ Tagihan      │ Pendapatan   │ Kehadiran  │
│ Aktif  │ Total  │ Hari   │ Terlambat    │ Bulan Ini    │ Bulan Ini  │
│        │        │ Ini    │              │              │ %          │
├────────┴────────┴────────┴──────────────┴──────────────┴────────────┤
│  📈 Pendapatan 6 Bulan (Bar)    │  💰 Status Tagihan (Donut)        │
├─────────────────────────────────┼───────────────────────────────────┤
│  🎓 Distribusi per Program      │  📊 Tren Kehadiran 8 Minggu (Area) │
│  (Horizontal Bar)               │                                    │
├─────────────────────────────────┼───────────────────────────────────┤
│  🗓️ Jadwal Hari Ini             │  💳 Tagihan Perlu Perhatian        │
│  (with tutor name + status)     │  (overdue first, then pending)     │
└─────────────────────────────────┴───────────────────────────────────┘
```

## Suggested Dashboard Widgets (Saran Tampilan)

| # | Widget | Data Source | Value |
|---|--------|-------------|-------|
| 1 | Siswa Aktif | `Student.isActive` | Jumlah siswa aktif terdaftar |
| 2 | Total Kelas | `Class` | Semua kelas berjalan |
| 3 | Jadwal Hari Ini | `Schedule.date = today` | Berapa sesi hari ini |
| 4 | Tagihan Terlambat | `Invoice.status = OVERDUE` | Perlu follow-up |
| 5 | Pendapatan Bulan Ini | Paid invoices this month | Revenue realisasi |
| 6 | Tingkat Kehadiran Bulan Ini | Attendance this month | Health metric |
| 7 | Revenue Trend Bar Chart | Paid invoices last 6 months | Trend pertumbuhan |
| 8 | Invoice Status Donut | All invoices grouped by status | Collection health |
| 9 | Program Distribution Bar | Enrollments per program | Mana program terpopuler |
| 10 | Attendance Trend Area | Weekly rate last 8 weeks | Apakah kehadiran naik/turun |
| 11 | Jadwal Hari Ini List | Schedule + class + tutor | Siapa mengajar apa hari ini |
| 12 | Invoices Perlu Perhatian | Overdue + Pending (top 4+4) | Quick triage tagihan |

---

## File Structure

- **Modify:** `app/(dashboard)/admin/page.tsx` — replace with enhanced server queries + pass props to DashboardClient
- **Create:** `app/(dashboard)/admin/DashboardClient.tsx` — new client component, renders all charts + lists

---

## Task 1: Install Recharts

**Files:**
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Install recharts**

```bash
pnpm add recharts
```

- [ ] **Step 2: Verify installation**

Check `package.json` — `recharts` should appear in `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add recharts for dashboard charts"
```

---

## Task 2: Create DashboardClient.tsx

**Files:**
- Create: `app/(dashboard)/admin/DashboardClient.tsx`

- [ ] **Step 1: Create the file with full content**

```tsx
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
                formatter={(value: number) => [formatRupiah(value), 'Pendapatan']}
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
                formatter={(value: number, _name: string, props: any) => [
                  `${value} tagihan · ${formatRupiah(props.payload.amount)}`,
                  props.payload.status,
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
                formatter={(value: number) => [`${value} siswa`, 'Jumlah']}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {programDistribution.map((_, i) => (
                  <Cell key={i} fill={PROGRAM_COLORS[i % PROGRAM_COLORS.length]} />
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
                formatter={(value: number) => [`${value}%`, 'Kehadiran']}
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
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/admin/DashboardClient.tsx"
git commit -m "feat: add DashboardClient with recharts charts and enhanced layout"
```

---

## Task 3: Replace page.tsx with enhanced server queries

**Files:**
- Modify: `app/(dashboard)/admin/page.tsx`

- [ ] **Step 1: Replace full file content**

```tsx
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const eightWeeksAgo = new Date(now)
  eightWeeksAgo.setDate(now.getDate() - 55)
  eightWeeksAgo.setHours(0, 0, 0, 0)

  const [
    totalStudents,
    totalClasses,
    schedulesToday,
    overdueCount,
    revenueThisMonth,
    paidLastSixMonths,
    invoiceStatusGroups,
    allEnrollments,
    recentAttendances,
    attendancesThisMonth,
    overdueInvoices,
    pendingInvoices,
    todaySchedules,
  ] = await Promise.all([
    prisma.student.count({ where: { isActive: true } }),
    prisma.class.count(),
    prisma.schedule.count({
      where: {
        date: { gte: today, lt: tomorrow },
        status: { in: ['PUBLISHED', 'COMPLETED'] },
      },
    }),
    prisma.invoice.count({ where: { status: 'OVERDUE' } }),
    prisma.invoice.aggregate({
      where: { status: 'PAID', createdAt: { gte: firstOfMonth } },
      _sum: { amount: true },
    }),
    prisma.invoice.findMany({
      where: { status: 'PAID', createdAt: { gte: sixMonthsAgo } },
      select: { amount: true, createdAt: true },
    }),
    prisma.invoice.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.enrollment.findMany({
      select: { class: { select: { mainProgram: true } } },
    }),
    prisma.attendance.findMany({
      where: { schedule: { date: { gte: eightWeeksAgo } } },
      select: { status: true, schedule: { select: { date: true } } },
    }),
    prisma.attendance.findMany({
      where: { schedule: { date: { gte: firstOfMonth } } },
      select: { status: true },
    }),
    prisma.invoice.findMany({
      where: { status: 'OVERDUE' },
      include: { student: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 4,
    }),
    prisma.invoice.findMany({
      where: { status: 'PENDING' },
      include: { student: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 4,
    }),
    prisma.schedule.findMany({
      where: {
        date: { gte: today, lt: tomorrow },
        status: { in: ['PUBLISHED', 'COMPLETED'] },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        topic: true,
        status: true,
        class: {
          select: {
            name: true,
            tutor: { select: { name: true } },
          },
        },
      },
      orderBy: { startTime: 'asc' },
      take: 10,
    }),
  ])

  // Revenue by month (last 6 months)
  const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const monthRevenue = paidLastSixMonths
      .filter((inv) => {
        const invDate = new Date(inv.createdAt)
        return invDate.getFullYear() === d.getFullYear() && invDate.getMonth() === d.getMonth()
      })
      .reduce((sum, inv) => sum + inv.amount, 0)
    return {
      month: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
      revenue: monthRevenue,
    }
  })

  // Invoice status distribution
  const STATUS_LABELS: Record<string, string> = {
    PAID: 'Lunas',
    PENDING: 'Pending',
    OVERDUE: 'Terlambat',
    CANCELLED: 'Dibatalkan',
  }
  const invoiceDistribution = invoiceStatusGroups.map((g) => ({
    status: STATUS_LABELS[g.status] ?? g.status,
    count: g._count.id,
    amount: g._sum.amount ?? 0,
  }))

  // Program distribution (enrollments per program)
  const programMap: Record<string, number> = {}
  for (const e of allEnrollments) {
    const prog = e.class.mainProgram ?? 'Lainnya'
    programMap[prog] = (programMap[prog] ?? 0) + 1
  }
  const programDistribution = Object.entries(programMap)
    .map(([program, count]) => ({ program, count }))
    .sort((a, b) => b.count - a.count)

  // Weekly attendance trend (last 8 weeks)
  const attendanceTrend = Array.from({ length: 8 }, (_, i) => {
    const wEnd = new Date(now)
    wEnd.setDate(now.getDate() - i * 7)
    wEnd.setHours(23, 59, 59, 999)
    const wStart = new Date(wEnd)
    wStart.setDate(wEnd.getDate() - 6)
    wStart.setHours(0, 0, 0, 0)
    const weekAttendances = recentAttendances.filter((a) => {
      const d = new Date(a.schedule.date)
      return d >= wStart && d <= wEnd
    })
    const rate =
      weekAttendances.length > 0
        ? Math.round(
            (weekAttendances.filter((a) => a.status === 'PRESENT').length / weekAttendances.length) * 100,
          )
        : 0
    return {
      label: wStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      rate,
    }
  }).reverse()

  // Attendance rate this month
  const attendanceRateThisMonth =
    attendancesThisMonth.length > 0
      ? Math.round(
          (attendancesThisMonth.filter((a) => a.status === 'PRESENT').length /
            attendancesThisMonth.length) *
            100,
        )
      : null

  // Invoices needing attention: overdue first, then pending
  const invoicesNeedingAttention = [
    ...overdueInvoices.map((inv) => ({
      id: inv.id,
      studentName: inv.student.name,
      description: inv.description,
      amount: inv.amount,
      dueDate: inv.dueDate.toISOString(),
      isOverdue: true,
    })),
    ...pendingInvoices.map((inv) => ({
      id: inv.id,
      studentName: inv.student.name,
      description: inv.description,
      amount: inv.amount,
      dueDate: inv.dueDate.toISOString(),
      isOverdue: false,
    })),
  ]

  return (
    <DashboardClient
      stats={{
        totalStudents,
        totalClasses,
        schedulesToday,
        overdueCount,
        revenueThisMonth: revenueThisMonth._sum.amount ?? 0,
        attendanceRateThisMonth,
      }}
      revenueByMonth={revenueByMonth}
      invoiceDistribution={invoiceDistribution}
      programDistribution={programDistribution}
      attendanceTrend={attendanceTrend}
      invoicesNeedingAttention={invoicesNeedingAttention}
      todaySchedules={todaySchedules.map((s) => ({
        id: s.id,
        className: s.class.name,
        tutorName: s.class.tutor?.name ?? 'N/A',
        startTime: s.startTime,
        endTime: s.endTime,
        topic: s.topic,
        status: s.status,
      }))}
    />
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no new errors. If errors appear, fix before continuing.

- [ ] **Step 3: Start dev server and verify in browser**

```bash
pnpm dev
```

Open `http://localhost:3000/admin`. Verify:
- 6 stat cards render in 2-col (mobile) → 3-col (sm) → 6-col (xl) grid
- Revenue bar chart renders with 6 month bars
- Invoice donut chart renders with colored segments
- Program distribution horizontal bar renders
- Attendance trend area chart renders
- Today's schedules list shows (or empty state)
- Invoices needing attention list shows overdue first

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/admin/page.tsx"
git commit -m "feat: enhance admin dashboard with 6 KPIs, 4 charts, and enriched lists"
```

---

## Self-Review

**Spec coverage check:**
- ✅ 6 KPI cards (Siswa Aktif, Total Kelas, Jadwal Hari Ini, Tagihan Terlambat, Pendapatan Bulan Ini, Kehadiran %)
- ✅ Revenue trend bar chart (last 6 months paid invoices)
- ✅ Invoice status donut chart (all invoices grouped by status)
- ✅ Program distribution horizontal bar (enrollments per Program enum)
- ✅ Attendance trend area chart (weekly rate last 8 weeks)
- ✅ Today's schedules list with tutor name + status badge
- ✅ Invoices needing attention (overdue first, then pending)

**Type consistency check:**
- `MonthRevenue.revenue` → used as `dataKey="revenue"` in BarChart ✅
- `InvoiceStatusItem.count` → used as `dataKey="count"` in PieChart ✅
- `ProgramItem.count` → used as `dataKey="count"` in horizontal BarChart ✅
- `AttendanceWeek.rate` → used as `dataKey="rate"` in AreaChart ✅
- `AttendanceWeek.label` → used as `dataKey="label"` on XAxis ✅
- `InvoiceItem.isOverdue` → boolean, used to toggle TERLAMBAT badge ✅
- Props shape in page.tsx `return <DashboardClient ...>` matches Props type in DashboardClient.tsx ✅

**Placeholder scan:** None found. All code blocks are complete.
