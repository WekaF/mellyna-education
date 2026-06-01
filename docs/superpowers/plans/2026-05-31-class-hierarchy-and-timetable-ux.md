# Class Hierarchy & Timetable UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah field `mainProgram` ke `Class` agar kelas bisa dikelompokkan berdasarkan program utama (SEMPOA / CALISTUNG / ENGLISH), lalu perbaiki tampilan halaman `/admin/classes` dan dropdown timetable agar tidak membingungkan.

**Architecture:** Tambah satu kolom `mainProgram Program?` ke tabel `Class`. Semua API dan UI pakai field ini sebagai grup utama. Sub-program (AHE, EYL, EFK, EFE) tetap di `ClassProgram` sebagai tambahan. Timetable dropdown pakai `<optgroup>` berdasarkan `mainProgram`.

**Tech Stack:** Next.js 14, Prisma ORM, PostgreSQL, TypeScript, Tailwind CSS, Zod

---

## Diagnosis: Kenapa Banyak Kelas & Kenapa Ada Siswa?

### Kenapa kelas sudah ada siswanya?
Ini by design. Model `Enrollment` menghubungkan `Student` ↔ `Class` secara permanen. Admin bisa enroll siswa ke kelas lewat tombol "Manage Enrollments" di halaman `/admin/classes`. Siswa yang terdaftar di kelas tertentu otomatis masuk ke jadwal mingguan (Schedule) saat timetable di-generate. **Ini bukan bug — ini memang workflow-nya.**

### Kenapa kelasnya banyak?
Problem sebenarnya: tidak ada hierarki antara "program utama" dan "sub-program". Saat ini semua 7 program (SEMPOA, AHE, EYL, EFK, EFE, CALISTUNG, ENGLISH) dianggap setara. Admin mungkin membuat kelas terpisah untuk tiap kombinasi program, sehingga dropdown timetable penuh dengan pilihan.

### Solusi
Tambah field `mainProgram` ke `Class`:
- **Main programs** (kelas utama): SEMPOA, CALISTUNG, ENGLISH
- **Sub-programs** (program tambahan): AHE, EYL, EFK, EFE (level/metode dalam SEMPOA)
- Semua UI grup berdasarkan `mainProgram`

---

## File Structure

| File | Perubahan |
|------|-----------|
| `prisma/schema.prisma` | Tambah `mainProgram Program?` ke model `Class` |
| `prisma/migrations/` | Auto-generated migration |
| `scripts/backfill-main-program.ts` | Backfill `mainProgram` untuk kelas existing |
| `app/api/classes/route.ts` | Tambah `mainProgram` ke schema Zod + response |
| `app/api/classes/[id]/route.ts` | Tambah `mainProgram` ke update schema + response |
| `app/(dashboard)/admin/classes/ClassesClient.tsx` | Group by `mainProgram`, update form |
| `app/(dashboard)/admin/timetable/TimetableClient.tsx` | `<optgroup>` by `mainProgram` + search filter |

---

## Task 1: Schema — Tambah `mainProgram` ke Class

**Files:**
- Modify: `prisma/schema.prisma:116-131`

- [ ] **Step 1: Tambah field `mainProgram` ke model Class**

Edit `prisma/schema.prisma`, ubah model `Class`:

```prisma
model Class {
  id          String     @id @default(cuid())
  name        String
  description String?
  mainProgram Program?
  dayOfWeek   DayOfWeek?
  timeSlot    String?
  tutorId     String
  tutor       User       @relation("TutorClasses", fields: [tutorId], references: [id])
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  programs           ClassProgram[]
  enrollments        Enrollment[]
  schedules          Schedule[]
  additionalTutors   ClassTutor[]   @relation("AdditionalTutors")
}
```

- [ ] **Step 2: Generate dan jalankan migration**

```bash
npx prisma migrate dev --name add_main_program_to_class
```

