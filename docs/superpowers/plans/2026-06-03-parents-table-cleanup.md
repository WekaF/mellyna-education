# Parents Table Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the admin parents table from 7 cramped columns to 4 clean ones by merging related columns, moving financial status inline, and consolidating all actions into one column.

**Architecture:** All changes are in the `columns` useMemo in `ParentsClient.tsx`. Column structure: (1) Wali Murid + financial badge inline, (2) Siswa & Program merged, (3) Status Akun badge only, (4) Aksi with all action buttons. No API or data changes needed.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, `@tanstack/react-table`

---

## File Map

| File | Change |
|------|--------|
| `app/(dashboard)/admin/parents/ParentsClient.tsx` | Replace `columns` useMemo — 7 columns → 4 columns |

---

## Current vs Target Column Layout

| Before (7 cols) | After (4 cols) |
|-----------------|----------------|
| Nama Wali Murid | **Wali Murid** (name + email + phone + financial status badge inline) |
| Siswa / Anak | **Siswa & Program** (child name button + program badges side by side) |
| Program | *(merged into col 2)* |
| Paket Belajar | *(removed — detail available in analytics drawer)* |
| Status Keuangan | *(moved inline into col 1)* |
| Status Akun | **Status Akun** (badge only — Aktif / Suspended) |
| *(actions col)* | **Aksi** (Edit + +Siswa + Analitik — all together) |

---

## Task 1: Replace columns definition

**Files:**
- Modify: `app/(dashboard)/admin/parents/ParentsClient.tsx` — `columns` useMemo (lines 381–602)

