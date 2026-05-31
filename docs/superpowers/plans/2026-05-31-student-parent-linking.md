# Student-Parent Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two broken linkage flows: (1) student edit form can't see/change parent, (2) parent page has no way to create children — causing orphaned data and admin confusion.

**Architecture:** No schema changes needed — `Student.parentId` is already a required FK to `User`. Fix is purely UI + API validation layer: add `parentId` to the update schema, pre-populate edit form, and add a "+Siswa" action button with modal in the parent management page.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, React state (no tRPC), Zod validation, TailwindCSS, lucide-react icons

---

## Root Cause Summary

| # | Problem | Location |
|---|---------|----------|
| 1 | `updateStudentSchema` missing `parentId` | `app/api/students/[id]/route.ts:7-12` |
| 2 | Edit form hides parent selector (`!editId` guard) | `app/(dashboard)/admin/students/StudentsClient.tsx:273` |
| 3 | `handleEditClick` resets `parentId: ''` | `app/(dashboard)/admin/students/StudentsClient.tsx:94` |
| 4 | Parent page has no "Tambah Siswa" action | `app/(dashboard)/admin/parents/ParentsClient.tsx` |

---

## File Map

| File | Change |
|------|--------|
| `app/api/students/[id]/route.ts` | Add `parentId` to `updateStudentSchema` |
| `app/(dashboard)/admin/students/StudentsClient.tsx` | Pre-populate parentId on edit; show parent selector in edit mode |
| `app/(dashboard)/admin/parents/ParentsClient.tsx` | Add `addStudentForParent` state, `handleAddStudent` handler, "+Siswa" button column, add-student modal |

---

## Task 1: Add `parentId` to student update API

**Files:**
- Modify: `app/api/students/[id]/route.ts:7-12`

- [ ] **Step 1: Add `parentId` to `updateStudentSchema`**

Replace:
```typescript
const updateStudentSchema = z.object({
  name: z.string().min(1).optional(),
  grade: z.string().optional(),
  birthDate: z.string().optional(),
  notes: z.string().optional(),
})
```

With:
```typescript
const updateStudentSchema = z.object({
  name: z.string().min(1).optional(),
  grade: z.string().optional(),
  birthDate: z.string().optional(),
  notes: z.string().optional(),
  parentId: z.string().optional(),
})
```

No change to the `PUT` handler body needed — `const { birthDate, ...rest } = parsed.data` already spreads all fields into `prisma.student.update({ data: { ...rest } })`.

- [ ] **Step 2: Commit**

```bash
git add app/api/students/[id]/route.ts
git commit -m "feat(api): allow parentId update in student PUT endpoint"
```

---

## Task 2: Fix student edit form to show and allow changing parent

**Files:**
- Modify: `app/(dashboard)/admin/students/StudentsClient.tsx:94` and `:273`

- [ ] **Step 1: Pre-populate `parentId` in `handleEditClick`**

Find on line ~94:
```typescript
const handleEditClick = useCallback((student: Student) => {
  setEditId(student.id)
  setForm({ name: student.name, grade: student.grade || '', parentId: '' })
  setShowForm(true)
}, [])
```

Change `parentId: ''` to `parentId: student.parentId`:
```typescript
const handleEditClick = useCallback((student: Student) => {
  setEditId(student.id)
  setForm({ name: student.name, grade: student.grade || '', parentId: student.parentId })
  setShowForm(true)
}, [])
```

- [ ] **Step 2: Remove `!editId` guard on parent selector**

Find on line ~273:
```tsx
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
```

Replace with (remove `{!editId && (` wrapper and closing `)}`):
```tsx
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
```

- [ ] **Step 3: Start dev server and verify manually**

```bash
pnpm dev
```