Expected output: `✔ Your database migration has been created and applied.`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add mainProgram field to Class model"
```

---

## Task 2: Backfill Script — Set `mainProgram` untuk Kelas Existing

**Files:**
- Create: `scripts/backfill-main-program.ts`

Kelas existing belum punya `mainProgram`. Script ini set `mainProgram` berdasarkan program pertama di `ClassProgram`. Jika tidak ada program, set ke `SEMPOA` sebagai default.

- [ ] **Step 1: Buat backfill script**

```typescript
// scripts/backfill-main-program.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const classes = await prisma.class.findMany({
    where: { mainProgram: null },
    include: { programs: { take: 1, orderBy: { program: 'asc' } } },
  })

  console.log(`Found ${classes.length} classes without mainProgram`)

  for (const kelas of classes) {
    const mainProgram = kelas.programs[0]?.program ?? 'SEMPOA'
    await prisma.class.update({
      where: { id: kelas.id },
      data: { mainProgram },
    })
    console.log(`  ${kelas.name} → mainProgram: ${mainProgram}`)
  }

  console.log('Done.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Jalankan backfill**

```bash
npx ts-node --project tsconfig.json scripts/backfill-main-program.ts
```

Expected output:
```
Found N classes without mainProgram
  Sempoa A → mainProgram: SEMPOA
  Kalistung B → mainProgram: CALISTUNG
  ...
Done.
```

- [ ] **Step 3: Verifikasi di Prisma Studio**

```bash
npx prisma studio
```

Buka tabel `Class`, pastikan semua rows punya `mainProgram` terisi.

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-main-program.ts
git commit -m "feat(script): backfill mainProgram for existing classes"
```

---

## Task 3: API — Tambah `mainProgram` ke POST dan PUT Schema

**Files:**
- Modify: `app/api/classes/route.ts:24-32`
- Modify: `app/api/classes/[id]/route.ts:21-29`

- [ ] **Step 1: Update `createClassSchema` di route.ts**

Edit `app/api/classes/route.ts`, ubah schema Zod:

```typescript
const createClassSchema = z.object({
  name: z.string().min(1),
  mainProgram: z.nativeEnum(Program),
  programs: z.array(z.nativeEnum(Program)).min(1),
  description: z.string().optional(),
  tutorId: z.string().min(1),
  additionalTutorIds: z.array(z.string()).optional(),
  dayOfWeek: z.nativeEnum(DayOfWeek).nullable().optional(),
  timeSlot: z.string().nullable().optional(),
})
```

- [ ] **Step 2: Update `updateClassSchema` di `[id]/route.ts`**

Edit `app/api/classes/[id]/route.ts`, ubah schema Zod:

```typescript
const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  mainProgram: z.nativeEnum(Program).optional(),
  programs: z.array(z.nativeEnum(Program)).min(1).optional(),
  description: z.string().optional(),
  tutorId: z.string().optional(),
  additionalTutorIds: z.array(z.string()).optional(),
  dayOfWeek: z.nativeEnum(DayOfWeek).nullable().optional(),
  timeSlot: z.string().nullable().optional(),
})
```

- [ ] **Step 3: Tambah `mainProgram` ke `classListInclude` di route.ts**

`classListInclude` sudah include semua field di tabel `Class` lewat Prisma — tidak perlu ubah, karena `mainProgram` adalah kolom biasa (bukan relation). Tapi verifikasi response sudah include `mainProgram`:

Buka browser: `GET /api/classes` — cek response JSON ada field `mainProgram`.

- [ ] **Step 4: Commit**

```bash
git add app/api/classes/route.ts app/api/classes/[id]/route.ts
git commit -m "feat(api): add mainProgram to class create/update schema"
```

---

## Task 4: ClassesClient — Group by `mainProgram` + Update Form

**Files:**
- Modify: `app/(dashboard)/admin/classes/ClassesClient.tsx`

Perubahan UI:
1. Tampilan daftar kelas: dikelompokkan per `mainProgram` (section header per program)
2. Form buat/edit kelas: pisah "Program Utama" (wajib, single-select) dari "Program Tambahan" (opsional, multi-select)

- [ ] **Step 1: Update interface `Class` untuk include `mainProgram`**

Di `ClassesClient.tsx`, update interface `Class`:

```typescript
interface Class {
  id: string
  name: string
  mainProgram: ProgramValue | null
  programs: ClassProgram[]
  description: string | null
  tutor: { name: string; email: string }
  _count: { enrollments: number }
  enrollments?: Array<{ id: string; student: { id: string; name: string; grade: string | null } }>
}
```

- [ ] **Step 2: Update `makeEmptyForm` untuk include `mainProgram`**

```typescript
const makeEmptyForm = () => ({
  name: '',
  mainProgram: '' as ProgramValue | '',
  programs: [] as ProgramValue[],
  description: '',
  tutorId: '',
})
```

- [ ] **Step 3: Tambah konstanta untuk main programs vs sub-programs**

Di bawah `const PROGRAMS = ...`:

```typescript
const MAIN_PROGRAMS: ProgramValue[] = ['SEMPOA', 'CALISTUNG', 'ENGLISH']
const SUB_PROGRAMS: ProgramValue[] = ['AHE', 'EFK', 'EYL', 'EFE']
```

- [ ] **Step 4: Update form submit handler untuk kirim `mainProgram`**

Cari fungsi `handleSave` (atau fungsi submit form). Pastikan `mainProgram` ikut dikirim ke API.

Contoh update payload:
```typescript
const payload = {
  name: form.name,
  mainProgram: form.mainProgram || form.programs[0], // fallback ke program pertama
  programs: form.programs,
  description: form.description,
  tutorId: form.tutorId,
}
```

- [ ] **Step 5: Update form UI — pisah Program Utama dari Program Tambahan**

Di bagian form create/edit kelas, ganti field "Programs" dengan dua field:

```tsx
{/* Program Utama */}
<div>
  <label className="block text-xs font-bold text-slate-500 mb-1">
    Program Utama <span className="text-red-400">*</span>
  </label>
  <div className="flex flex-wrap gap-1.5">
    {MAIN_PROGRAMS.map(p => (
      <button
        key={p}
        type="button"
        onClick={() => setForm(f => ({ ...f, mainProgram: p }))}
        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
          form.mainProgram === p
            ? `${PROGRAM_COLORS[p]} shadow-sm`
            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
        }`}
      >
        {p}
      </button>
    ))}
  </div>
</div>

{/* Program Tambahan (opsional) */}
<div>
  <label className="block text-xs font-bold text-slate-500 mb-1">
    Program Tambahan <span className="text-slate-400 font-normal">(opsional, untuk sub-level)</span>
  </label>
  <ProgramToggle
    selected={form.programs.filter(p => SUB_PROGRAMS.includes(p as any))}
    onChange={selected =>
      setForm(f => ({
        ...f,
        programs: [
          ...(f.mainProgram ? [f.mainProgram as ProgramValue] : []),
          ...selected,
        ],
      }))
    }
    programs={SUB_PROGRAMS}
  />
</div>
```

Update `ProgramToggle` agar terima prop `programs?: ProgramValue[]`:
```typescript
function ProgramToggle({
  selected,
  onChange,
  programs: programList = PROGRAMS,
}: {
  selected: ProgramValue[]
  onChange: (p: ProgramValue[]) => void
  programs?: ProgramValue[]
}) {
  // ... same logic tapi pakai programList
}
```

- [ ] **Step 6: Group daftar kelas berdasarkan `mainProgram`**

Ganti bagian render list kelas. Tambah grouping:

```tsx
// Di atas return statement, group classes by mainProgram
const grouped = MAIN_PROGRAMS.reduce((acc, prog) => {
  acc[prog] = classes.filter(c => c.mainProgram === prog)
  return acc
}, {} as Record<string, Class[]>)

// Kelas tanpa mainProgram (legacy)
const ungrouped = classes.filter(c => !c.mainProgram || !MAIN_PROGRAMS.includes(c.mainProgram as any))
```

Render grouped list:
```tsx
{MAIN_PROGRAMS.map(prog => {
  const group = grouped[prog]
  if (group.length === 0) return null
  return (
    <div key={prog} className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${PROGRAM_COLORS[prog]}`}>
          {prog}
        </span>
        <span className="text-xs text-slate-400">{group.length} kelas</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.map(c => (
          // ... existing class card render
        ))}
      </div>
    </div>
  )
})}

