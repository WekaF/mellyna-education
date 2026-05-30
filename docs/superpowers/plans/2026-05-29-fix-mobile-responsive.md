# Mobile Responsiveness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all non-responsive UI elements across the dashboard so pages render correctly on mobile phones (375px–480px) and tablets (768px–1024px).

**Architecture:** Pure Tailwind CSS responsive class fixes — no structural refactors, no new components. Each fix adds mobile-first breakpoint classes (`sm:`, `md:`) to existing elements where desktop sizing was used as default.

**Tech Stack:** Next.js 14, Tailwind CSS v3, React — no new dependencies.

---

## Issues Found (Code Review)

| # | Issue | File | Lines | Severity |
|---|-------|------|-------|----------|
| 1 | Hero banner `p-8 text-3xl` — too large padding/text on mobile | `admin/page.tsx` | 46–49 | High |
| 2 | Hero banner `p-8 text-3xl` — too large padding/text on mobile | `parent/page.tsx` | 53–56 | High |
| 3 | Pending invoice row `px-6` — no text truncation, can overflow | `admin/page.tsx` | 83–93 | High |
| 4 | 3-button action row — no `flex-wrap`, overflows on narrow screens | `admin/billing/page.tsx` | 316–337 | Critical |
| 5 | Bulk invoice button text too long — wraps awkwardly on mobile | `admin/billing/page.tsx` | 469 | Medium |
| 6 | Analytics tab bar — 3 long-label tabs overflow 375px screen | `admin/analytics/page.tsx` | 153–167 | Critical |
| 7 | Summary card `text-2xl` — too wide for 2-col mobile grid | `admin/financial-report/page.tsx` | 48–55 | High |
| 8 | Schedule action button row — `flex gap-2` no `flex-wrap` | `admin/schedules/page.tsx` | 221 | Medium |

---

## File Structure

```
app/(dashboard)/admin/page.tsx            — Task 1: hero banner + invoice row
app/(dashboard)/parent/page.tsx           — Task 1: hero banner
app/(dashboard)/admin/billing/page.tsx    — Task 2: action buttons + bulk button text
app/(dashboard)/admin/analytics/page.tsx  — Task 3: tab bar scrollable
app/(dashboard)/admin/financial-report/page.tsx — Task 4: summary card text
app/(dashboard)/admin/schedules/page.tsx  — Task 5: action button wrap
```

---

## Task 1: Responsive Hero Banners + Invoice Row (Admin & Parent Dashboard)

**Files:**
- Modify: `app/(dashboard)/admin/page.tsx:46-49` (hero banner)
- Modify: `app/(dashboard)/admin/page.tsx:83-93` (pending invoice row)
- Modify: `app/(dashboard)/parent/page.tsx:53-56` (hero banner)

- [ ] **Step 1: Fix admin dashboard hero banner**

In `app/(dashboard)/admin/page.tsx`, replace lines 46–49:

```tsx
// Before:
<div className="rounded-3xl bg-gradient-to-r from-indigo-600 to-indigo-800 p-8 text-white shadow-xl shadow-indigo-600/10">
  <h1 className="text-3xl font-extrabold tracking-tight">Dashboard Admin 👋</h1>
  <p className="mt-2 text-indigo-100">Selamat datang! Berikut ringkasan operasional Mellyna Education hari ini.</p>
</div>

// After:
<div className="rounded-3xl bg-gradient-to-r from-indigo-600 to-indigo-800 p-5 sm:p-8 text-white shadow-xl shadow-indigo-600/10">
  <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">Dashboard Admin 👋</h1>
  <p className="mt-2 text-sm sm:text-base text-indigo-100">Selamat datang! Berikut ringkasan operasional Mellyna Education hari ini.</p>
</div>
```

- [ ] **Step 2: Fix admin pending invoice row**

In `app/(dashboard)/admin/page.tsx`, replace lines 83–93:

