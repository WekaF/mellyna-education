# DataTable Migration & Smooth Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all data tables in the admin dashboard to a reusable `DataTable` component with sorting, search, and pagination; fix missing CSS keyframes so page transitions are smooth.

**Architecture:** Install `@tanstack/react-table` v8 (headless, type-safe); build a single `DataTable` component wrapping TanStack Table with built-in skeleton loading, global search, sortable columns, and pagination; fix `animate-fade-in`, `shimmer-bg`, and `animate-slide-in` keyframes that are referenced in the codebase but not defined; add per-section `loading.tsx` skeletons for admin routes.

**Tech Stack:** `@tanstack/react-table` ^8, Tailwind CSS v4, Next.js 15 App Router, TypeScript.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `components/common/DataTable.tsx` | Reusable DataTable + exported `TableSkeleton` |
| Modify | `app/globals.css` | Add `@keyframes fadeIn`, `shimmer`, `slideIn`; define `.animate-fade-in`, `.shimmer-bg`, `.animate-slide-in` |
| Create | `app/(dashboard)/admin/schedules/loading.tsx` | Skeleton shown during route navigation |
| Create | `app/(dashboard)/admin/students/loading.tsx` | Skeleton shown during route navigation |
| Create | `app/(dashboard)/admin/billing/loading.tsx` | Skeleton shown during route navigation |
| Create | `app/(dashboard)/admin/tutors/loading.tsx` | Skeleton shown during route navigation |
| Modify | `app/(dashboard)/admin/schedules/page.tsx` | Replace raw `<table>` with `<DataTable>` |
| Modify | `app/(dashboard)/admin/students/page.tsx` | Replace raw `<table>` + inline search with `<DataTable>` |
| Modify | `app/(dashboard)/admin/billing/page.tsx` | Replace raw `<table>` with `<DataTable>` |
| Modify | `app/(dashboard)/admin/tutors/page.tsx` | Convert card grid to `<DataTable>` |

---

## Task 1: Install @tanstack/react-table

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install the dependency**

```bash
npm install @tanstack/react-table
```

Expected output: `added 1 package` (no peer dep warnings for React 19)

- [ ] **Step 2: Verify installation**

```bash
node -e "require('@tanstack/react-table'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @tanstack/react-table"
```

---

## Task 2: Fix CSS animations in globals.css

**Files:**
- Modify: `app/globals.css`

Currently the codebase references three CSS classes that have no `@keyframes` definition:
- `animate-fade-in` — used in `app/(dashboard)/layout.tsx:54` and `app/(dashboard)/admin/page.tsx`
- `shimmer-bg` — used in `app/(dashboard)/loading.tsx`
- `animate-slide-in` — used in `components/dashboard/sidebar.tsx:229`

- [ ] **Step 1: Add keyframes and class definitions to `app/globals.css`**

Append the following to the end of `app/globals.css`:

```css
/* ─── Page & element animations ─── */

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fadeIn 0.25s ease-out both;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.shimmer-bg {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.45) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
}

.dark .shimmer-bg {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.06) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
}

@keyframes slideIn {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

.animate-slide-in {
  animation: slideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "fix: add missing fadeIn, shimmer, and slideIn keyframe animations"
```

---

## Task 3: Create reusable DataTable component

**Files:**
- Create: `components/common/DataTable.tsx`

This component wraps TanStack React Table v8 with:
- Global search input
- Click-to-sort column headers
- Pagination footer (10 / 25 / 50 rows per page)
- Skeleton loading state (exported as `TableSkeleton` for use in `loading.tsx`)
- Empty state with icon + message props
- Dark mode support (inherits from parent styles via globals.css)