{ungrouped.length > 0 && (
  <div className="mb-6">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600">
        Belum Dikategorikan
      </span>
      <span className="text-xs text-slate-400">{ungrouped.length} kelas</span>
    </div>
    {/* render ungrouped cards */}
  </div>
)}
```

- [ ] **Step 7: Test manual di browser**

Buka `http://localhost:3000/admin/classes`:
- Kelas tampil dikelompokkan per program utama
- Form buat kelas ada "Program Utama" (required) + "Program Tambahan"
- Setelah buat kelas baru, langsung muncul di grup yang tepat

- [ ] **Step 8: Commit**

```bash
git add app/(dashboard)/admin/classes/ClassesClient.tsx
git commit -m "feat(admin/classes): group classes by mainProgram, update create/edit form"
```

---

## Task 5: TimetableClient — Grouped Dropdown + Search Filter

**Files:**
- Modify: `app/(dashboard)/admin/timetable/TimetableClient.tsx:44-55` (interface)
- Modify: `app/(dashboard)/admin/timetable/TimetableClient.tsx:693-722` (dropdown render)

- [ ] **Step 1: Update interface `ClassModel` untuk include `mainProgram`**

Di `TimetableClient.tsx`, update interface:

```typescript
interface ClassModel {
  id: string
  name: string
  mainProgram: ProgramValue | null
  programs: { program: ProgramValue }[]
  description: string | null
  dayOfWeek: DayOfWeek | null
  timeSlot: string | null
  tutorId: string
  tutor: { id: string; name: string }
  additionalTutors?: { tutor: { id: string; name: string } }[]
  enrollments: { id: string; studentId: string; student: { id: string; name: string; grade: string | null } }[]
}
```

