# Superadmin Add Parent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Tambah Wali Murid" form to the admin parents page so superadmin can register new parent accounts directly.

**Architecture:** Pure UI change — `POST /api/users` with `role: PARENT` already exists and handles bcrypt, duplicate email check, and validation. Add an inline collapsible form card to the existing parents page, following the same pattern used in the students admin page.

**Tech Stack:** Next.js 14, React (useState/useCallback), TailwindCSS, existing `/api/users` endpoint

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `app/(dashboard)/admin/parents/page.tsx` | Modify | Add form state, "Tambah Wali Murid" button, inline form card |

No new files. No API changes.

---

### Task 1: Add form state and "Tambah Wali Murid" button

**Files:**
- Modify: `app/(dashboard)/admin/parents/page.tsx`

- [ ] **Step 1: Write a failing test (manual verification)**

Open the page at `/admin/parents` and confirm there is NO "Tambah Wali Murid" button. Screenshot or observe current state.

- [ ] **Step 2: Add form state variables after existing `useState` declarations**

In `app/(dashboard)/admin/parents/page.tsx`, after line 104 (`const [togglingId, ...`) add:

```tsx
const [showAddForm, setShowAddForm] = useState(false)
const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', password: '' })
const [addSaving, setAddSaving] = useState(false)
const [addError, setAddError] = useState<string | null>(null)
const [addSuccess, setAddSuccess] = useState<string | null>(null)
```

- [ ] **Step 3: Add the "Tambah Wali Murid" button to the header**

Find the header section in the JSX (around line 430):

```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
  <div>
    <h1 ...>
```

Change it to:

```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
  <div>
    <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2.5">
      <span className="p-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100/20 text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
        <UsersRound className="h-6 w-6" />
      </span>
      Portal Pengelola Wali Murid
    </h1>
    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 ml-1">
      Pantau akun orang tua, status tagihan aktif, serta analisis grafik performa siswa bimbel secara riil.
    </p>
  </div>
  <button
    onClick={() => {
      setShowAddForm(true)
      setAddForm({ name: '', email: '', phone: '', password: '' })
      setAddError(null)
      setAddSuccess(null)
    }}
    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer shrink-0"
  >
    <UserPlus className="h-4 w-4" /> Tambah Wali Murid
  </button>
</div>
```

- [ ] **Step 4: Add `UserPlus` to the lucide-react import**

Find the import line at the top:
```tsx
import {
  UsersRound,
  UserCheck,
  UserX,
  ...
```

Add `UserPlus` to the list:
```tsx
import {
  UsersRound,
  UserCheck,
  UserX,
  UserPlus,
  ...
```

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/admin/parents/page.tsx
git commit -m "feat(admin/parents): add Tambah Wali Murid button and form state"
```

---

### Task 2: Add the inline form card and submit handler

**Files:**
- Modify: `app/(dashboard)/admin/parents/page.tsx`

- [ ] **Step 1: Add the submit handler function**

After `fetchParents` callback (around line 124), add:

```tsx
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
    if (!res.ok) throw new Error(data.error || 'Gagal menambahkan wali murid.')
    setAddSuccess(`Akun wali murid "${data.name}" berhasil dibuat. Login dengan email: ${data.email}`)
    setAddForm({ name: '', email: '', phone: '', password: '' })
    await fetchParents()
  } catch (err: any) {
    setAddError(err.message)
  } finally {
    setAddSaving(false)
  }
}, [addForm, fetchParents])
```

- [ ] **Step 2: Add the inline form card in the JSX**

Place it AFTER the stats grid and BEFORE the error alert block (around line 468):

```tsx
{/* Add Parent Inline Form */}
{showAddForm && (
  <div className="rounded-2xl bg-white dark:bg-[#121b2d] border border-indigo-100 dark:border-indigo-900/30 shadow-md p-6 space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-indigo-500" />
        Tambah Akun Wali Murid Baru
      </h2>
      <button
        onClick={() => {
          setShowAddForm(false)
          setAddError(null)
          setAddSuccess(null)
        }}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>

    {addError && (
      <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 px-4 py-3 text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {addError}
      </div>
    )}

    {addSuccess && (
      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {addSuccess}
      </div>
    )}

    <form onSubmit={handleAddParent} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
          Nama Lengkap *
        </label>
        <input
          required
          value={addForm.name}
          onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
          placeholder="Nama wali murid"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
          Email *
        </label>
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
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
          No. WhatsApp
        </label>
        <input
          value={addForm.phone}
          onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
          placeholder="08xxxxxxxxxx"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
          Password Sementara *
        </label>
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
          {addSaving ? 'Menyimpan...' : 'Simpan Akun'}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowAddForm(false)
            setAddError(null)
            setAddSuccess(null)
          }}
          className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          Batal
        </button>
      </div>
    </form>
  </div>
)}
```

- [ ] **Step 3: Verify `fetchParents` function exists**

The existing code fetches parents via `fetchParents` callback (line 111). Confirm the function is named `fetchParents` (not `fetchData` or another name) — it calls `GET /api/admin/parents`. The add handler calls `fetchParents()` after success to refresh the table.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
rtk tsc --noEmit
```

Expected: No errors. If errors appear, fix type mismatches (most likely `addForm` type or missing import).

- [ ] **Step 5: Manual test — happy path**

1. Open `/admin/parents`
2. Click "Tambah Wali Murid"
3. Fill: name="Test Parent", email="test.parent@example.com", phone="081234567890", password="test123"
4. Click "Simpan Akun"
5. Verify: green success banner appears, table refreshes with new row, form fields reset

- [ ] **Step 6: Manual test — duplicate email**

1. Submit the same form again with the same email
2. Verify: red error banner shows "Email sudah digunakan."

- [ ] **Step 7: Commit**

```bash
git add app/(dashboard)/admin/parents/page.tsx
git commit -m "feat(admin/parents): allow superadmin to create parent accounts"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Feature request = superadmin can add new parent. Tasks 1+2 fully cover this. 
- [x] **No placeholders:** All code shown explicitly. No "add validation" or "handle errors" without code.
- [x] **Type consistency:** `addForm` is `{ name: string, email: string, phone: string, password: string }` — matches `POST /api/users` schema. `UserPlus` import added in Task 1 and used in Task 2. `handleAddParent` declared in Task 2 and referenced in Task 2 JSX.
- [x] **`fetchParents` name:** Verified — line 111 in parents/page.tsx defines `const fetchParents = useCallback(...)`.
- [x] **`X` and `AlertCircle` and `CheckCircle2` icons:** Already imported in the existing page (lines 13, 21, 17 respectively). No new imports needed for those.