```tsx
// Before:
<div key={inv.id} className="flex items-center justify-between px-6 py-4">
  <div>
    <p className="font-semibold text-sm text-slate-800">{inv.student.name}</p>
    <p className="text-xs text-slate-400">{inv.description}</p>
  </div>
  <div className="text-right">
    <p className="font-bold text-sm text-slate-800">{formatRupiah(inv.amount)}</p>
    <p className="text-xs text-rose-500">Jatuh tempo: {new Date(inv.dueDate).toLocaleDateString('id-ID')}</p>
  </div>
</div>

// After:
<div key={inv.id} className="flex items-start justify-between px-4 sm:px-6 py-4 gap-3">
  <div className="min-w-0 flex-1">
    <p className="font-semibold text-sm text-slate-800 truncate">{inv.student.name}</p>
    <p className="text-xs text-slate-400 truncate">{inv.description}</p>
  </div>
  <div className="text-right shrink-0">
    <p className="font-bold text-sm text-slate-800">{formatRupiah(inv.amount)}</p>
    <p className="text-xs text-rose-500">Jatuh tempo: {new Date(inv.dueDate).toLocaleDateString('id-ID')}</p>
  </div>
</div>
```

- [ ] **Step 3: Fix parent dashboard hero banner**

In `app/(dashboard)/parent/page.tsx`, replace lines 53–56:

```tsx
// Before:
<div className="rounded-3xl bg-gradient-to-r from-violet-600 to-violet-800 p-8 text-white shadow-xl shadow-violet-600/10 transition-shadow">
  <h1 className="text-3xl font-extrabold tracking-tight">Dashboard Orang Tua 👋</h1>
  <p className="mt-2 text-violet-100">Pantau perkembangan belajar, jadwal, dan tagihan anak Anda.</p>
</div>

// After:
<div className="rounded-3xl bg-gradient-to-r from-violet-600 to-violet-800 p-5 sm:p-8 text-white shadow-xl shadow-violet-600/10 transition-shadow">
  <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">Dashboard Orang Tua 👋</h1>
  <p className="mt-2 text-sm sm:text-base text-violet-100">Pantau perkembangan belajar, jadwal, dan tagihan anak Anda.</p>
</div>
```

- [ ] **Step 4: Commit**

```bash
rtk git add app/\(dashboard\)/admin/page.tsx app/\(dashboard\)/parent/page.tsx
rtk git commit -m "fix(ui): responsive hero banners and invoice row on mobile"
```

---

## Task 2: Fix Admin Billing Action Button Overflow

**Files:**
- Modify: `app/(dashboard)/admin/billing/page.tsx:316`
- Modify: `app/(dashboard)/admin/billing/page.tsx:469`

- [ ] **Step 1: Add flex-wrap to billing action buttons**

In `app/(dashboard)/admin/billing/page.tsx`, change line 316:

```tsx
// Before:
<div className="flex gap-2">

// After:
<div className="flex flex-wrap gap-2">
```

This wraps "Kirim Pengingat WA" / "Invoice Massal" / "Buat Invoice" to next line on narrow screens instead of overflowing.

- [ ] **Step 2: Shorten bulk invoice form button text**

In `app/(dashboard)/admin/billing/page.tsx`, change line 469:

```tsx
// Before:
{bulkSaving ? 'Membuat...' : '📦 Buat Invoice untuk Semua Siswa Aktif'}

// After:
{bulkSaving ? 'Membuat...' : '📦 Buat Invoice Massal'}
```

- [ ] **Step 3: Commit**

```bash
rtk git add app/\(dashboard\)/admin/billing/page.tsx
rtk git commit -m "fix(ui): wrap billing action buttons and shorten bulk form label"
```

---

## Task 3: Fix Analytics Tab Bar Overflow on Mobile

**Files:**
- Modify: `app/(dashboard)/admin/analytics/page.tsx:153-167`

Problem: 3 tabs with labels "📋 Absensi Siswa", "👩‍🏫 Performa Tutor", "📈 Progress Siswa" at `text-sm px-4` each = ~480px total → overflows 375px screen.

Fix: scrollable tab container + `shrink-0 whitespace-nowrap` on tabs.

- [ ] **Step 1: Make analytics tab bar horizontally scrollable**

In `app/(dashboard)/admin/analytics/page.tsx`, replace lines 153–167:

```tsx
// Before:
<div className="flex gap-2 border-b border-slate-200">
  {tabs.map((t) => (
    <button
      key={t.key}
      onClick={() => { setTab(t.key); setSearch('') }}
      className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
        tab === t.key
          ? 'border-indigo-500 text-indigo-600'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {t.emoji} {t.label}
    </button>
  ))}
</div>

// After:
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
```