- [ ] **Step 1: Create `components/common/DataTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[]
  data: TData[]
  loading?: boolean
  searchPlaceholder?: string
  emptyMessage?: string
  emptyIcon?: string
  defaultPageSize?: number
}

export function TableSkeleton({
  columns = 5,
  rows = 5,
}: {
  columns?: number
  rows?: number
}) {
  return (
    <div className="animate-pulse">
      <div className="p-4 border-b border-slate-100">
        <div className="h-9 w-64 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-6 py-3.5">
                  <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: columns }).map((_, j) => (
                  <td key={j} className="px-6 py-4">
                    <div
                      className="h-4 bg-slate-100 dark:bg-slate-800 rounded"
                      style={{ width: `${50 + ((i * 3 + j * 7) % 40)}%` }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
        <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded" />
        <div className="flex gap-2">
          <div className="h-7 w-7 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-7 w-7 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export default function DataTable<TData>({
  columns,
  data,
  loading = false,
  searchPlaceholder = 'Cari...',
  emptyMessage = 'Tidak ada data.',
  emptyIcon = '📭',
  defaultPageSize = 10,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: defaultPageSize } },
  })

  if (loading) {
    return <TableSkeleton columns={columns.length} />
  }

  const rows = table.getRowModel().rows
  const { pageIndex, pageSize } = table.getState().pagination
  const totalFiltered = table.getFilteredRowModel().rows.length

  return (
    <div>
      {/* Search bar */}
      <div className="p-4 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full sm:w-72 pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-colors"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center text-slate-400">
          <p className="text-3xl">{emptyIcon}</p>
          <p className="mt-2 text-sm">{globalFilter ? 'Data tidak ditemukan.' : emptyMessage}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {table.getHeaderGroups()[0].headers.map((header) => (
                    <th
                      key={header.id}
                      className="text-left px-6 py-3.5 font-semibold text-slate-500 text-xs uppercase whitespace-nowrap"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-1 hover:text-slate-800 transition-colors cursor-pointer"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/30">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Baris per halaman:</span>
              <select
                value={pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:border-indigo-500"
              >
                {[10, 25, 50].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>
                {totalFiltered === 0
                  ? '0 data'
                  : `${pageIndex * pageSize + 1}–${Math.min(
                      (pageIndex + 1) * pageSize,
                      totalFiltered
                    )} dari ${totalFiltered}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-medium px-1">
                  {pageIndex + 1}/{table.getPageCount()}
                </span>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/common/DataTable.tsx
git commit -m "feat: add reusable DataTable component with sort, search, and pagination"
```

---

## Task 4: Add per-section loading.tsx skeletons

**Files:**
- Create: `app/(dashboard)/admin/schedules/loading.tsx`
- Create: `app/(dashboard)/admin/students/loading.tsx`
- Create: `app/(dashboard)/admin/billing/loading.tsx`
- Create: `app/(dashboard)/admin/tutors/loading.tsx`

These files are shown instantly by Next.js App Router as a Suspense fallback during route segment navigation.

- [ ] **Step 1: Create `app/(dashboard)/admin/schedules/loading.tsx`**

```tsx
import { TableSkeleton } from '@/components/common/DataTable'

export default function SchedulesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
      </div>
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        <TableSkeleton columns={7} rows={6} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(dashboard)/admin/students/loading.tsx`**

```tsx
import { TableSkeleton } from '@/components/common/DataTable'

export default function StudentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          <div className="h-4 w-56 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="h-10 w-36 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
      </div>
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        <TableSkeleton columns={5} rows={6} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(dashboard)/admin/billing/loading.tsx`**

```tsx
import { TableSkeleton } from '@/components/common/DataTable'

export default function BillingLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-7 w-44 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          <div className="h-4 w-60 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
      </div>
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        <TableSkeleton columns={5} rows={6} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/(dashboard)/admin/tutors/loading.tsx`**

```tsx
import { TableSkeleton } from '@/components/common/DataTable'

export default function TutorsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-7 w-36 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          <div className="h-4 w-56 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="h-10 w-36 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
      </div>
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        <TableSkeleton columns={5} rows={6} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/admin/schedules/loading.tsx \
        app/(dashboard)/admin/students/loading.tsx \
        app/(dashboard)/admin/billing/loading.tsx \
        app/(dashboard)/admin/tutors/loading.tsx
