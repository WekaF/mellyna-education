# Bug Fixes Batch — June 2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 reported bugs and feature gaps across admin panels — multi-program selection, parent edit, icon visibility on mobile, duplicate class scheduling, billing edit, and dark mode blur.

**Architecture:** All changes are UI-only except Task 1 (API upgrade endpoint), Task 6 (API amount field), and Task 5 (client-side logic for class copy). No DB schema changes needed.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Prisma, Zod, `@tanstack/react-table`

---

## File Map

| Task | Files Modified |
|------|---------------|
| 1 | `app/api/program-enrollments/[id]/upgrade/route.ts`, `components/admin/ProgramEnrollmentModal.tsx` |
| 2 | `app/(dashboard)/admin/parents/ParentsClient.tsx` |
| 3 & 4 | `app/(dashboard)/admin/timetable/TimetableClient.tsx` |
| 5 | `app/(dashboard)/admin/timetable/TimetableClient.tsx` |
| 6 | `app/api/invoices/[id]/route.ts`, `app/(dashboard)/admin/billing/BillingClient.tsx` |
| 7 | `app/(dashboard)/layout.tsx` |

---

## Task 1: Multi-select Programs in Upgrade Modal

**Problem:** `ProgramEnrollmentModal` in 'upgrade' and 'add' modes only allows selecting one program. Superadmin wants to check multiple programs at once.

**Files:**
- Modify: `app/api/program-enrollments/[id]/upgrade/route.ts`
- Modify: `components/admin/ProgramEnrollmentModal.tsx`

- [ ] **Step 1: Update the upgrade API to accept multiple programs**

  Edit `app/api/program-enrollments/[id]/upgrade/route.ts`:

  ```typescript
  // Replace upgradeSchema with:
  const upgradeSchema = z.object({
    newPrograms: z.array(z.enum(['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH'])).min(1),
    notes: z.string().optional(),
  })

  // Replace the transaction block (lines 38-50) with:
  const [, ...newEnrollments] = await prisma.$transaction([
    prisma.programEnrollment.update({
      where: { id },
      data: { status: 'UPGRADED', endedAt: new Date(), notes: parsed.data.notes },
    }),
    ...parsed.data.newPrograms.map(program =>
      prisma.programEnrollment.create({
        data: { studentId: current.studentId, program, status: 'ACTIVE' },
      })
    ),
  ])

  return NextResponse.json(newEnrollments, { status: 201 })
  ```

- [ ] **Step 2: Update ProgramEnrollmentModal state from single to multi-select**

  In `components/admin/ProgramEnrollmentModal.tsx`, change line 41:

  ```typescript
  // Before:
  const [selectedProgram, setSelectedProgram] = useState<ProgramKey | null>(null)

  // After:
  const [selectedPrograms, setSelectedPrograms] = useState<ProgramKey[]>([])
  ```

  Update `handleClose` (line 109):
  ```typescript
  const handleClose = () => {
    setSelectedPrograms([])
    setNotes('')
    setError(null)
    onClose()
  }
  ```

