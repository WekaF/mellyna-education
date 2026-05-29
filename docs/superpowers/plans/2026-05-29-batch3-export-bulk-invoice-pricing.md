# Batch 3 — Export, Bulk Invoice & Pricing Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Excel/PDF export to the analytics page, bulk invoice generation for all students in a class, and a static pricing table page with dummy tiers (to be replaced with real data later).

**Architecture:** Export is entirely client-side using `xlsx` + `jspdf-autotable` — no server routes needed. Bulk invoice uses a new `POST /api/invoices/bulk` route. Pricing table is a static page with hardcoded dummy data.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, TypeScript, Tailwind CSS, `xlsx` (Excel export), `jspdf` + `jspdf-autotable` (PDF export).

---

## File Map

**New files:**
- `app/api/invoices/bulk/route.ts` — POST: create invoices for all students in a class
- `app/(dashboard)/admin/pricing/page.tsx` — static pricing tiers page
- `lib/export.ts` — reusable Excel + PDF export helpers

**Modified files:**
- `app/(dashboard)/admin/analytics/page.tsx` — add export buttons per tab
- `app/(dashboard)/admin/billing/page.tsx` — add "Buat Invoice Massal" button + modal
- `components/dashboard/sidebar.tsx` — add "Paket Harga" nav item

---

## Task 1: Install Export Dependencies

- [ ] **Step 1: Install packages**

```bash
npm install xlsx jspdf jspdf-autotable
npm install --save-dev @types/jspdf-autotable
```

Expected: packages added to `node_modules`.

- [ ] **Step 2: Verify installation**

```bash
node -e "require('xlsx'); require('jspdf'); console.log('export deps OK')"
```

Expected: `export deps OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add xlsx and jspdf for client-side Excel/PDF export"
```

---

## Task 2: Create `lib/export.ts` — Export Utilities

**Files:**
- Create: `lib/export.ts`

- [ ] **Step 1: Write the utility file**