- [ ] **Step 1: Replace the entire `columns` useMemo with the new 4-column definition**

  Find the `columns` useMemo (starts at `const columns = useMemo<ColumnDef<Parent>[]>(() => [` around line 381). Replace everything from that line through the closing `], [handleToggleSuspend, togglingId, handleStartEdit])` line with:

  ```typescript
  const columns = useMemo<ColumnDef<Parent>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Wali Murid',
      cell: ({ row }) => {
        const parent = row.original
        const billingStatus = getParentBillingStatus(parent)
        return (
          <div className="flex flex-col gap-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{parent.name}</span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                billingStatus === 'UNPAID'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${billingStatus === 'UNPAID' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                {billingStatus === 'UNPAID' ? 'Menunggak' : 'Lunas'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[160px]">{parent.email}</span>
              </span>
              {parent.phone && (
                <a
                  href={getWaLink(parent.phone, parent.name) || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium transition-colors"
                  title="Hubungi via WhatsApp"
                >
                  <Phone className="h-3 w-3 shrink-0" />
                  {parent.phone}
                </a>
              )}
            </div>
          </div>
        )
      },
    },
    {
      id: 'siswa_program',
      header: 'Siswa & Program',
      enableSorting: false,
      cell: ({ row }) => {
        const parent = row.original
        if (parent.children.length === 0) {
          return <span className="text-xs text-slate-400 dark:text-slate-500 italic">Belum ada siswa</span>
        }
        return (
          <div className="space-y-2 min-w-[200px]">
            {parent.children.map((child) => {
              const actives = (child.programEnrollments ?? []).filter((pe) => pe.status === 'ACTIVE')
              return (
                <div key={child.id} className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setSelectedParent(parent)
                      setSelectedStudent(child)
                      setActiveAnalyticTab('overview')
                    }}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 shadow-xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200 shrink-0 ${
                      child.isActive
                        ? 'bg-blue-50/70 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/60 dark:text-blue-400'
                        : 'bg-slate-50 border-slate-200 text-slate-400 line-through dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-500'
                    }`}
                    title={`Lihat Analitik: ${child.name}`}
                  >
                    📊 {child.name}
                  </button>
                  <div className="flex flex-wrap items-center gap-1">
                    {actives.length === 0 ? (
                      <ProgramEnrollmentBadge program={null} />
                    ) : (
                      actives.map((pe) => (
                        <ProgramEnrollmentBadge key={pe.id} program={pe.program} />
                      ))
                    )}
                    <button
                      onClick={() => openProgramModal(child)}
                      className="text-[10px] text-indigo-500 font-bold opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                      title={`Tambah program untuk ${child.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      },
    },
    {
      id: 'account_status',
      header: 'Status Akun',
      enableSorting: false,
      cell: ({ row }) => {
        const parent = row.original
        return parent.suspended ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Suspended
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Aktif
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const parent = row.original
        const isToggling = togglingId === parent.id
        return (
          <div className="flex items-center justify-end gap-1.5 flex-wrap">
            <button
              onClick={() => handleStartEdit(parent)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all border bg-slate-50 border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-indigo-950/20 dark:hover:text-indigo-400"
              title="Edit data wali murid"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            <button
              onClick={() => {
                setAddStudentForParent(parent)
                setAddStudentForm({ name: '', grade: '' })
                setAddStudentError(null)
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/30 dark:text-emerald-400 transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-900/40"
            >
              <UserPlus className="h-3 w-3" />
              +Siswa
            </button>
            {parent.children.length > 0 && (
              <button
                onClick={() => {
                  setSelectedParent(parent)
                  setSelectedStudent(parent.children[0])
                  setActiveAnalyticTab('overview')
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/30 dark:text-indigo-400 transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-900/40"
              >
                <BarChart2 className="h-3 w-3" />
                Analitik
              </button>
            )}
            <button
              onClick={() => handleToggleSuspend(parent)}
              disabled={isToggling}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all duration-200 disabled:opacity-50 border ${
                parent.suspended
                  ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100/70 dark:bg-rose-950/10 dark:border-rose-900/40 dark:text-rose-400'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100/70 dark:bg-emerald-950/10 dark:border-emerald-900/40 dark:text-emerald-400'
              }`}
            >
              {isToggling ? (
                <span className="h-3 w-3 animate-spin rounded-full border border-slate-350 border-t-transparent" />
              ) : parent.suspended ? (
                <UserX className="h-3.5 w-3.5" />
              ) : (
                <UserCheck className="h-3.5 w-3.5" />
              )}
              {parent.suspended ? 'Suspend' : 'Aktif'}
            </button>
          </div>
        )
      },
    },
  ], [handleToggleSuspend, togglingId, handleStartEdit, setSelectedParent, setSelectedStudent, setActiveAnalyticTab, setAddStudentForParent, setAddStudentForm, setAddStudentError, openProgramModal])
  ```

  **Note on deps array:** The new columns useMemo adds `setSelectedParent`, `setSelectedStudent`, `setActiveAnalyticTab`, `setAddStudentForParent`, `setAddStudentForm`, `setAddStudentError`, `openProgramModal` to the deps. These are all stable React state setters or `useCallback` functions so they won't cause re-renders. This is correct.

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors. If there are errors about `setActiveAnalyticTab` type, the function accepts `'overview' | 'attendance' | 'academic' | 'finance'` — the call site passes `'overview'` which is correct.

- [ ] **Step 3: Manual visual check**

  Open `/admin/parents` in browser. Verify:
  1. Table has exactly 4 columns: "Wali Murid", "Siswa & Program", "Status Akun", (actions)
  2. Financial status badge appears inside the "Wali Murid" cell next to the name
  3. Child name button and their program badges appear on the same row in "Siswa & Program"
  4. "Status Akun" column shows only the Aktif/Suspended badge
  5. Actions column has Edit + +Siswa + Analitik + Suspend/Aktif toggle all together
  6. Table fits on screen without horizontal scrolling on a 1280px display

- [ ] **Step 4: Commit**

  ```bash
  git add app/(dashboard)/admin/parents/ParentsClient.tsx
  git commit -m "refactor: consolidate parents table from 7 to 4 columns for cleaner layout"
  ```

---

## Self-Review

### Spec coverage
- [x] Remove "Paket Belajar" column — not in new columns definition
- [x] Merge "Status Keuangan" into "Wali Murid" cell — badge appears next to name in col 1
- [x] Merge "Program" into "Siswa" column — col 2 shows child name + program badges per row
- [x] "Status Akun" → badge only — col 3 only renders the status badge, no buttons
- [x] All actions in one column — Edit + +Siswa + Analitik + Suspend all in col 4

### Placeholder scan
- No TBD, all code is concrete with exact class names and JSX

### Type consistency
- `setActiveAnalyticTab('overview')` — correct, `'overview'` is a valid tab value
- `getParentBillingStatus(parent)` — returns `'UNPAID' | 'PAID'`, used in ternary: consistent
- `(child.programEnrollments ?? []).filter((pe) => pe.status === 'ACTIVE')` — same pattern as the original code: consistent
- `handleToggleSuspend, togglingId, handleStartEdit` — same names as original deps: consistent
