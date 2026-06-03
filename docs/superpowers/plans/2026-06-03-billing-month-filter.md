# Billing Page Month Filter — Bug Fix & Feature Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix invoice table showing wrong data (all history after create, then only 1 item after refresh) by making the client-side fetch consistently use the same month filter as SSR, and add a month/year picker so admins can browse past months.

**Architecture:** The bug is a SSR ↔ client mismatch. `page.tsx` SSR fetches invoices for the current month only; `BillingClient.fetchInvoices()` fetches ALL invoices with no filter. Fix: add `filterMonth` and `filterYear` state (defaulting to current month/year), pass as query params in `fetchInvoices`, render a month/year selector in the UI. SSR stays unchanged — it correctly pre-renders the current month's data which the client defaults to as well.

**Tech Stack:** Next.js 14 App Router, TypeScript, React, Tailwind CSS. API already supports `?month=X&year=Y` query params in `GET /api/invoices`.

---

## File Map

| File | Change |
|------|--------|
| `app/(dashboard)/admin/billing/BillingClient.tsx` | Add filterMonth/filterYear state, update fetchInvoices, add month/year selector UI |

No API changes needed — `app/api/invoices/route.ts` already handles month/year filtering.

---

## Task 1: Add Month/Year Filter State and Fix fetchInvoices

**Files:**
- Modify: `app/(dashboard)/admin/billing/BillingClient.tsx`

### Background

Current broken flow:
1. SSR in `page.tsx` fetches invoices where `createdAt >= start of current month` → passes as `initialInvoices`
2. On page load client shows only current month invoices ✅
3. Admin creates/edits invoice → `fetchInvoices()` called → `GET /api/invoices` (no filter) → ALL invoices returned → table shows everything ❌
4. Admin refreshes page → SSR reruns → current month filter applied again → only 1 item ❌

Fix: make `fetchInvoices()` always pass `?month=X&year=Y` and default to today's month/year.

- [ ] **Step 1: Add filterMonth and filterYear state**

  In `BillingClient.tsx`, after the existing state declarations (around line 53), add:

  ```typescript
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear())
  ```

- [ ] **Step 2: Update fetchInvoices to pass month/year filter**

  Replace the existing `fetchInvoices` callback:

  ```typescript
  // BEFORE:
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
  ```

  ```typescript
  // AFTER:
  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/invoices?month=${filterMonth}&year=${filterYear}`)
      setInvoices(await res.json())
    } catch {
      setError('Gagal memuat data tagihan.')
    } finally {
      setLoading(false)
    }
  }, [filterMonth, filterYear])
  ```

- [ ] **Step 3: Add useEffect to re-fetch when filter changes**

  After the `fetchInvoices` callback definition, add:

  ```typescript
  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])
  ```

  This ensures that whenever `filterMonth` or `filterYear` changes (which changes `fetchInvoices` identity via its deps), data refreshes automatically.

  Also add `useEffect` to the import at the top of the file:
  ```typescript
  import { useState, useCallback, useMemo, useEffect } from 'react'
  ```

- [ ] **Step 4: Build the month/year selector UI**

  In the return statement, find the header section (the div containing `💳 Tagihan & Invoice` heading and the action buttons). Add a filter row between the heading and the action buttons. The heading div looks like:

  ```tsx
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 className="text-2xl font-extrabold text-me-text">💳 Tagihan & Invoice</h1>
      <p className="text-sm text-me-muted mt-0.5">...</p>
    </div>
    <div className="flex flex-wrap gap-2">
      {/* action buttons */}
    </div>
  </div>
  ```

  Add this filter row **below** the heading div and **above** the error/feedback divs:

  ```tsx
  {/* Month/Year Filter */}
  <div className="flex items-center gap-3 flex-wrap">
    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Filter Bulan:</span>
    <select
      value={filterMonth}
      onChange={(e) => setFilterMonth(Number(e.target.value))}
      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
    >
      {[
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
      ].map((name, i) => (
        <option key={i + 1} value={i + 1}>{name}</option>
      ))}
    </select>
    <select
      value={filterYear}
      onChange={(e) => setFilterYear(Number(e.target.value))}
      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
    >
      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
    <span className="text-xs text-slate-400 dark:text-slate-500">
      {invoices.length} tagihan ditemukan
    </span>
  </div>
  ```

  The year select generates: [currentYear-2, currentYear-1, currentYear, currentYear+1, currentYear+2] — a 5-year window centered on the current year.

- [ ] **Step 5: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 6: Manual smoke test**

  1. Navigate to `/admin/billing` — verify it shows current month invoices only.
  2. Change month selector to a different month — verify table updates to show that month's invoices.
  3. Create a new invoice — verify table refreshes and still shows current month (not all history).
  4. Refresh the page — verify the filter resets to current month and shows same data as before refresh (SSR and client are now consistent).

- [ ] **Step 7: Commit**

  ```bash
  git add app/(dashboard)/admin/billing/BillingClient.tsx
  git commit -m "fix: billing page shows consistent data with month/year filter"
  ```

---

## Self-Review

### Spec coverage
- [x] Bug: after create → shows all data. Fixed by passing month/year in fetchInvoices
- [x] Bug: after refresh → only 1 item. Fixed by client defaulting to same current-month filter as SSR
- [x] UX: users can navigate to other months via selector
- [x] Year navigation covered by year select (5-year window)

### Placeholder scan
- No TBD, no vague steps — all code is concrete

### Type consistency
- `filterMonth: number`, `filterYear: number` used consistently throughout
- `useState<number>(new Date().getMonth() + 1)` — 1-indexed month, matches API which expects 1-indexed month (`parseInt(searchParams.get('month')!)`)

### Edge case: what if user is on a different month and creates invoice?
- `fetchInvoices()` re-runs with current `filterMonth/filterYear` — shows invoices for the selected month, which is correct. The new invoice may not appear if it was created in the "current calendar month" but the filter is set to a different month. This is expected and correct behavior.