Key changes:
- Container: `overflow-x-auto` (enables horizontal scroll when tabs don't fit)
- Tabs: `shrink-0 whitespace-nowrap` (prevents tabs from being squished/wrapped)
- Tabs: `px-3 sm:px-4 text-xs sm:text-sm` (slightly smaller on mobile to fit more)

- [ ] **Step 2: Commit**

```bash
rtk git add app/\(dashboard\)/admin/analytics/page.tsx
rtk git commit -m "fix(ui): scrollable analytics tab bar on mobile"
```

---

## Task 4: Fix Financial Report Summary Cards

**Files:**
- Modify: `app/(dashboard)/admin/financial-report/page.tsx:48-55`

Problem: `SummaryCard` renders `text-2xl` amount (e.g. "Rp 25.000.000") in a 2-column grid on mobile. The card is ~175px wide and `text-2xl` (24px) with `font-extrabold` makes it overflow or look cramped.

- [ ] **Step 1: Make SummaryCard amount text responsive**

In `app/(dashboard)/admin/financial-report/page.tsx`, replace the `SummaryCard` component (lines 45–55):

```tsx
// Before:
function SummaryCard({
  label, count, amount, colorClass,
}: { label: string; count: number; amount: number; colorClass: string }) {
  return (
    <div className={`rounded-2xl p-5 border shadow-xs ${colorClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-extrabold">{formatRupiah(amount)}</p>
      <p className="text-xs mt-1 opacity-60">{count} invoice</p>
    </div>
  )
}

// After:
function SummaryCard({
  label, count, amount, colorClass,
}: { label: string; count: number; amount: number; colorClass: string }) {
  return (
    <div className={`rounded-2xl p-4 sm:p-5 border shadow-xs ${colorClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-base sm:text-2xl font-extrabold leading-tight">{formatRupiah(amount)}</p>
      <p className="text-xs mt-1 opacity-60">{count} invoice</p>
    </div>
  )
}
```

Key changes:
- Padding: `p-4 sm:p-5` (less padding on mobile gives text more room)
- Amount: `text-base sm:text-2xl` (16px on mobile, 24px on tablet+)
- Added `leading-tight` so amount text doesn't appear too spaced if it wraps

- [ ] **Step 2: Commit**

```bash
rtk git add app/\(dashboard\)/admin/financial-report/page.tsx
rtk git commit -m "fix(ui): responsive summary card amount text on mobile"
```

---

## Task 5: Fix Admin Schedules Action Button Row

**Files:**
- Modify: `app/(dashboard)/admin/schedules/page.tsx:221`

- [ ] **Step 1: Add flex-wrap to schedules action buttons**

In `app/(dashboard)/admin/schedules/page.tsx`, change line 221:

```tsx
// Before:
<div className="flex gap-2">
  <button ... className="... px-4 py-2.5 ...">
    <Plus className="h-4 w-4" /> Buat Jadwal
  </button>
  <button ... className="... px-4 py-2.5 ...">
    <CalendarPlus className="h-4 w-4" /> Ambil dari Timetable
  </button>
</div>

// After:
<div className="flex flex-wrap gap-2">
  ...same buttons unchanged...
</div>
```

Only the container div class changes — add `flex-wrap`. No other changes.

- [ ] **Step 2: Commit**

```bash
rtk git add app/\(dashboard\)/admin/schedules/page.tsx
rtk git commit -m "fix(ui): wrap schedule action buttons on small screens"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Admin hero banner — Task 1
- [x] Parent hero banner — Task 1
- [x] Pending invoice row overflow — Task 1
- [x] Billing 3-button overflow — Task 2
- [x] Bulk invoice long button text — Task 2
- [x] Analytics tabs overflow — Task 3
- [x] Financial report card text — Task 4
- [x] Schedule button row — Task 5

**Placeholder scan:** All steps contain exact before/after code. No TBDs.

**Type consistency:** All changes are pure Tailwind class strings — no TypeScript types affected.

**Not touched (already responsive):**
- `DataTable` — has `overflow-x-auto` + `flex-col sm:flex-row` pagination; fine
- Parent billing invoice rows — `flex flex-col sm:flex-row sm:items-center`; fine
- Parent progress page — already uses `flex-col sm:flex-row`, `flex-wrap`; fine
- Timetable page header — already has `flex flex-wrap gap-2`; fine
- Admin reports page — card layout is `flex-col sm:flex-row`; fine
- Sidebar — mobile hamburger drawer is working correctly

---

## Execution Handoff

Plan saved. Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks

**2. Inline Execution** — Execute tasks in this session with checkpoints

Which approach?
