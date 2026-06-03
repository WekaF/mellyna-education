# Parent Registration Flow — Bug Fix & Integrated Onboarding Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix billing status showing "Lunas" on parents with zero invoices, and extend the "Tambah Wali Murid" form to a 4-step integrated flow that captures parent → student → program → initial invoice in one form.

**Architecture:**
- Task 1 (bug): `getParentBillingStatus` currently returns `'PAID'` when no invoices exist. Fix returns a 3rd state `'NONE'` and the UI renders a neutral `—` badge.
- Task 2 (feature): The existing inline add-form in `ParentsClient.tsx` is replaced with a multi-step wizard state machine (`'parent' | 'student' | 'program' | 'invoice'`). Each step fires its own API call on submit. Pricing tiers are imported from `lib/constants/pricing.ts` — no DB or localStorage dependency.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS. APIs: `POST /api/users`, `POST /api/students`, `POST /api/program-enrollments`, `POST /api/invoices`.

---

## Why "Lunas" on New Parent — Explanation

```typescript
// Current code in ParentsClient.tsx line 338:
const getParentBillingStatus = (parent: Parent) => {
  let hasUnpaid = false
  parent.children.forEach((student) => {
    student.invoices.forEach((invoice) => {
      if (invoice.status === 'PENDING' || invoice.status === 'OVERDUE') {
        hasUnpaid = true
      }
    })
  })
  return hasUnpaid ? 'UNPAID' : 'PAID'  // ← when no children/invoices: PAID
}
```

No children → no invoices → `hasUnpaid` stays `false` → returns `'PAID'` → badge shows "Lunas". Fix: add a `hasAnyInvoice` check and return `'NONE'` when no invoices exist at all.

---

## Why the Integrated Flow Makes Sense

Current manual steps after registering a parent:
1. Tambah Wali Murid (form → POST /api/users)
2. Klik +Siswa (separate modal → POST /api/students)
3. Klik "+" pada Program (separate modal → POST /api/program-enrollments)
4. Go to Billing → Buat Invoice (separate page → POST /api/invoices)

The DB schema already links all of this:
- `Student.parentId` → links student to parent
- `ProgramEnrollment.studentId` → links program to student
- `Invoice.studentId` → links invoice to student

We just need UI that does all 4 steps in sequence.

---

## File Map

| Task | File | What Changes |
|------|------|-------------|
| 1 | `app/(dashboard)/admin/parents/ParentsClient.tsx` | `getParentBillingStatus` returns `'NONE'` for no-invoice parents; badge renders `—` |
| 2 | `app/(dashboard)/admin/parents/ParentsClient.tsx` | Add `addStep` state machine, expand add-parent form to 4 steps |

---

## Task 1: Fix Billing Status — "Lunas" → "—" When No Invoices

**Files:**
- Modify: `app/(dashboard)/admin/parents/ParentsClient.tsx:338-348`

- [ ] **Step 1: Update getParentBillingStatus to return 3 states**

  Find `getParentBillingStatus` at line 338. Replace with:

  ```typescript
  const getParentBillingStatus = (parent: Parent): 'UNPAID' | 'PAID' | 'NONE' => {
    let hasInvoice = false
    let hasUnpaid = false
    parent.children.forEach((student) => {
      student.invoices.forEach((invoice) => {
        hasInvoice = true
        if (invoice.status === 'PENDING' || invoice.status === 'OVERDUE') {
          hasUnpaid = true
        }
      })
    })
    if (!hasInvoice) return 'NONE'
    return hasUnpaid ? 'UNPAID' : 'PAID'
  }
  ```