```typescript
import * as XLSX from 'xlsx'

export function exportToExcel(rows: Record<string, unknown>[], filename: string, sheetName = 'Data') {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export async function exportToPDF(
  columns: string[],
  rows: (string | number | null)[],
  filename: string,
  title: string
) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text(title, 14, 16)
  doc.setFontSize(10)
  doc.text(`Diekspor: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 23)

  autoTable(doc, {
    head: [columns],
    body: rows as any,
    startY: 28,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  doc.save(`${filename}.pdf`)
}
```

Note: `jspdf` and `jspdf-autotable` are dynamically imported to avoid SSR issues (they require `window`).

- [ ] **Step 2: Commit**

```bash
git add lib/export.ts
git commit -m "feat: add Excel and PDF export utilities to lib/export.ts"
```

---

## Task 3: Add Export Buttons to Admin Analytics Page

**Files:**
- Modify: `app/(dashboard)/admin/analytics/page.tsx`

- [ ] **Step 1: Add import for export utilities at top of file**

```typescript
import { exportToExcel, exportToPDF } from '@/lib/export'
import { Download } from 'lucide-react'
```

- [ ] **Step 2: Add export handlers**

After the `fetchData` callback, add these three handlers:

```typescript
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
```

- [ ] **Step 3: Add export button row above each table**

For the attendance tab, add above the table div:
```tsx
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
```

Add equivalent export button rows for the tutors and students tabs (same pattern, calling `handleExportTutors` and `handleExportStudents`).

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/admin/analytics/page.tsx"
git commit -m "feat: add Excel and PDF export buttons to analytics tabs"
```

---

## Task 4: Create `POST /api/invoices/bulk`

**Files:**
- Create: `app/api/invoices/bulk/route.ts`

Creates invoices for all students enrolled in a given class (or a specific list of studentIds).

- [ ] **Step 1: Write the route file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const bulkInvoiceSchema = z.object({
  classId: z.string().min(1),
  amount: z.number().int().positive(),
  description: z.string().min(1),
  dueDate: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = bulkInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { classId, amount, description, dueDate } = parsed.data

  // Get all active students enrolled in this class
  const enrollments = await prisma.enrollment.findMany({
    where: { classId, student: { isActive: true } },
    select: { studentId: true },
  })

  if (enrollments.length === 0) {
    return NextResponse.json({ error: 'Tidak ada siswa aktif di kelas ini.' }, { status: 422 })
  }

  const invoices = await prisma.invoice.createMany({
    data: enrollments.map((e) => ({
      studentId: e.studentId,
      amount,
      description,
      dueDate: new Date(dueDate),
    })),
    skipDuplicates: false,
  })

  return NextResponse.json({ created: invoices.count }, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/invoices/bulk/route.ts
git commit -m "feat: add POST /api/invoices/bulk for batch invoice creation per class"
```

---

## Task 5: Add "Buat Invoice Massal" to Admin Billing Page

**Files:**
- Modify: `app/(dashboard)/admin/billing/page.tsx`

Add a bulk invoice modal next to the existing "Buat Invoice" button.

- [ ] **Step 1: Add bulk invoice state**

After the existing state declarations, add:
```typescript
const [showBulkForm, setShowBulkForm] = useState(false)
const [bulkForm, setBulkForm] = useState({ classId: '', amount: '', description: '', dueDate: '' })
const [bulkSaving, setBulkSaving] = useState(false)
const [bulkResult, setBulkResult] = useState<{ created: number } | null>(null)
const [classList, setClassList] = useState<{ id: string; name: string; tutor: { name: string } }[]>([])
```

- [ ] **Step 2: Add fetchClassList callback**

```typescript
const fetchClassList = useCallback(async () => {
  try {
    const res = await fetch('/api/classes')
    if (!res.ok) throw new Error()
    setClassList(await res.json())
  } catch {
    console.error('Gagal memuat daftar kelas.')
  }
}, [])
```

Update useEffect to also call `fetchClassList()`.

- [ ] **Step 3: Add handleBulkSubmit handler**

```typescript
const handleBulkSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setBulkSaving(true)
  setBulkResult(null)
  try {
    const res = await fetch('/api/invoices/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...bulkForm, amount: parseInt(bulkForm.amount) }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Gagal membuat invoice massal.')
    }
    const data = await res.json()
    setBulkResult(data)
    await fetchInvoices()
    setBulkForm({ classId: '', amount: '', description: '', dueDate: '' })
  } catch (err: any) {
    setError(err.message)
  } finally {
    setBulkSaving(false)
  }
}
```

- [ ] **Step 4: Add "Buat Invoice Massal" button to the header section**

In the header buttons row, after the existing "Buat Invoice" button, add:
```tsx
<button
  onClick={() => { setShowBulkForm(true); setBulkResult(null) }}
  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
>
  <Users className="h-4 w-4" /> Invoice Massal
</button>
```

Add `Users` to lucide imports.

- [ ] **Step 5: Add bulk invoice form modal**

After the existing single invoice form `{showForm && ...}`, add:
```tsx
{showBulkForm && (
  <div className="rounded-2xl bg-white border border-violet-100 shadow-md p-6">
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-bold text-slate-800">📦 Invoice Massal — Per Kelas</h2>
      <button onClick={() => setShowBulkForm(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
    </div>
    {bulkResult && (
      <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
        ✅ Berhasil membuat <strong>{bulkResult.created}</strong> invoice untuk siswa aktif di kelas ini.
      </div>
    )}
    <form onSubmit={handleBulkSubmit} className="grid sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Kelas *</label>
        <select
          required
          value={bulkForm.classId}
          onChange={(e) => setBulkForm({ ...bulkForm, classId: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-violet-500 bg-white"
        >
          <option value="">Pilih Kelas</option>
          {classList.map((c) => (
            <option key={c.id} value={c.id}>{c.name} (Tutor: {c.tutor.name})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Nominal (Rp) *</label>
        <input required type="number" value={bulkForm.amount} onChange={(e) => setBulkForm({ ...bulkForm, amount: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-violet-500" placeholder="500000" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Keterangan *</label>
        <input required type="text" value={bulkForm.description} onChange={(e) => setBulkForm({ ...bulkForm, description: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-violet-500" placeholder="mis. Biaya Bimbel Bulan Juni" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Jatuh Tempo *</label>
        <input required type="date" value={bulkForm.dueDate} onChange={(e) => setBulkForm({ ...bulkForm, dueDate: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-violet-500" />
      </div>
      <div className="sm:col-span-2 flex gap-3">
        <button type="submit" disabled={bulkSaving} className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
          {bulkSaving ? 'Membuat...' : '📦 Buat Invoice untuk Semua Siswa Aktif'}
        </button>
        <button type="button" onClick={() => setShowBulkForm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">Batal</button>
      </div>
    </form>
    <p className="text-xs text-slate-400 mt-3">Invoice akan dibuat untuk semua siswa <strong>aktif</strong> yang terdaftar di kelas yang dipilih.</p>
  </div>
)}
```

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/admin/billing/page.tsx"
git commit -m "feat: add bulk invoice modal to admin billing page"
```

---

## Task 6: Create Pricing Table Page with Dummy Data

**Files:**
- Create: `app/(dashboard)/admin/pricing/page.tsx`

Static page with 3 dummy pricing tiers. Replace with real data when ready.

- [ ] **Step 1: Write the page**

```tsx
import { Check } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'

const tiers = [
  {
    name: 'Paket Basic',
    price: 300000,
    period: '/bulan',
    color: 'border-slate-200',
    badge: null,
    sessions: 8,
    frequency: '2x pertemuan/minggu',
    features: [
      'Bimbingan 1 mata pelajaran',
      '8 sesi per bulan (60 menit/sesi)',
      'Laporan belajar bulanan',
      'Notifikasi jadwal via WhatsApp',
    ],
  },
  {
    name: 'Paket Standard',
    price: 500000,
    period: '/bulan',
    color: 'border-indigo-400',
    badge: 'Terpopuler',
    sessions: 12,
    frequency: '3x pertemuan/minggu',
    features: [
      'Bimbingan 2 mata pelajaran',
      '12 sesi per bulan (60 menit/sesi)',
      'Laporan belajar mingguan',
      'Notifikasi jadwal via WhatsApp',
      'Konsultasi progres dengan orang tua',
    ],
  },
  {
    name: 'Paket Premium',
    price: 750000,
    period: '/bulan',
    color: 'border-amber-400',
    badge: 'Terlengkap',
    sessions: 20,
    frequency: '5x pertemuan/minggu',
    features: [
      'Bimbingan semua mata pelajaran',
      '20 sesi per bulan (60 menit/sesi)',
      'Laporan belajar mingguan + nilai',
      'Notifikasi jadwal via WhatsApp',
      'Konsultasi progres dengan orang tua',
      'Try-out simulasi ujian bulanan',
      'Modul latihan soal digital',
    ],
  },
]

export default function AdminPricingPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">💰 Tabel Paket Harga</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Daftar paket bimbingan belajar Mellyna Education.{' '}
          <span className="text-amber-600 font-medium">(Data dummy — perbarui dengan harga resmi)</span>
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <div key={tier.name} className={`rounded-2xl bg-white border-2 ${tier.color} p-6 space-y-5 relative shadow-xs hover:shadow-md transition-shadow`}>
            {tier.badge && (
              <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full ${
                tier.badge === 'Terpopuler' ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white'
              }`}>
                {tier.badge}
              </div>
            )}

            <div>
              <h2 className="font-extrabold text-lg text-slate-800">{tier.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{tier.frequency}</p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-slate-800">{formatRupiah(tier.price)}</span>
              <span className="text-sm text-slate-400">{tier.period}</span>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2 text-center">
              <span className="text-lg font-extrabold text-indigo-600">{tier.sessions}</span>
              <span className="text-xs text-slate-500 ml-1">sesi per bulan</span>
            </div>

            <ul className="space-y-2">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-amber-50 border border-amber-100 p-5 text-sm text-amber-700 space-y-1">
        <p className="font-bold">📝 Catatan Admin</p>
        <p>Halaman ini menggunakan data dummy. Edit file <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">app/(dashboard)/admin/pricing/page.tsx</code> untuk memperbarui harga dan fitur sesuai paket resmi Mellyna Education.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/admin/pricing/page.tsx"
git commit -m "feat: add admin pricing table page with dummy tier data"
```

---

## Task 7: Add "Paket Harga" to Admin Sidebar

**Files:**
- Modify: `components/dashboard/sidebar.tsx`

- [ ] **Step 1: Add `Tag` icon to lucide import**

Add `Tag` to the existing lucide-react import.

- [ ] **Step 2: Add Paket Harga entry to SUPER_ADMIN nav links**

Add after "Laporan":
```typescript
{ name: 'Paket Harga', href: '/admin/pricing', icon: Tag },
```

Final nav order: Dashboard, Siswa, Tutor, Kelas, Jadwal, Tagihan, Pengumuman, Analitik, Laporan, Paket Harga, Pengaturan.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/sidebar.tsx
git commit -m "feat: add Paket Harga link to admin sidebar"
```

---

## Self-Review

**Spec coverage:**
- ✅ Export Excel/PDF: Tasks 1-3 (analytics tabs each have Excel + PDF export buttons)
- ✅ Bulk invoice: Tasks 4-5 (select class → create for all active enrolled students)
- ✅ Pricing table with dummy data: Tasks 6-7

**Edge cases covered:**
- Bulk invoice: only creates for `isActive: true` students (inactive skipped)
- Export: uses `filteredAttendance/Tutors/Students` so exported data matches search filter
- PDF/Excel only rendered client-side (dynamic import avoids SSR window errors)
- jsPDF dynamically imported with `await import()` to avoid Next.js SSR errors

**Pending:**
- Pricing table: replace dummy data with real pricing from Mellyna Education admin when available