git commit -m "feat: add per-section table skeleton loading states for admin routes"
```

---

## Task 5: Migrate admin/schedules to DataTable

**Files:**
- Modify: `app/(dashboard)/admin/schedules/page.tsx`

Replace the raw `<table>` block (lines 166–205) with `<DataTable>`. Keep all existing form and publish logic intact. The `handlePublish` and `publishing` state are captured in column cell closures via the component's render scope.

- [ ] **Step 1: Replace `app/(dashboard)/admin/schedules/page.tsx` with the following**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Send } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/common/DataTable'

interface Schedule {
  id: string
  date: string
  startTime: string
  endTime: string
  topic: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED'
  class: { name: string; tutor: { name: string } }
}

const statusConfig = {
  DRAFT: { label: 'Draft', color: 'bg-slate-100 text-slate-600' },
  PUBLISHED: { label: 'Diterbitkan', color: 'bg-emerald-100 text-emerald-700' },
  COMPLETED: { label: 'Selesai', color: 'bg-indigo-100 text-indigo-700' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-rose-100 text-rose-700' },
}

export default function AdminSchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ classId: '', date: '', startTime: '', endTime: '', topic: '', location: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [classes, setClasses] = useState<any[]>([])

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/schedules')
      setSchedules(await res.json())
    } catch {
      setError('Gagal memuat jadwal.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/classes')
      setClasses(await res.json())
    } catch {
      console.error('Gagal memuat kelas.')
    }
  }, [])

  useEffect(() => {
    fetchSchedules()
    fetchClasses()
  }, [fetchSchedules, fetchClasses])

  const handlePublish = async (id: string) => {
    setPublishing(id)
    try {
      const res = await fetch(`/api/schedules/${id}/publish`, { method: 'POST' })
      if (!res.ok) throw new Error()
      await fetchSchedules()
    } catch {
      setError('Gagal menerbitkan jadwal.')
    } finally {
      setPublishing(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Gagal membuat jadwal.')
      await fetchSchedules()
      setShowForm(false)
      setForm({ classId: '', date: '', startTime: '', endTime: '', topic: '', location: '' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnDef<Schedule>[] = [
    {
      id: 'class',
      accessorFn: (row) => row.class.name,
      header: 'Kelas',
      cell: ({ getValue }) => (
        <span className="font-semibold text-slate-800">{getValue() as string}</span>
      ),
    },
    {
      id: 'date',
      accessorFn: (row) =>
        new Date(row.date).toLocaleDateString('id-ID', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      header: 'Tanggal',
      cell: ({ getValue }) => <span className="text-slate-600">{getValue() as string}</span>,
    },
    {
      id: 'jam',
      header: 'Jam',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-slate-600">
          {row.original.startTime} – {row.original.endTime}
        </span>
      ),
    },
    {
      accessorKey: 'topic',
      header: 'Topik',
      cell: ({ getValue }) => (
        <span className="text-slate-500">{(getValue() as string | null) || '-'}</span>
      ),
    },
    {
      id: 'tutor',
      accessorFn: (row) => row.class.tutor.name,
      header: 'Tutor',
      cell: ({ getValue }) => <span className="text-slate-500">{getValue() as string}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const cfg = statusConfig[getValue() as Schedule['status']]
        return (
          <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>
            {cfg.label}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const s = row.original
        if (s.status !== 'DRAFT') return null
        return (
          <button
            onClick={() => handlePublish(s.id)}
            disabled={publishing === s.id}
            className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Send className="h-3 w-3" />
            {publishing === s.id ? 'Mengirim...' : 'Terbitkan + WA'}
          </button>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">📅 Jadwal Bimbel</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola dan terbitkan jadwal sesi belajar.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Buat Jadwal
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">
          ⚠️ {error}
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6">
          <h2 className="font-bold text-slate-800 mb-4">Buat Jadwal Baru</h2>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kelas *</label>
              <select
                required
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
              >
                <option value="">Pilih Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Tutor: {c.tutor.name})
                  </option>
                ))}
              </select>
            </div>
            {[
              { label: 'Tanggal *', key: 'date', type: 'date', placeholder: '' },
              { label: 'Jam Mulai *', key: 'startTime', type: 'time', placeholder: '' },
              { label: 'Jam Selesai *', key: 'endTime', type: 'time', placeholder: '' },
              { label: 'Topik/Materi', key: 'topic', type: 'text', placeholder: 'mis. Persamaan Linear' },
              { label: 'Lokasi', key: 'location', type: 'text', placeholder: 'mis. Ruang A' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                <input
                  required={label.includes('*')}
                  type={type}
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder={placeholder}
                />
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-3 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={schedules}
          loading={loading}
          searchPlaceholder="Cari kelas, topik, tutor..."
          emptyMessage="Belum ada jadwal yang dibuat."
          emptyIcon="📭"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/admin/schedules/page.tsx
git commit -m "feat: migrate schedules table to DataTable component"
```

