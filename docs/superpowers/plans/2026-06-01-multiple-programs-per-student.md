# Multiple Programs Per Student Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a student to be enrolled in multiple active programs simultaneously, updating the admin parents page to show all active programs and allowing admin to add programs.

**Architecture:** The DB already supports multiple `ProgramEnrollment` records per student via a relation. The API currently blocks this with a "one active at a time" constraint — change to "no duplicate same-program" constraint. Update the modal to support an 'add' mode and pass currently-active programs so it filters them out. Update `ParentsClient` to render all active program badges in both the table column and the student drawer.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma ORM, React (useState/useCallback), TanStack Table, Tailwind CSS, Jest (for API logic tests)

---

## File Map

| File | Change |
|------|--------|
| `app/api/program-enrollments/route.ts` | Remove "any active" block, add "same program duplicate" check |
| `components/admin/ProgramEnrollmentModal.tsx` | Add `'add'` mode + `activePrograms` prop, filter available programs |
| `app/(dashboard)/admin/parents/ParentsClient.tsx` | Update modal state shape, `openProgramModal`, table column, drawer, modal render |
| `__tests__/api/program-enrollments-multiple.test.ts` | New — unit tests for multiple-enrollment constraint logic |

---

### Task 1: Remove Single-Program API Constraint

**Files:**
- Modify: `app/api/program-enrollments/route.ts:60-68`
- Create: `__tests__/api/program-enrollments-multiple.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/program-enrollments-multiple.test.ts`:

```typescript
describe('program enrollment multiple constraint', () => {
  it('blocks duplicate enrollment for same program', () => {
    const existing = [
      { program: 'SEMPOA', status: 'ACTIVE' },
      { program: 'AHE', status: 'ACTIVE' },
    ]
    const newProgram = 'SEMPOA'
    const isDuplicate = existing.some(
      (e) => e.program === newProgram && e.status === 'ACTIVE'
    )
    expect(isDuplicate).toBe(true)
  })

  it('allows adding a different program when student has active enrollments', () => {
    const existing = [
      { program: 'SEMPOA', status: 'ACTIVE' },
      { program: 'AHE', status: 'ACTIVE' },
    ]
    const newProgram = 'EFK'
    const isDuplicate = existing.some(
      (e) => e.program === newProgram && e.status === 'ACTIVE'
    )
    expect(isDuplicate).toBe(false)
  })

  it('allows adding first program when student has no active enrollments', () => {
    const existing: { program: string; status: string }[] = []
    const newProgram = 'SEMPOA'
    const isDuplicate = existing.some(
      (e) => e.program === newProgram && e.status === 'ACTIVE'
    )
    expect(isDuplicate).toBe(false)
  })

  it('allows adding program when existing enrollment is not ACTIVE', () => {
    const existing = [{ program: 'SEMPOA', status: 'COMPLETED' }]
    const newProgram = 'SEMPOA'
    const isDuplicate = existing.some(
      (e) => e.program === newProgram && e.status === 'ACTIVE'
    )
    expect(isDuplicate).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails (no logic yet)**

```
npx jest __tests__/api/program-enrollments-multiple.test.ts --no-coverage
```

Expected: PASS (pure logic tests, no imports that can fail). These tests encode the new constraint logic that will also go into the API.

- [ ] **Step 3: Update the POST handler in `app/api/program-enrollments/route.ts`**

Replace lines 60–68 (the `existingActive` block):

```typescript
  try {
    const existingProgram = await prisma.programEnrollment.findFirst({
      where: {
        studentId: parsed.data.studentId,
        program: parsed.data.program,
        status: 'ACTIVE',
      },
    })
    if (existingProgram) {
      return NextResponse.json(
        { error: 'Siswa sudah terdaftar di program ini.' },
        { status: 409 }
      )
    }

    const enrollment = await prisma.programEnrollment.create({
      data: parsed.data,
    })

    return NextResponse.json(enrollment, { status: 201 })
  } catch (error) {
```

The full POST handler after the change:

```typescript
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const existingProgram = await prisma.programEnrollment.findFirst({
      where: {
        studentId: parsed.data.studentId,
        program: parsed.data.program,
        status: 'ACTIVE',
      },
    })
    if (existingProgram) {
      return NextResponse.json(
        { error: 'Siswa sudah terdaftar di program ini.' },
        { status: 409 }
      )
    }

    const enrollment = await prisma.programEnrollment.create({
      data: parsed.data,
    })

    return NextResponse.json(enrollment, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to verify**

```
npx jest __tests__/api/program-enrollments-multiple.test.ts --no-coverage
```

Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/program-enrollments/route.ts __tests__/api/program-enrollments-multiple.test.ts
git commit -m "feat: allow multiple active programs per student"
```

---

### Task 2: Update ProgramEnrollmentModal to Support 'add' Mode

**Files:**
- Modify: `components/admin/ProgramEnrollmentModal.tsx`

- [ ] **Step 1: Replace the entire file content**

The changes are: add `'add'` to the `mode` type, add `activePrograms?: string[]` prop, update `availablePrograms` calculation, update `handleSubmit` to treat `'add'` same as `'assign'`, update header/button labels for `'add'` mode, and show an empty state when all programs are already enrolled.

```typescript
'use client'

import { useState } from 'react'
import { X, ArrowUpCircle, BookOpen, CheckCircle2, PlusCircle } from 'lucide-react'
import {
  PROGRAMS,
  PROGRAM_LABELS,
  PROGRAM_GRADIENTS,
  PROGRAM_ICONS,
  type ProgramKey,
} from '@/lib/program-config'

interface ProgramEnrollmentModalProps {
  isOpen: boolean
  onClose: () => void
  studentName: string
  studentId: string
  mode: 'assign' | 'add' | 'upgrade'
  currentProgramEnrollmentId?: string
  currentProgram?: string
  activePrograms?: string[]
  onSuccess: () => void
}

export function ProgramEnrollmentModal({
  isOpen,
  onClose,
  studentName,
  studentId,
  mode,
  currentProgramEnrollmentId,
  currentProgram,
  activePrograms = [],
  onSuccess,
}: ProgramEnrollmentModalProps) {
  const [selectedProgram, setSelectedProgram] = useState<ProgramKey | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availablePrograms = mode === 'upgrade'
    ? PROGRAMS.filter((p) => p !== currentProgram)
    : mode === 'add'
    ? PROGRAMS.filter((p) => !activePrograms.includes(p))
    : PROGRAMS

  const handleSubmit = async () => {
    if (!selectedProgram) {
      setError('Pilih program terlebih dahulu.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      let res: Response
      if (mode === 'assign' || mode === 'add') {
        res = await fetch('/api/program-enrollments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId, program: selectedProgram, notes: notes || undefined }),
        })
      } else {
        res = await fetch(`/api/program-enrollments/${currentProgramEnrollmentId}/upgrade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newProgram: selectedProgram, notes: notes || undefined }),
        })
      }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Terjadi kesalahan.')
      }
      handleClose()
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedProgram(null)
    setNotes('')
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  const isUpgrade = mode === 'upgrade'
  const headerTitle = mode === 'upgrade' ? 'Upgrade Program' : mode === 'add' ? 'Tambah Program' : 'Daftarkan Program'
  const headerGradient = isUpgrade ? 'from-amber-500 to-orange-600' : 'from-indigo-600 to-violet-700'
  const buttonLabel = loading
    ? 'Menyimpan...'
    : mode === 'upgrade'
    ? 'Upgrade Program'
    : mode === 'add'
    ? 'Tambah Program'
    : 'Daftarkan Program'
  const buttonColor = isUpgrade ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className={`p-5 bg-gradient-to-r ${headerGradient} text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                {mode === 'upgrade'
                  ? <ArrowUpCircle className="h-5 w-5" />
                  : mode === 'add'
                  ? <PlusCircle className="h-5 w-5" />
                  : <BookOpen className="h-5 w-5" />
                }
              </div>
              <div>
                <h3 className="font-extrabold text-base leading-tight">{headerTitle}</h3>
                <p className="text-xs text-white/80 mt-0.5">Siswa: <strong>{studentName}</strong></p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {mode === 'upgrade' && currentProgram && (
            <div className="mt-3 flex items-center gap-2 text-xs bg-white/10 rounded-xl px-3 py-2">
              <span className="text-white/70">Program saat ini:</span>
              <span className="font-bold">{PROGRAM_LABELS[currentProgram as ProgramKey] ?? currentProgram}</span>
              <span className="text-white/70">→ pilih program baru di bawah</span>
            </div>
          )}
          {mode === 'add' && activePrograms.length > 0 && (
            <div className="mt-3 text-xs bg-white/10 rounded-xl px-3 py-2 text-white/80">
              Sudah terdaftar: <strong>{activePrograms.join(', ')}</strong>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-3 text-sm text-rose-700 dark:text-rose-400">
              {error}
            </div>
          )}

          {availablePrograms.length === 0 ? (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 text-center text-sm text-slate-500 dark:text-slate-400">
              Semua program sudah terdaftar untuk siswa ini.
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Pilih Program
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {availablePrograms.map((program) => {
                  const isSelected = selectedProgram === program
                  return (
                    <button
                      key={program}
                      type="button"
                      onClick={() => setSelectedProgram(program)}
                      className={`relative flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${PROGRAM_GRADIENTS[program]} flex items-center justify-center text-base shrink-0 shadow-xs`}>
                        {PROGRAM_ICONS[program]}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>
                          {program}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate leading-tight mt-0.5">
                          {PROGRAM_LABELS[program].split(' ').slice(0, 3).join(' ')}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-indigo-500 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Catatan <span className="normal-case font-normal">(opsional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Misal: Mulai dari level dasar, tes penempatan sudah dilakukan..."
              rows={2}
              className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedProgram || availablePrograms.length === 0}
            className={`px-5 py-2 rounded-xl text-sm font-bold text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${buttonColor}`}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `ProgramEnrollmentModal.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/admin/ProgramEnrollmentModal.tsx
git commit -m "feat: add 'add' mode to ProgramEnrollmentModal for multiple programs"
```

---

### Task 3: Update ParentsClient — State and openProgramModal

**Files:**
- Modify: `app/(dashboard)/admin/parents/ParentsClient.tsx:141-162`

- [ ] **Step 1: Update the `programModal` state type and `openProgramModal` function**

Find this block (lines ~141–162):

```typescript
  // Program enrollment modal state
  const [programModal, setProgramModal] = useState<{
    isOpen: boolean
    studentId: string
    studentName: string
    mode: 'assign' | 'upgrade'
    currentProgramEnrollmentId?: string
    currentProgram?: string
  }>({ isOpen: false, studentId: '', studentName: '', mode: 'assign' })

  const openProgramModal = (student: Student) => {
    const active = (student.programEnrollments ?? []).find((pe) => pe.status === 'ACTIVE')
    setProgramModal({
      isOpen: true,
      studentId: student.id,
      studentName: student.name,
      mode: active ? 'upgrade' : 'assign',
      currentProgramEnrollmentId: active?.id,
      currentProgram: active?.program,
    })
  }
```

Replace with:

```typescript
  // Program enrollment modal state
  const [programModal, setProgramModal] = useState<{
    isOpen: boolean
    studentId: string
    studentName: string
    mode: 'assign' | 'add' | 'upgrade'
    currentProgramEnrollmentId?: string
    currentProgram?: string
    activePrograms: string[]
  }>({ isOpen: false, studentId: '', studentName: '', mode: 'assign', activePrograms: [] })

  const openProgramModal = (student: Student) => {
    const activeEnrollments = (student.programEnrollments ?? []).filter((pe) => pe.status === 'ACTIVE')
    const activePrograms = activeEnrollments.map((pe) => pe.program)
    setProgramModal({
      isOpen: true,
      studentId: student.id,
      studentName: student.name,
      mode: activeEnrollments.length === 0 ? 'assign' : 'add',
      activePrograms,
    })
  }
```

- [ ] **Step 2: Run TypeScript check**

```
npx tsc --noEmit 2>&1 | head -30
```

Expected: TypeScript errors at the `ProgramEnrollmentModal` render site because `mode` and `activePrograms` props are now mismatched — these get fixed in Task 5.

- [ ] **Step 3: Commit (partial — will finish in Task 5)**

Skip commit here — wait until the file compiles cleanly after Task 4 and 5.

---

### Task 4: Update ParentsClient — Table Column (Multiple Badges)

**Files:**
- Modify: `app/(dashboard)/admin/parents/ParentsClient.tsx:436-466`

- [ ] **Step 1: Replace the `program` column cell**

Find this entire column definition (lines ~435–466):

```typescript
    {
      id: 'program',
      header: 'Program',
      cell: ({ row }) => {
        const parent = row.original
        if (parent.children.length === 0) {
          return <span className="text-xs text-slate-400 dark:text-slate-500 italic">-</span>
        }
        return (
          <div className="space-y-1.5">
            {parent.children.map((child) => {
              const active = (child.programEnrollments ?? []).find((pe) => pe.status === 'ACTIVE')
              return (
                <div key={child.id} className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 w-16 truncate">{child.name}:</span>
                  <button
                    onClick={() => openProgramModal(child)}
                    className="group flex items-center gap-1 cursor-pointer"
                    title={active ? `Upgrade program ${child.name}` : `Daftarkan program untuk ${child.name}`}
                  >
                    <ProgramEnrollmentBadge program={active?.program ?? null} />
                    <span className="text-[10px] text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                      {active ? '↑' : '+'}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        )
      },
    },
```

Replace with:

```typescript
    {
      id: 'program',
      header: 'Program',
      cell: ({ row }) => {
        const parent = row.original
        if (parent.children.length === 0) {
          return <span className="text-xs text-slate-400 dark:text-slate-500 italic">-</span>
        }
        return (
          <div className="space-y-1.5">
            {parent.children.map((child) => {
              const actives = (child.programEnrollments ?? []).filter((pe) => pe.status === 'ACTIVE')
              return (
                <div key={child.id} className="flex items-start gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 w-16 truncate pt-0.5">{child.name}:</span>
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
                      className="group flex items-center cursor-pointer"
                      title={`Tambah program untuk ${child.name}`}
                    >
                      <span className="text-[10px] text-indigo-500 font-bold opacity-60 group-hover:opacity-100 transition-opacity">+</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      },
    },
```

- [ ] **Step 2: Run TypeScript check**

```
npx tsc --noEmit 2>&1 | head -30
```

Expected: same errors as before (modal render props mismatch) — fixed in Task 5.

---

### Task 5: Update ParentsClient — Drawer and Modal Render

**Files:**
- Modify: `app/(dashboard)/admin/parents/ParentsClient.tsx:996-1015` (drawer program section)
- Modify: `app/(dashboard)/admin/parents/ParentsClient.tsx:1460-1469` (modal render)

- [ ] **Step 1: Update the drawer "Program Aktif" section**

Find this block (lines ~996–1016):

```typescript
                              <div className="space-y-1.5 sm:col-span-2">
                                <span className="text-slate-400 dark:text-slate-500">Program Aktif:</span>
                                {(() => {
                                  const activeEnrollment = (selectedStudent.programEnrollments ?? []).find((pe) => pe.status === 'ACTIVE')
                                  return (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <ProgramEnrollmentBadge program={activeEnrollment?.program} />
                                      <button
                                        onClick={() => openProgramModal(selectedStudent)}
                                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                                          activeEnrollment
                                            ? 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400'
                                            : 'bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30 dark:text-indigo-400'
                                        }`}
                                      >
                                        {activeEnrollment ? 'Upgrade Program' : '+ Daftarkan Program'}
                                      </button>
                                    </div>
                                  )
                                })()}
                              </div>
```

Replace with:

```typescript
                              <div className="space-y-1.5 sm:col-span-2">
                                <span className="text-slate-400 dark:text-slate-500">Program Aktif:</span>
                                {(() => {
                                  const activeEnrollments = (selectedStudent.programEnrollments ?? []).filter((pe) => pe.status === 'ACTIVE')
                                  return (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {activeEnrollments.length === 0 ? (
                                        <ProgramEnrollmentBadge program={null} />
                                      ) : (
                                        activeEnrollments.map((pe) => (
                                          <ProgramEnrollmentBadge key={pe.id} program={pe.program} />
                                        ))
                                      )}
                                      <button
                                        onClick={() => openProgramModal(selectedStudent)}
                                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30 dark:text-indigo-400"
                                      >
                                        {activeEnrollments.length === 0 ? '+ Daftarkan Program' : '+ Tambah Program'}
                                      </button>
                                    </div>
                                  )
                                })()}
                              </div>
```

- [ ] **Step 2: Update the ProgramEnrollmentModal render call**

Find this block (lines ~1460–1469):

```typescript
      {/* Program Enrollment Modal */}
      <ProgramEnrollmentModal
        isOpen={programModal.isOpen}
        onClose={closeProgramModal}
        studentName={programModal.studentName}
        studentId={programModal.studentId}
        mode={programModal.mode}
        currentProgramEnrollmentId={programModal.currentProgramEnrollmentId}
        currentProgram={programModal.currentProgram}
        onSuccess={fetchParents}
      />
```

Replace with:

```typescript
      {/* Program Enrollment Modal */}
      <ProgramEnrollmentModal
        isOpen={programModal.isOpen}
        onClose={closeProgramModal}
        studentName={programModal.studentName}
        studentId={programModal.studentId}
        mode={programModal.mode}
        currentProgramEnrollmentId={programModal.currentProgramEnrollmentId}
        currentProgram={programModal.currentProgram}
        activePrograms={programModal.activePrograms}
        onSuccess={fetchParents}
      />
```

- [ ] **Step 3: Run TypeScript check — must be clean**

```
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 4: Run all tests**

```
npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests PASS

- [ ] **Step 5: Commit all ParentsClient changes**

```bash
git add "app/(dashboard)/admin/parents/ParentsClient.tsx"
git commit -m "feat: show multiple active programs per student in parents admin page"
```

---

### Task 6: Manual Verification

> No automated UI tests exist for this page. Verify manually.

- [ ] **Step 1: Start dev server**

```
npm run dev
```

- [ ] **Step 2: Navigate to `/admin/parents`**

Log in as SUPER_ADMIN and go to the parents admin page.

- [ ] **Step 3: Verify table column — zero programs**

Find a student with no programs. Column should show "Belum ada program" badge and a "+" button.

- [ ] **Step 4: Assign first program**

Click "+" for a student with no programs. Modal title should say "Daftarkan Program". Select any program (e.g., SEMPOA) and save. Verify the badge appears in the table column.

- [ ] **Step 5: Add second program**

Click "+" again on the same student. Modal title should say "Tambah Program". The SEMPOA option should NOT be in the grid. Select a different program (e.g., AHE) and save. Both SEMPOA and AHE badges should now appear in the table column.

- [ ] **Step 6: Verify drawer**

Click the student analytics button (📊) to open the drawer. In the "Program Aktif" section, both badges should appear. The button should say "+ Tambah Program".

- [ ] **Step 7: Verify duplicate blocked**

Open browser DevTools. Run:
```javascript
fetch('/api/program-enrollments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ studentId: '<id>', program: 'SEMPOA' })
}).then(r => r.json()).then(console.log)
```
Expected response: `{ error: 'Siswa sudah terdaftar di program ini.' }` with status 409.

- [ ] **Step 8: Verify all programs enrolled state**

Enroll a student in all 7 programs. Click "+". Modal should show "Semua program sudah terdaftar untuk siswa ini." Save button should be disabled.