- [ ] **Step 2: Tambah state `classSearch` untuk filter dropdown**

Di bagian state declarations (sekitar line 78-83):

```typescript
const [classSearch, setClassSearch] = useState('')
```

- [ ] **Step 3: Buat grouped class list dengan filter**

Tambah konstanta (pakai `useMemo` untuk performa):

```typescript
const MAIN_PROGRAMS_TIMETABLE = ['SEMPOA', 'CALISTUNG', 'ENGLISH'] as const

const filteredGroupedClasses = useMemo(() => {
  const search = classSearch.toLowerCase()
  const filtered = classes.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search) ||
    c.tutor.name.toLowerCase().includes(search) ||
    c.programs.some(p => p.program.toLowerCase().includes(search))
  )
  
  const grouped: Record<string, ClassModel[]> = {}
  for (const prog of MAIN_PROGRAMS_TIMETABLE) {
    grouped[prog] = filtered.filter(c => c.mainProgram === prog)
  }
  const other = filtered.filter(
    c => !c.mainProgram || !MAIN_PROGRAMS_TIMETABLE.includes(c.mainProgram as any)
  )
  if (other.length > 0) grouped['LAINNYA'] = other
  
  return grouped
}, [classes, classSearch])
```

- [ ] **Step 4: Update dropdown "Pilih Kelas Bimbingan" (line ~696-722)**

Ganti `<select>` biasa dengan select yang punya search + `<optgroup>`:

```tsx
{!selectedClass && mode === 'select' ? (
  <div className="space-y-4 animate-fadeIn">
    <div>
      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
        Pilih Kelas Bimbingan *
      </label>
      
      {/* Search filter */}
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          type="text"
          placeholder="Cari kelas..."
          value={classSearch}
          onChange={e => setClassSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500 bg-white"
        />
      </div>
      
      {/* Grouped select */}
      <select
        required
        value={selectedExistingClassId}
        onChange={e => setSelectedExistingClassId(e.target.value)}
        className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500 bg-white"
      >
        <option value="">-- Pilih Kelas --</option>
        {Object.entries(filteredGroupedClasses).map(([prog, groupClasses]) => {
          if (groupClasses.length === 0) return null
          return (
            <optgroup key={prog} label={`── ${prog} ──`}>
              {groupClasses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.programs.length > 0 && ` (${c.programs.map(p => p.program).join(' + ')})`}
                  {' • '}{c.tutor.name}
                  {' '}{c.dayOfWeek
                    ? `(Aktif: ${DAYS.find(d => d.key === c.dayOfWeek)?.label} ${c.timeSlot})`
                    : '(Belum Terjadwal)'}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </div>
```

- [ ] **Step 5: Reset `classSearch` saat modal ditutup**

Di `closeModal` atau fungsi close modal:

```typescript
setClassSearch('')
```

- [ ] **Step 6: Test manual di browser**

Buka `http://localhost:3000/admin/timetable`:
- Klik slot kosong → modal buka → pilih "Kelas existing"
- Dropdown tampil dengan `<optgroup>` per program (SEMPOA, CALISTUNG, ENGLISH)
- Ketik di search box "sempoa" → dropdown filter otomatis
- Pilih kelas → berfungsi normal

- [ ] **Step 7: Commit**

```bash
git add app/(dashboard)/admin/timetable/TimetableClient.tsx
git commit -m "feat(timetable): group class dropdown by mainProgram + add search filter"
```

---

## Self-Review

### Spec coverage check
| Requirement | Task |
|-------------|------|
| Kelas bisa dikelompokkan per program utama | Task 1, 4 |
| Timetable dropdown tidak membingungkan | Task 5 |
| Form buat kelas pisahkan program utama vs sub | Task 4 |
| Kelas existing tetap bekerja | Task 2 (backfill) |
| API menerima dan menyimpan mainProgram | Task 3 |

### Catatan penting
- `mainProgram` dibuat nullable (`Program?`) agar backward compatible. Kelas lama tidak langsung error.
- Backfill script (Task 2) harus dijalankan sebelum deploy ke production.
- Setelah semua kelas punya `mainProgram`, bisa pertimbangkan buat migration berikutnya untuk set `mainProgram` menjadi required (NOT NULL) — tapi ini opsional.
- Alasan siswa sudah ada di kelas: ini by design, bukan bug. Enrollment = keanggotaan permanen siswa ke kelompok belajar.