1. Go to `/admin/students`
2. Click "Edit" on any student
3. Confirm parent selector appears and is pre-selected with current parent
4. Change to a different parent, click Simpan
5. Confirm table shows updated parent name
6. Click "Tambah Siswa Baru", confirm parent selector still works for create

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/admin/students/StudentsClient.tsx
git commit -m "fix(students): show parent selector on edit, pre-populate current parent"
```

---

## Task 3: Add "Tambah Siswa" action from parent management page

**Files:**
- Modify: `app/(dashboard)/admin/parents/ParentsClient.tsx`

`UserPlus` icon is already imported on line 8. No new imports needed.

- [ ] **Step 1: Add state variables for the add-student modal**

After line 124 (after `const [activeAnalyticTab, ...]`), add:
```typescript
// Add student from parent page
const [addStudentForParent, setAddStudentForParent] = useState<Parent | null>(null)
const [addStudentForm, setAddStudentForm] = useState({ name: '', grade: '' })
const [addStudentSaving, setAddStudentSaving] = useState(false)
const [addStudentError, setAddStudentError] = useState<string | null>(null)
```

- [ ] **Step 2: Add `handleAddStudent` handler**

After `handleEditSave` (around line 170), add:
```typescript
const handleAddStudent = useCallback(async (e: React.FormEvent) => {
  e.preventDefault()
  if (!addStudentForParent) return
  setAddStudentSaving(true)
  setAddStudentError(null)
  try {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...addStudentForm, parentId: addStudentForParent.id }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Gagal menambahkan siswa.')
    setAddStudentForParent(null)
    setAddStudentForm({ name: '', grade: '' })
    await fetchParents()
  } catch (err: any) {
    setAddStudentError(err.message)
  } finally {
    setAddStudentSaving(false)
  }
}, [addStudentForm, addStudentForParent, fetchParents])
```

- [ ] **Step 3: Update `actions` column to show "+Siswa" button for all parents**

Find the `actions` column (around line 458–481):
```typescript
{
  id: 'actions',
  header: '',
  enableSorting: false,
  cell: ({ row }) => {
    const parent = row.original
    if (parent.children.length === 0) return null
    return (
      <div className="flex items-center justify-end">
        <button
          onClick={() => {
            setSelectedParent(parent)
            setSelectedStudent(parent.children[0]) // Open drawer with first child
            setActiveAnalyticTab('overview')
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/30 dark:text-indigo-400 transition-colors cursor-pointer"
        >
          <BarChart2 className="h-3.5 w-3.5" />
          <span>Analitik</span>
        </button>
      </div>
    )
  },
},
```

Replace with:
```typescript
{
  id: 'actions',
  header: '',
  enableSorting: false,
  cell: ({ row }) => {
    const parent = row.original
    return (
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => {
            setAddStudentForParent(parent)
            setAddStudentForm({ name: '', grade: '' })
            setAddStudentError(null)
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/30 dark:text-emerald-400 transition-colors cursor-pointer"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>+Siswa</span>
        </button>
        {parent.children.length > 0 && (
          <button
            onClick={() => {
              setSelectedParent(parent)
              setSelectedStudent(parent.children[0])
              setActiveAnalyticTab('overview')
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/30 dark:text-indigo-400 transition-colors cursor-pointer"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            <span>Analitik</span>
          </button>
        )}
      </div>
    )
  },
},
```

- [ ] **Step 4: Add add-student modal at end of component JSX**

Find the last closing `</div>` before `)</n}` at the bottom of the return statement (around line 1280), and insert this modal **before** the closing `</div>`:

```tsx
{/* Add Student Modal */}
{addStudentForParent && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs">
    <div className="bg-white dark:bg-[#121a2c] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800/80 p-6 w-full max-w-sm mx-4">
      <h2 className="font-bold text-slate-800 dark:text-white mb-1">Tambah Siswa</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Wali Murid: <strong className="text-slate-700 dark:text-slate-300">{addStudentForParent.name}</strong>
      </p>
      {addStudentError && (
        <div className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20">
          {addStudentError}
        </div>
      )}
      <form onSubmit={handleAddStudent} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nama Siswa *</label>
          <input
            required
            value={addStudentForm.name}
            onChange={(e) => setAddStudentForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
            placeholder="Nama lengkap siswa"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Kelas / Tingkatan</label>
          <input
            value={addStudentForm.grade}
            onChange={(e) => setAddStudentForm((f) => ({ ...f, grade: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
            placeholder="mis. Kelas 5 SD"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setAddStudentForParent(null)}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={addStudentSaving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-xs transition-all cursor-pointer"
          >
            {addStudentSaving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```

- [ ] **Step 5: Verify manually in dev server**

```bash
pnpm dev
```

1. Go to `/admin/parents`
2. Find a parent row — confirm "+Siswa" green button appears in actions column
3. Click "+Siswa" on a parent with no children — modal opens showing parent name
4. Fill in student name "Test Siswa", grade "Kelas 3 SD", click Simpan
5. Confirm modal closes, parent row now shows new student badge in "Siswa / Anak" column
6. Confirm "Analitik" button now appears for that parent
7. Click "+Siswa" on a parent who already has children — confirm both "+Siswa" and "Analitik" buttons show
8. Confirm clicking Batal closes modal without changes

- [ ] **Step 6: Commit**

```bash
git add app/(dashboard)/admin/parents/ParentsClient.tsx
git commit -m "feat(parents): add Tambah Siswa action to create students directly from parent page"
```

---

## Self-Review

**Spec coverage:**
- ✅ Student edit shows current parent and allows change (Tasks 1+2)
- ✅ Admin can create siswa from parent page with parent pre-linked (Task 3)
- ✅ Parent with 0 children gets "+Siswa" button (Step 3, removed `children.length === 0` guard)
- ✅ After adding student, parent row refreshes via `fetchParents()` (Task 3 Step 2)

**Placeholder check:** None found.

**Type consistency:**
- `addStudentForParent: Parent | null` — `Parent` interface already defined in ParentsClient.tsx line 95
- `POST /api/students` body: `{ name, grade, parentId }` — matches `createStudentSchema` in `app/api/students/route.ts`
- `Student.parentId` is a `String` in Prisma schema — `parent.id` from `Parent` interface matches