---

## Task 6: Migrate admin/students to DataTable

**Files:**
- Modify: `app/(dashboard)/admin/students/page.tsx`

Remove the standalone search `<input>` (it's replaced by DataTable's built-in global filter). Keep the form and CRUD handlers.

- [ ] **Step 1: Replace `app/(dashboard)/admin/students/page.tsx` with the following**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/common/DataTable'

interface Student {
  id: string
  name: string
  grade: string | null
  createdAt: string
  parent: { name: string; email: string }
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', grade: '', parentId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parents, setParents] = useState<{ id: string; name: string; email: string }[]>([])

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/students')
      setStudents(await res.json())
    } catch {
      setError('Gagal memuat data siswa.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchParents = useCallback(async () => {
    try {
      const res = await fetch('/api/users?role=PARENT')
      if (!res.ok) throw new Error()
      setParents(await res.json())
    } catch {
      console.error('Gagal memuat data orang tua.')
    }
  }, [])

  useEffect(() => {
    fetchStudents()
    fetchParents()
  }, [fetchStudents, fetchParents])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const url = editId ? `/api/students/${editId}` : '/api/students'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Gagal menyimpan data.')
      await fetchStudents()
      setShowForm(false)
      setEditId(null)
      setForm({ name: '', grade: '', parentId: '' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus siswa "${name}"? Tindakan ini tidak dapat dibatalkan.`)) return
    try {
      await fetch(`/api/students/${id}`, { method: 'DELETE' })
      await fetchStudents()
    } catch {
      setError('Gagal menghapus siswa.')
    }
  }

  const columns: ColumnDef<Student>[] = [
    {
      accessorKey: 'name',
      header: 'Nama Siswa',
      cell: ({ getValue }) => (
        <span className="font-semibold text-slate-800">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'grade',
      header: 'Kelas',
      cell: ({ getValue }) => (
        <span className="text-slate-600">{(getValue() as string | null) || '-'}</span>
      ),
    },
    {
      id: 'parent',
      accessorFn: (row) => row.parent.name,
      header: 'Orang Tua',
      cell: ({ getValue }) => <span className="text-slate-600">{getValue() as string}</span>,
    },
    {
      id: 'createdAt',
      accessorFn: (row) => new Date(row.createdAt).toLocaleDateString('id-ID'),
      header: 'Terdaftar',
      cell: ({ getValue }) => <span className="text-slate-400">{getValue() as string}</span>,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const student = row.original
        return (
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => {
                setEditId(student.id)
                setForm({ name: student.name, grade: student.grade || '', parentId: '' })
                setShowForm(true)
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(student.id, student.name)}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">🎓 Data Siswa</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola daftar siswa bimbingan belajar.</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true)
            setEditId(null)
            setForm({ name: '', grade: '', parentId: '' })
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Tambah Siswa
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">
          ⚠️ {error}
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6 space-y-4">
          <h2 className="font-bold text-slate-800">{editId ? 'Edit Siswa' : 'Tambah Siswa Baru'}</h2>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Siswa *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Nama lengkap siswa"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kelas / Tingkatan</label>
              <input
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="mis. Kelas 5 SD"
              />
            </div>
            {!editId && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Orang Tua *</label>
                <select
                  required
                  value={form.parentId}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="">Pilih Orang Tua</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="sm:col-span-3 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={students}
          loading={loading}
          searchPlaceholder="Cari nama siswa atau kelas..."
          emptyMessage="Belum ada data siswa."
          emptyIcon="📭"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/admin/students/page.tsx
git commit -m "feat: migrate students table to DataTable component"
```

---

## Task 7: Migrate admin/billing to DataTable

**Files:**
- Modify: `app/(dashboard)/admin/billing/page.tsx`

- [ ] **Step 1: Replace `app/(dashboard)/admin/billing/page.tsx` with the following**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/common/DataTable'
import { formatRupiah } from '@/lib/utils'

interface Invoice {
  id: string
  description: string
  amount: number
  dueDate: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  student: { name: string }
}

const statusConfig = {
  PENDING: { label: 'Belum Lunas', color: 'bg-amber-100 text-amber-700' },
  PAID: { label: 'Lunas', color: 'bg-emerald-100 text-emerald-700' },
  OVERDUE: { label: 'Terlambat', color: 'bg-rose-100 text-rose-700' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-slate-100 text-slate-600' },
}

export default function AdminBillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ studentId: '', amount: '', description: '', dueDate: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [studentList, setStudentList] = useState<{ id: string; name: string; grade: string | null }[]>([])

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/invoices')
      setInvoices(await res.json())
    } catch {
      setError('Gagal memuat data tagihan.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStudentList = useCallback(async () => {
    try {
      const res = await fetch('/api/students')
      if (!res.ok) throw new Error()
      setStudentList(await res.json())
    } catch {
      console.error('Gagal memuat daftar siswa.')
    }
  }, [])

  useEffect(() => {
    fetchInvoices()
    fetchStudentList()
  }, [fetchInvoices, fetchStudentList])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseInt(form.amount) }),
      })
      if (!res.ok) throw new Error('Gagal membuat invoice.')
      await fetchInvoices()
      setShowForm(false)
      setForm({ studentId: '', amount: '', description: '', dueDate: '' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnDef<Invoice>[] = [
    {
      id: 'student',
      accessorFn: (row) => row.student.name,
      header: 'Siswa',
      cell: ({ getValue }) => (
        <span className="font-semibold text-slate-800">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Keterangan',
      cell: ({ getValue }) => <span className="text-slate-600">{getValue() as string}</span>,
    },
    {
      accessorKey: 'amount',
      header: 'Nominal',
      cell: ({ getValue }) => (
        <span className="font-bold text-slate-800">{formatRupiah(getValue() as number)}</span>
      ),
    },
    {
      id: 'dueDate',
      accessorFn: (row) => new Date(row.dueDate).toLocaleDateString('id-ID'),
      header: 'Jatuh Tempo',
      cell: ({ getValue }) => <span className="text-slate-500">{getValue() as string}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const cfg = statusConfig[getValue() as Invoice['status']]
        return (
          <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>
            {cfg.label}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">💳 Tagihan & Invoice</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola tagihan bimbel dan pantau status pembayaran.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Buat Invoice
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">
          ⚠️ {error}
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6">
          <h2 className="font-bold text-slate-800 mb-4">Buat Invoice Baru</h2>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Siswa *</label>
              <select
                required
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
              >
                <option value="">Pilih Siswa</option>
                {studentList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.grade ? ` (${s.grade})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nominal (Rp) *</label>
              <input
                required
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="500000"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Keterangan *</label>
              <input
                required
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="mis. Biaya Bimbel Bulan Juni"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Jatuh Tempo *</label>
              <input
                required
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Buat Invoice'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={invoices}
          loading={loading}
          searchPlaceholder="Cari siswa, keterangan, status..."
          emptyMessage="Belum ada tagihan."
          emptyIcon="💰"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/admin/billing/page.tsx
git commit -m "feat: migrate billing table to DataTable component"
```

---

## Task 8: Convert admin/tutors card grid to DataTable

**Files:**
- Modify: `app/(dashboard)/admin/tutors/page.tsx`

Tutors currently uses a card grid. Converting to DataTable gives consistent UX and adds search + sort capabilities.

- [ ] **Step 1: Replace `app/(dashboard)/admin/tutors/page.tsx` with the following**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/common/DataTable'

interface Tutor {
  id: string
  name: string
  email: string
  phone: string | null
  createdAt: string
}

export default function AdminTutorsPage() {
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTutors = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tutors')
      setTutors(await res.json())
    } catch {
      setError('Gagal memuat data tutor.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTutors()
  }, [fetchTutors])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role: 'TUTOR' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal menambahkan tutor.')
      }
      await fetchTutors()
      setShowForm(false)
      setForm({ name: '', email: '', password: '', phone: '' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnDef<Tutor>[] = [
    {
      accessorKey: 'name',
      header: 'Nama Tutor',
      cell: ({ getValue }) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-sm">👩‍🏫</span>
          </div>
          <span className="font-semibold text-slate-800">{getValue() as string}</span>
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ getValue }) => <span className="text-slate-600">{getValue() as string}</span>,
    },
    {
      accessorKey: 'phone',
      header: 'No. HP',
      cell: ({ getValue }) => (
        <span className="text-slate-500">{(getValue() as string | null) || '-'}</span>
      ),
    },
    {
      id: 'createdAt',
      accessorFn: (row) =>
        new Date(row.createdAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      header: 'Terdaftar',
      cell: ({ getValue }) => <span className="text-slate-400">{getValue() as string}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">👩‍🏫 Data Tutor</h1>
          <p className="text-sm text-slate-500 mt-0.5">Daftar tutor yang terdaftar di Mellyna Education.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Tambah Tutor
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">
          ⚠️ {error}
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6">
          <h2 className="font-bold text-slate-800 mb-4">Tambah Tutor Baru</h2>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="mis. Pak Budi Santoso"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="tutor@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Password *</label>
              <input
                required
                type="password"
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Min. 6 karakter"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">No. HP (WhatsApp)</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="mis. 6281234567890"
              />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Tambah Tutor'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={tutors}
          loading={loading}
          searchPlaceholder="Cari nama tutor atau email..."
          emptyMessage="Belum ada tutor yang terdaftar."
          emptyIcon="👩‍🏫"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/admin/tutors/page.tsx
git commit -m "feat: convert tutors card grid to DataTable component"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Covered by |
|-------------|-----------|
| All tables use DataTable | Tasks 5–8 migrate all 4 data views |
| Sortable columns | DataTable `getSortedRowModel` + clickable headers |
| Search/filter | DataTable global filter input |
| Pagination | DataTable `getPaginationRowModel` footer |
| Smooth page transitions | Task 2: `animate-fade-in` keyframe now defined |
| Smooth sidebar animation | Task 2: `animate-slide-in` keyframe now defined |
| Loading skeletons during navigation | Task 4: per-section `loading.tsx` + DataTable skeleton |
| Loading skeleton during data fetch | DataTable's `loading` prop shows `TableSkeleton` |
| Dark mode | DataTable inherits dark mode from globals.css rules |

**No placeholders detected.** All code blocks are complete.

**Type consistency:**
- `TableSkeleton` — exported from `DataTable.tsx`, imported in `loading.tsx` files ✓
- `DataTable` — default export from `DataTable.tsx`, imported with `@/components/common/DataTable` ✓
- `ColumnDef` — imported as type from `@tanstack/react-table` in each page ✓