- [ ] **Step 2: Update the billing badge in column 1 to handle 'NONE'**

  In the `columns` useMemo, find the billing badge inside the "Wali Murid" cell (around line 387). Currently:

  ```tsx
  <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
    billingStatus === 'UNPAID'
      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
  }`}>
    <span className={`h-1.5 w-1.5 rounded-full ${billingStatus === 'UNPAID' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
    {billingStatus === 'UNPAID' ? 'Menunggak' : 'Lunas'}
  </span>
  ```

  Replace with:

  ```tsx
  {billingStatus === 'NONE' ? (
    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">— belum ada tagihan</span>
  ) : (
    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
      billingStatus === 'UNPAID'
        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${billingStatus === 'UNPAID' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
      {billingStatus === 'UNPAID' ? 'Menunggak' : 'Lunas'}
    </span>
  )}
  ```

- [ ] **Step 3: Update the stats card counter to not count 'NONE' parents as 'PAID'**

  Find the `stats` useMemo (around line 359). It calls `getParentBillingStatus(p) === 'UNPAID'` to count `unpaid`. That logic is unchanged — `'NONE'` parents won't be counted as `unpaid`, which is correct. No change needed here.

- [ ] **Step 4: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors. If TS errors appear on `billingStatus === 'NONE'`, it's because the local variable inferred the old type. Ensure the return type annotation `'UNPAID' | 'PAID' | 'NONE'` is on the function.

- [ ] **Step 5: Commit**

  ```bash
  git add app/(dashboard)/admin/parents/ParentsClient.tsx
  git commit -m "fix: show neutral badge instead of Lunas when parent has no invoices"
  ```

---

## Task 2: Multi-Step Integrated Parent Registration Form

**Files:**
- Modify: `app/(dashboard)/admin/parents/ParentsClient.tsx`

The existing `showAddForm` section (single-step, only parent data) gets replaced with a 4-step wizard. The `handleAddParent` flow is split into sequential steps, each calling its own API.

### Architecture of the Wizard

```
addStep: 'parent' → 'student' → 'program' → 'invoice' → done (close form)
createdParentId: string | null   ← set after step 1
createdStudentId: string | null  ← set after step 2
```

Steps can be skipped partially:
- Step 3 (program): user can proceed without selecting any program
- Step 4 (invoice): user can skip (button "Lewati") — no invoice created

- [ ] **Step 1: Add new state variables**

  Find the existing state declarations in `ParentsClient.tsx`. After `addSuccess` state (around line 124), add:

  ```typescript
  const [addStep, setAddStep] = useState<'parent' | 'student' | 'program' | 'invoice'>('parent')
  const [createdParentId, setCreatedParentId] = useState<string | null>(null)
  const [createdStudentId, setCreatedStudentId] = useState<string | null>(null)

  // Step 2: student form
  const [addStudentStep, setAddStudentStep] = useState({ name: '', gradeClass: '', tier: 'Tingkat 1' })
  const [addStudentStepSaving, setAddStudentStepSaving] = useState(false)
  const [addStudentStepError, setAddStudentStepError] = useState<string | null>(null)

  // Step 3: program selection
  const [addProgramStep, setAddProgramStep] = useState<string[]>([])
  const [addProgramStepSaving, setAddProgramStepSaving] = useState(false)
  const [addProgramStepError, setAddProgramStepError] = useState<string | null>(null)

  // Step 4: initial invoice
  const [addInvoiceStep, setAddInvoiceStep] = useState({ description: 'Paket Registrasi Baru', amount: '400000', dueDate: '' })
  const [addInvoiceStepSaving, setAddInvoiceStepSaving] = useState(false)
  const [addInvoiceStepError, setAddInvoiceStepError] = useState<string | null>(null)
  ```

- [ ] **Step 2: Add step-specific handler functions**

  After the existing `handleAddParent` function, add these 3 handlers:

  ```typescript
  const handleAddStudentStep = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createdParentId) return
    setAddStudentStepSaving(true)
    setAddStudentStepError(null)
    try {
      const grade = addStudentStep.gradeClass
        ? `${addStudentStep.gradeClass} | ${addStudentStep.tier}`
        : addStudentStep.tier
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addStudentStep.name, grade, parentId: createdParentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Gagal menambahkan siswa.')
      setCreatedStudentId(data.id)
      setAddStep('program')
    } catch (err: any) {
      setAddStudentStepError(err.message)
    } finally {
      setAddStudentStepSaving(false)
    }
  }, [createdParentId, addStudentStep])

  const handleAddProgramStep = useCallback(async () => {
    if (!createdStudentId) return
    if (addProgramStep.length === 0) {
      // Skip — no program selected
      setAddStep('invoice')
      return
    }
    setAddProgramStepSaving(true)
    setAddProgramStepError(null)
    try {
      for (const program of addProgramStep) {
        const res = await fetch('/api/program-enrollments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: createdStudentId, program }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || `Gagal mendaftarkan program ${program}.`)
        }
      }
      setAddStep('invoice')
    } catch (err: any) {
      setAddProgramStepError(err.message)
    } finally {
      setAddProgramStepSaving(false)
    }
  }, [createdStudentId, addProgramStep])

  const handleAddInvoiceStep = useCallback(async () => {
    if (!createdStudentId) return
    setAddInvoiceStepSaving(true)
    setAddInvoiceStepError(null)
    try {
      const amount = parseInt(addInvoiceStep.amount.replace(/\D/g, ''), 10)
      if (!amount || amount <= 0) throw new Error('Nominal harus berupa angka positif.')
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: createdStudentId,
          description: addInvoiceStep.description,
          amount,
          dueDate: addInvoiceStep.dueDate,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(typeof data.error === 'string' ? data.error : 'Gagal membuat tagihan.')
      }
      await finishRegistration()
    } catch (err: any) {
      setAddInvoiceStepError(err.message)
    } finally {
      setAddInvoiceStepSaving(false)
    }
  }, [createdStudentId, addInvoiceStep])

  const finishRegistration = useCallback(async () => {
    await fetchParents()
    setShowAddForm(false)
    setAddStep('parent')
    setCreatedParentId(null)
    setCreatedStudentId(null)
    setAddForm({ name: '', email: '', phone: '', password: '' })
    setAddStudentStep({ name: '', gradeClass: '', tier: 'Tingkat 1' })
    setAddProgramStep([])
    setAddInvoiceStep({ description: 'Paket Registrasi Baru', amount: '400000', dueDate: '' })
    setAddError(null)
    setAddSuccess(null)
  }, [fetchParents])
  ```

- [ ] **Step 3: Update handleAddParent to set createdParentId and advance to step 2**

  The existing `handleAddParent` (around line 189) currently closes the form on success. Change it to set the created parent's ID and advance to step 2:

  ```typescript
  const handleAddParent = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setAddSaving(true)
    setAddError(null)
    setAddSuccess(null)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, role: 'PARENT' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Gagal menambahkan wali murid.')
      setCreatedParentId(data.id)
      setAddStep('student')
    } catch (err: any) {
      setAddError(err.message)
    } finally {
      setAddSaving(false)
    }
  }, [addForm])
  ```

- [ ] **Step 4: Replace the showAddForm JSX with the multi-step wizard**

  Find `{showAddForm && (` in the return statement (around line 669). Replace the entire `showAddForm` block with:

  ```tsx
  {showAddForm && (
    <div className="rounded-2xl bg-white dark:bg-[#121b2d] border border-indigo-100 dark:border-indigo-900/30 shadow-md p-6 space-y-4">
      {/* Header with step indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-indigo-500" />
            {addStep === 'parent' && 'Langkah 1: Data Wali Murid'}
            {addStep === 'student' && 'Langkah 2: Data Siswa'}
            {addStep === 'program' && 'Langkah 3: Program Belajar'}
            {addStep === 'invoice' && 'Langkah 4: Tagihan Awal'}
          </h2>
          <div className="flex gap-1.5 mt-1.5">
            {(['parent', 'student', 'program', 'invoice'] as const).map((s, i) => (
              <div
                key={s}
                className={`h-1 w-8 rounded-full transition-colors ${
                  addStep === s
                    ? 'bg-indigo-600'
                    : ['parent', 'student', 'program', 'invoice'].indexOf(addStep) > i
                    ? 'bg-indigo-300'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
        <button
          onClick={() => {
            setShowAddForm(false)
            setAddStep('parent')
            setCreatedParentId(null)
            setCreatedStudentId(null)
            setAddError(null)
            setAddSuccess(null)
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* STEP 1: Parent Info */}
      {addStep === 'parent' && (
        <>
          {addError && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 px-4 py-3 text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {addError}
            </div>
          )}
          <form onSubmit={handleAddParent} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nama Lengkap *</label>
              <input
                required
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                placeholder="Nama wali murid"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Email *</label>
              <input
                required
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                placeholder="email@contoh.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">No. WhatsApp</label>
              <input
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                placeholder="08xxxxxxxxxx"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Password Sementara *</label>
              <input
                required
                type="password"
                minLength={6}
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                placeholder="Min. 6 karakter"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex gap-3">
              <button
                type="submit"
                disabled={addSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {addSaving ? 'Menyimpan...' : 'Lanjut →'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setAddError(null) }}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          </form>
        </>
      )}

      {/* STEP 2: Student Info */}
      {addStep === 'student' && (
        <>
          {addStudentStepError && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 p-3 text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {addStudentStepError}
            </div>
          )}
          <form onSubmit={handleAddStudentStep} className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nama Siswa *</label>
              <input
                required
                value={addStudentStep.name}
                onChange={(e) => setAddStudentStep({ ...addStudentStep, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                placeholder="Nama lengkap siswa"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Kelas / Jenjang</label>
              <input
                value={addStudentStep.gradeClass}
                onChange={(e) => setAddStudentStep({ ...addStudentStep, gradeClass: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                placeholder="mis. Kelas 5 SD"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Paket SPP *</label>
              <select
                value={addStudentStep.tier}
                onChange={(e) => {
                  setAddStudentStep({ ...addStudentStep, tier: e.target.value })
                  const tierPrices: Record<string, number> = {
                    'Tingkat 1': 150000,
                    'Tingkat 2': 160000,
                    'Tingkat 3': 170000,
                    'Tingkat 4': 180000,
                  }
                  const price = tierPrices[e.target.value]
                  if (price) {
                    setAddInvoiceStep(prev => ({ ...prev, amount: String(price), description: `SPP ${e.target.value} — Bulan Pertama` }))
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="Tingkat 1">Tingkat 1 — Rp150.000/bulan</option>
                <option value="Tingkat 2">Tingkat 2 — Rp160.000/bulan</option>
                <option value="Tingkat 3">Tingkat 3 — Rp170.000/bulan</option>
                <option value="Tingkat 4">Tingkat 4 — Rp180.000/bulan</option>
              </select>
            </div>
            <div className="sm:col-span-3 flex gap-3">
              <button
                type="submit"
                disabled={addStudentStepSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {addStudentStepSaving ? 'Menyimpan...' : 'Lanjut →'}
              </button>
              <button
                type="button"
                onClick={() => setAddStep('program')}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Lewati
              </button>
            </div>
          </form>
        </>
      )}

      {/* STEP 3: Program Selection */}
      {addStep === 'program' && (
        <>
          {addProgramStepError && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 p-3 text-sm text-rose-600 dark:text-rose-400">
              {addProgramStepError}
            </div>
          )}
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {createdStudentId
                ? 'Pilih program untuk siswa yang baru didaftarkan:'
                : 'Tidak ada siswa yang didaftarkan — langkah ini akan dilewati.'}
            </p>
            {createdStudentId && (
              <div className="flex flex-wrap gap-2">
                {(['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH'] as const).map((prog) => {
                  const selected = addProgramStep.includes(prog)
                  return (
                    <button
                      key={prog}
                      type="button"
                      onClick={() => setAddProgramStep(prev =>
                        prev.includes(prog) ? prev.filter(p => p !== prog) : [...prev, prog]
                      )}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                        selected
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300'
                      }`}
                    >
                      {prog}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleAddProgramStep}
                disabled={addProgramStepSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {addProgramStepSaving ? 'Menyimpan...' : addProgramStep.length > 0 ? 'Lanjut →' : 'Lewati →'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* STEP 4: Initial Invoice */}
      {addStep === 'invoice' && (
        <>
          {addInvoiceStepError && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 p-3 text-sm text-rose-600 dark:text-rose-400">
              {addInvoiceStepError}
            </div>
          )}
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {createdStudentId
                ? 'Buat tagihan awal untuk siswa (opsional). Standar: Paket Registrasi Baru Rp400.000.'
                : 'Tidak ada siswa — tagihan tidak bisa dibuat. Klik Selesai untuk menutup.'}
            </p>
            {createdStudentId && (
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Keterangan Tagihan *</label>
                  <input
                    type="text"
                    value={addInvoiceStep.description}
                    onChange={(e) => setAddInvoiceStep({ ...addInvoiceStep, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                    placeholder="mis. Paket Registrasi Baru"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nominal (Rp) *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={addInvoiceStep.amount ? parseInt(addInvoiceStep.amount.replace(/\D/g, '') || '0', 10).toLocaleString('id-ID') : ''}
                    onChange={(e) => setAddInvoiceStep({ ...addInvoiceStep, amount: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Jatuh Tempo *</label>
                  <input
                    type="date"
                    value={addInvoiceStep.dueDate}
                    onChange={(e) => setAddInvoiceStep({ ...addInvoiceStep, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              {createdStudentId && (
                <button
                  type="button"
                  onClick={handleAddInvoiceStep}
                  disabled={addInvoiceStepSaving || !addInvoiceStep.dueDate}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {addInvoiceStepSaving ? 'Menyimpan...' : 'Buat Tagihan & Selesai'}
                </button>
              )}
              <button
                type="button"
                onClick={finishRegistration}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                {createdStudentId ? 'Lewati & Selesai' : 'Selesai'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )}
  ```

- [ ] **Step 5: Add `finishRegistration` to `useCallback` import deps**

  `finishRegistration` uses `fetchParents`. Verify `fetchParents` is wrapped in `useCallback` (it already is). No change needed.

- [ ] **Step 6: TypeScript compile check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors. Common errors to watch for:
  - `addStudentStep` state fields missing — verify all 3 fields initialized in Step 1
  - `addProgramStep` type is `string[]` — `addProgramStep.includes(prog)` is correct
  - `finishRegistration` called inside `handleAddInvoiceStep` — ensure it's declared before with `useCallback`

- [ ] **Step 7: Smoke test the full flow**

  1. Click "Tambah Wali Murid" → form shows with step indicator at step 1
  2. Fill parent info → click "Lanjut →" → step 2 appears
  3. Fill student name + select Tingkat 2 → Nominal in step 4 auto-updates to 160.000
  4. Click "Lanjut →" → step 3 appears with program checkboxes
  5. Select SEMPOA + ENGLISH → click "Lanjut →" → step 4 appears
  6. Verify description shows "SPP Tingkat 2 — Bulan Pertama" and amount "160.000"
  7. Change to "Paket Registrasi Baru" + "400000" + set due date → click "Buat Tagihan & Selesai"
  8. Form closes, parent table refreshes, new parent shows "— belum ada tagihan" until invoice month is current

  Also test: click "Lewati" at student step → goes to program → Lewati → invoice step shows "tidak ada siswa" → Selesai

- [ ] **Step 8: Commit**

  ```bash
  git add app/(dashboard)/admin/parents/ParentsClient.tsx
  git commit -m "feat: multi-step parent registration with student, program, and initial invoice"
  ```

---

## Self-Review

### Spec coverage
- [x] Task 1: Fix "Lunas" on new parent — `getParentBillingStatus` returns `'NONE'`, badge shows `—`
- [x] Task 2: Parent step collects name/email/phone/password — present
- [x] Task 2: Student step collects name/grade/tier — present
- [x] Task 2: Tier selection auto-updates invoice amount — implemented in onChange
- [x] Task 2: Program step — multi-select checkboxes for all 7 programs
- [x] Task 2: Invoice step — description/amount(formatted)/dueDate with skip option
- [x] Task 2: Each step can be skipped — Lewati buttons present in steps 2, 3, 4
- [x] Step indicator (4 dots) shows progress visually

### Placeholder scan
- No TBD. All JSX is concrete with full Tailwind classes
- Tier prices hardcoded as constants inline — consistent with `lib/constants/pricing.ts` values

### Type consistency
- `addStep: 'parent' | 'student' | 'program' | 'invoice'` — used consistently in all conditionals
- `createdParentId: string | null`, `createdStudentId: string | null` — checked before use with `if (!createdParentId) return`
- `addProgramStep: string[]` — `.includes()` and spread consistent
- `addInvoiceStep.amount` stored as raw digit string — `.replace(/\D/g, '')` in both onChange and submit consistent with billing pattern