- [ ] **Step 3: Update handleSubmit to send multiple programs**

  Replace the `handleSubmit` function body (lines 52-85) in `ProgramEnrollmentModal.tsx`:

  ```typescript
  const handleSubmit = async () => {
    if (selectedPrograms.length === 0) {
      setError('Pilih minimal satu program.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      let res: Response
      if (mode === 'assign' || mode === 'add') {
        // Create one enrollment per selected program sequentially
        for (const program of selectedPrograms) {
          res = await fetch('/api/program-enrollments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, program, notes: notes || undefined }),
          })
          if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || 'Terjadi kesalahan.')
          }
        }
      } else {
        res = await fetch(`/api/program-enrollments/${currentProgramEnrollmentId}/upgrade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPrograms: selectedPrograms, notes: notes || undefined }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Terjadi kesalahan.')
        }
      }
      handleClose()
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setLoading(false)
    }
  }
  ```

- [ ] **Step 4: Update program picker UI to toggle multi-select**

  In the program picker grid (lines 219-249), change the `onClick` and `isSelected` logic:

  ```tsx
  // Replace:
  const isSelected = selectedProgram === program
  // ...
  onClick={() => setSelectedProgram(program)}

  // With:
  const isSelected = selectedPrograms.includes(program)
  // ...
  onClick={() => {
    setSelectedPrograms(prev =>
      prev.includes(program)
        ? prev.filter(p => p !== program)
        : [...prev, program]
    )
  }}
  ```

  Update the submit button disabled condition (line 278):
  ```tsx
  // Before:
  disabled={loading || !selectedProgram}
  // After:
  disabled={loading || selectedPrograms.length === 0}
  ```

- [ ] **Step 5: Verify manually**

  Open admin → Parents, click a student's program badge → "Kelola Program" modal. Verify you can select multiple programs. Submit and check the DB has multiple ACTIVE enrollments.

- [ ] **Step 6: Commit**

  ```bash
  git add app/api/program-enrollments/[id]/upgrade/route.ts components/admin/ProgramEnrollmentModal.tsx
  git commit -m "feat: allow multi-select programs in enrollment/upgrade modal"
  ```

---

## Task 2: Fix Parent Email Edit in Admin Panel

**Problem:** Editing parent email in the admin Parents page doesn't save. Investigation needed: the `handleEditSave` function builds `{ name, email, phone }` and calls `PUT /api/users/{id}`. The API at `app/api/users/[id]/route.ts` accepts and validates email. The suspected issue is the edit modal z-index conflict with the student analytics drawer when both are open simultaneously, or a subtle form validation error.

**Files:**
- Modify: `app/(dashboard)/admin/parents/ParentsClient.tsx`

- [ ] **Step 1: Add debug logging to identify the failure**

  Temporarily add a `console.error` in `handleEditSave` in `ParentsClient.tsx` to capture what error is returned:

  ```typescript
  // In handleEditSave, around line 266, change:
  const data = await res.json()
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Gagal memperbarui data.')

  // To (temporarily):
  const data = await res.json()
  console.error('[EditParent] API response:', res.status, data)
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data))
  ```

  Test and check browser console to see exact error.

- [ ] **Step 2: Fix z-index — ensure edit modal renders above the analytics drawer**

  The analytics drawer has `z-50`. The edit modal is also `z-50`, which means they conflict. Raise edit modal to `z-[60]`:

  In `ParentsClient.tsx` at the edit modal wrapper (around line 1335):

  ```tsx
  // Before:
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setEditingParent(null)} />

  // After:
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setEditingParent(null)} />
  ```

  Also raise the `addStudentForParent` modal from `z-50` to `z-[60]` (around line 1425):
  ```tsx
  // Before:
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs"
  // After:
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs"
  ```

- [ ] **Step 3: Ensure email field pre-fills and is editable**

  Verify `handleStartEdit` (line 212) correctly initializes `editForm.email = parent.email`. The email input field at line 1373 uses `type="email"` which is correct.

  If the form isn't pre-filling, there may be a stale closure. Ensure the email input `value` uses `editForm.email` (already correct at line 1374).

- [ ] **Step 4: Remove temporary debug logging added in Step 1**

  Remove the `console.error` added in Step 1.

- [ ] **Step 5: Test edit flow**

  Open admin → Parents, click "Edit" on any parent. Change the email, submit, verify change persists on page reload.

- [ ] **Step 6: Commit**

  ```bash
  git add app/(dashboard)/admin/parents/ParentsClient.tsx
  git commit -m "fix: raise edit parent modal z-index above analytics drawer"
  ```

---

## Task 3 & 4: Make Timetable Class Icons Always Visible (Not Hover-Only)

**Problem:** In `TimetableClient.tsx`, the class card action buttons (Edit pencil icon + Users "Kelola Siswa" icon) are inside `opacity-0 group-hover/card:opacity-100` — they're invisible by default and only appear on hover. On touch devices (mobile/tablet), hover never fires, so these buttons are permanently inaccessible.

Additionally, the "Kelola Siswa" (manage students) button should always be visible.

**Files:**
- Modify: `app/(dashboard)/admin/timetable/TimetableClient.tsx`

- [ ] **Step 1: Make action icons always visible in the class card**

  In `TimetableClient.tsx` at lines 606-626, change the action buttons div:

  ```tsx
  // Before (line 606):
  <div className="flex opacity-0 group-hover/card:opacity-100 transition-opacity gap-1">

  // After:
  <div className="flex gap-1">
  ```

  This removes the hover-only visibility so both the Edit and Users buttons are always shown.

- [ ] **Step 2: Make "Kelola Siswa" count badge always clickable**

  The current "👥 Siswa" count at lines 635-640 shows enrollment count but isn't clickable. Make it a button that opens the enrollment modal:

  ```tsx
  // Before (lines 635-640):
  <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px]">
    <span className="text-slate-400 dark:text-slate-500 font-medium">👥 Siswa</span>
    <span className="font-bold text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30">
      {cls.enrollments.length}
    </span>
  </div>

  // After:
  <button
    onClick={() => {
      setEnrollClass(cls)
      setStudentSearch('')
      setEnrollError(null)
      setShowEnrollModal(true)
    }}
    className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px] w-full cursor-pointer hover:opacity-80 transition-opacity"
  >
    <span className="text-slate-400 dark:text-slate-500 font-medium">👥 Kelola Siswa</span>
    <span className="font-bold text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30">
      {cls.enrollments.length}
    </span>
  </button>
  ```

  This makes the enrollment count row clickable and labels it "Kelola Siswa" so it's discoverable.

- [ ] **Step 3: Remove redundant Users icon button (since count row is now clickable)**

  Since the "👥 Kelola Siswa" row is now a button, the separate Users icon button is redundant. Remove it from lines 614-626:

  ```tsx
  // Remove this block entirely:
  <button
    onClick={() => {
      setEnrollClass(cls)
      setStudentSearch('')
      setEnrollError(null)
      setShowEnrollModal(true)
    }}
    title="Kelola Siswa"
    className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors cursor-pointer"
  >
    <Users className="h-2.5 w-2.5" />
  </button>
  ```

  Keep only the Edit (pencil) icon button.

- [ ] **Step 4: Verify on simulated mobile**

  Open timetable in browser DevTools → toggle mobile viewport. Verify edit button and "Kelola Siswa" row are both visible and tappable without hover.

- [ ] **Step 5: Commit**

  ```bash
  git add app/(dashboard)/admin/timetable/TimetableClient.tsx
  git commit -m "fix: make timetable class card actions always visible (not hover-only)"
  ```

---

## Task 5: Allow Same Class Name on Multiple Day/Time Slots

**Problem:** Each `Class` DB record has a single `dayOfWeek + timeSlot`. When superadmin tries to schedule "Orchid" on Monday 11:00 AND Tuesday 11:00 via "Hubungkan Kelas yang Ada" (select existing), it overwrites the Monday slot instead of creating a second session.

**Fix approach:** When an already-scheduled class is selected via the "select existing" mode AND the selected day/time differs from the existing slot, CREATE a new class record (POST) rather than updating (PUT). This preserves the original slot and adds a new session.

**Files:**
- Modify: `app/(dashboard)/admin/timetable/TimetableClient.tsx`

- [ ] **Step 1: Detect slot conflict in handleSaveClass**

  In `TimetableClient.tsx`, find `handleSaveClass` (around line 303). Replace the `mode === 'select'` branch:

  ```typescript
  // Before (lines 316-325):
  } else if (mode === 'select' && selectedExistingClassId) {
    // Scheduling an existing class
    res = await fetch(`/api/classes/${selectedExistingClassId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dayOfWeek: classForm.dayOfWeek,
        timeSlot: classForm.timeSlot,
      }),
    })

  // After:
  } else if (mode === 'select' && selectedExistingClassId) {
    const existingClass = classes.find(c => c.id === selectedExistingClassId)
    const alreadyScheduled = existingClass?.dayOfWeek !== null && existingClass?.dayOfWeek !== undefined

    if (alreadyScheduled) {
      // Class already has a slot → create a new session with same properties but new slot
      res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: classForm.name,
          programs: classForm.programs,
          tutorId: classForm.tutorId,
          additionalTutorIds: classForm.additionalTutorIds,
          description: classForm.description,
          dayOfWeek: classForm.dayOfWeek,
          timeSlot: classForm.timeSlot,
        }),
      })
    } else {
      // Class not yet scheduled → assign slot to existing class
      res = await fetch(`/api/classes/${selectedExistingClassId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek: classForm.dayOfWeek,
          timeSlot: classForm.timeSlot,
        }),
      })
    }
  ```

- [ ] **Step 2: Show user feedback when a copy is created**

  Update the success message after `handleSaveClass` succeeds:

  ```typescript
  // Change line 340:
  setSuccessMsg(`Sesi kelas berhasil disimpan ke Timetable!`)

  // To (inside the select-existing branch):
  const existingClass = classes.find(c => c.id === selectedExistingClassId)
  const wasCopied = mode === 'select' && existingClass?.dayOfWeek !== null

  setSuccessMsg(
    wasCopied
      ? `Sesi baru "${classForm.name}" berhasil dibuat untuk ${classForm.dayOfWeek} ${classForm.timeSlot}! (Sesi asli di slot lama tetap ada)`
      : `Sesi kelas berhasil disimpan ke Timetable!`
  )
  ```

  Actually keep the logic simpler — just use a generic message since the existing `setSuccessMsg` call is after all branches:

  ```typescript
  // In handleSaveClass, track whether a copy was made:
  let wasCopy = false

  // ... in the select branch:
  if (alreadyScheduled) {
    wasCopy = true
    res = await fetch('/api/classes', { ... })
  }

  // After fetchData():
  setSuccessMsg(
    wasCopy
      ? `Sesi baru "${classForm.name}" berhasil ditambahkan ke slot ${classForm.dayOfWeek} ${classForm.timeSlot}!`
      : `Sesi kelas berhasil disimpan ke Timetable!`
  )
  ```

- [ ] **Step 3: Update the select dropdown to show copy warning**

  In the dropdown option label (around line 775-779), add "(Akan duplikat)" indicator when a class already has a slot:

  ```tsx
  // Before:
  {c.dayOfWeek
    ? `(Aktif: ${DAYS.find(d => d.key === c.dayOfWeek)?.label || c.dayOfWeek} ${c.timeSlot})`
    : '(Belum Terjadwal)'}

  // After:
  {c.dayOfWeek
    ? `(Aktif: ${DAYS.find(d => d.key === c.dayOfWeek)?.label || c.dayOfWeek} ${c.timeSlot} → akan buat sesi baru)`
    : '(Belum Terjadwal)'}
  ```

- [ ] **Step 4: Test the scenario**

  1. Create a class "Orchid" and schedule it Monday 11:00.
  2. Click "+" on Tuesday 11:00 → select "Orchid" → save.
  3. Verify BOTH Monday 11:00 Orchid and Tuesday 11:00 Orchid appear on the grid.
  4. Verify Monday 11:00 slot is NOT overwritten.

- [ ] **Step 5: Commit**

  ```bash
  git add app/(dashboard)/admin/timetable/TimetableClient.tsx
  git commit -m "feat: create new class session when same class assigned to second slot"
  ```

---

## Task 6: Add Edit Billing + Fix Invoice Table Missing Data

**Problem A:** No edit button for invoices in the admin billing table. The API `PUT /api/invoices/[id]` supports `description` and `dueDate` but NOT `amount`. We need to add `amount` to the API and add an edit modal to the UI.

**Problem B:** Invoice table shows only 10 rows by default (DataTable `defaultPageSize=10`). Users don't see all invoices. Fix: pass `defaultPageSize={50}` to the billing DataTable.

**Files:**
- Modify: `app/api/invoices/[id]/route.ts`
- Modify: `app/(dashboard)/admin/billing/BillingClient.tsx`

- [ ] **Step 1: Add `amount` to the invoice update API schema**

  In `app/api/invoices/[id]/route.ts`, update `updateInvoiceSchema`:

  ```typescript
  // Before:
  const updateInvoiceSchema = z.object({
    status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
    description: z.string().optional(),
    dueDate: z.string().optional(),
  })

  // After:
  const updateInvoiceSchema = z.object({
    status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
    description: z.string().min(1).optional(),
    dueDate: z.string().optional(),
    amount: z.number().int().positive().optional(),
  })
  ```

  Update the PUT handler to include `amount` in the update (lines 43-47):

  ```typescript
  // Before:
  const { dueDate, ...rest } = parsed.data
  const invoice = await prisma.invoice.update({
    where: { id },
    data: { ...rest, ...(dueDate ? { dueDate: new Date(dueDate) } : {}) },
  })

  // After (no change needed — `amount` will be in `rest` and passed through):
  const { dueDate, ...rest } = parsed.data
  const invoice = await prisma.invoice.update({
    where: { id },
    data: { ...rest, ...(dueDate ? { dueDate: new Date(dueDate) } : {}) },
    include: { student: { select: { name: true } } },
  })
  ```

- [ ] **Step 2: Add edit state to BillingClient**

  In `BillingClient.tsx`, add edit modal state after the `manualSaving` state (around line 51):

  ```typescript
  const [editModal, setEditModal] = useState<{
    invoiceId: string
    studentName: string
    description: string
    amount: string
    dueDate: string
  } | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  ```

- [ ] **Step 3: Add handleEditInvoice function**

  Add this function after `handleManualPay` in `BillingClient.tsx`:

  ```typescript
  const handleEditInvoice = useCallback(async () => {
    if (!editModal) return
    setError(null)
    setEditSaving(true)
    try {
      const res = await fetch(`/api/invoices/${editModal.invoiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editModal.description,
          amount: parseInt(editModal.amount),
          dueDate: editModal.dueDate,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal mengubah invoice.')
      }
      setEditModal(null)
      await fetchInvoices()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setEditSaving(false)
    }
  }, [editModal, fetchInvoices])
  ```

- [ ] **Step 4: Add Edit button to the actions column**

  In the `columns` definition, inside the `actions` cell (around line 244), add an Edit button before the existing "Tandai Lunas" button:

  ```tsx
  // Add before line 244:
  <button
    onClick={() => setEditModal({
      invoiceId: inv.id,
      studentName: inv.student.name,
      description: inv.description,
      amount: String(inv.amount),
      dueDate: new Date(inv.dueDate).toISOString().split('T')[0],
    })}
    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
  >
    Edit
  </button>
  ```

  Also add `editModal` to the `useMemo` dependency array (last line of useMemo).

- [ ] **Step 5: Add edit modal JSX to the return statement**

  Add before the closing `</div>` in the return statement:

  ```tsx
  {editModal && (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="font-bold text-slate-800 dark:text-white mb-1">✏️ Edit Invoice</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Siswa: <strong>{editModal.studentName}</strong></p>

        {error && (
          <div className="mb-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 p-3 text-xs text-rose-600">{error}</div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Keterangan *</label>
            <input
              type="text"
              value={editModal.description}
              onChange={(e) => setEditModal({ ...editModal, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nominal (Rp) *</label>
            <input
              type="number"
              value={editModal.amount}
              onChange={(e) => setEditModal({ ...editModal, amount: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Jatuh Tempo *</label>
            <input
              type="date"
              value={editModal.dueDate}
              onChange={(e) => setEditModal({ ...editModal, dueDate: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
          <button
            onClick={() => setEditModal(null)}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handleEditInvoice}
            disabled={editSaving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs transition-all cursor-pointer"
          >
            {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  )}
  ```

- [ ] **Step 6: Fix invoice table showing only 10 rows**

  Find the DataTable in `BillingClient.tsx` (in the return statement, search for `<DataTable`). Add `defaultPageSize={50}`:

  ```tsx
  // Before:
  <DataTable
    columns={columns}
    data={invoices}
    loading={loading}
    ...
  />

  // After:
  <DataTable
    columns={columns}
    data={invoices}
    loading={loading}
    defaultPageSize={50}
    ...
  />
  ```

- [ ] **Step 7: Test edit and pagination**

  1. Open admin → Billing. Verify table shows up to 50 rows per page.
  2. Click "Edit" on any invoice. Change description/amount/dueDate, save. Verify changes reflect in the table.
  3. Verify Hapus and Cancel buttons still work.

- [ ] **Step 8: Commit**

  ```bash
  git add app/api/invoices/[id]/route.ts app/(dashboard)/admin/billing/BillingClient.tsx
  git commit -m "feat: add edit invoice modal and fix table pagination (50 rows/page)"
  ```

---

## Task 7: Fix Dark Mode Blur on Mobile/Tablet

**Problem:** In dark mode on mobile/tablet, the page header and table areas (timetable, release table, etc.) appear blurry. Root cause: the dashboard layout `<header>` uses `backdrop-blur-md` with a semi-transparent dark background (`dark:bg-[#151f32]/45`). On some mobile/tablet browsers (especially iOS Safari), `backdrop-filter: blur()` on a `position: sticky` element creates a GPU compositing layer that causes sibling/child content to render blurry.

**Fix:** Remove `backdrop-blur-md` from the sticky header and use a near-opaque dark background instead. This eliminates the frosted glass effect but fixes the rendering bug.

**Files:**
- Modify: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Make the layout header use opaque background (remove blur)**

  In `app/(dashboard)/layout.tsx` at line 40:

  ```tsx
  // Before:
  <header className="hidden md:flex items-center justify-between px-8 py-5 border-b border-slate-200 dark:border-slate-800/60 bg-white/45 dark:bg-[#151f32]/45 backdrop-blur-md sticky top-0 z-30 transition-all duration-300">

  // After:
  <header className="hidden md:flex items-center justify-between px-8 py-5 border-b border-slate-200 dark:border-slate-800/60 bg-white/95 dark:bg-[#151f32]/95 backdrop-blur-sm sticky top-0 z-30 transition-all duration-300">
  ```

  Changes:
  - `bg-white/45` → `bg-white/95` (more opaque in light mode)
  - `dark:bg-[#151f32]/45` → `dark:bg-[#151f32]/95` (near-opaque in dark mode eliminates the bleed-through that activates strong blur)
  - `backdrop-blur-md` → `backdrop-blur-sm` (lighter blur, less GPU compositing overhead)

- [ ] **Step 2: Add transform hint to prevent compositing leak**

  Also add `isolate` class to the main content area to create a stacking context that prevents the header's backdrop filter from affecting child content:

  ```tsx
  // In layout.tsx, find the main content wrapper (line 38):
  // Before:
  <div className="md:pl-64 lg:pl-72 flex flex-col min-h-screen transition-all duration-300">

  // After:
  <div className="md:pl-64 lg:pl-72 flex flex-col min-h-screen transition-all duration-300 isolate">
  ```

  The Tailwind `isolate` class adds `isolation: isolate` which creates a new stacking context for the content area, preventing backdrop-filter compositing from the header leaking down.

- [ ] **Step 3: Test on mobile/tablet viewport in dark mode**

  1. Open browser DevTools → toggle mobile viewport (375px width or similar).
  2. Enable dark mode (via ThemeToggle button).
  3. Navigate to Timetable page and Release Schedules page.
  4. Verify table content is NOT blurry.
  5. Scroll the page — verify header frosting looks acceptable.

- [ ] **Step 4: Commit**

  ```bash
  git add app/(dashboard)/layout.tsx
  git commit -m "fix: reduce backdrop-blur on sticky header to fix dark mode blur on mobile"
  ```

---

## Self-Review Checklist

### Spec Coverage
- [x] Task 1: Multi-select upgrade modal — covered
- [x] Task 2: Parent email edit fix — covered (z-index + debug flow)
- [x] Task 3: Schedule → class icon not clickable — covered in Task 3&4 (same root cause as timetable)
- [x] Task 4: Timetable icon not clickable + always-visible manage students — covered
- [x] Task 5: Same class multiple slots — covered via CREATE copy
- [x] Task 6: Edit billing + invoice missing data — both covered
- [x] Task 7: Dark mode blur bug — covered

### Type Consistency
- `selectedPrograms: ProgramKey[]` consistent across ProgramEnrollmentModal
- `newPrograms: string[]` in upgrade API schema — consistent with what modal sends
- `editModal` state fields (`amount: string`) consistent with the input `onChange`

### Placeholders Scan
- No TBD or TODO markers in plan — all steps have actual code
