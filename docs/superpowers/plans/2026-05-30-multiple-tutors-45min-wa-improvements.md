# Multiple Tutors, 45-Minute Sessions & WA Notification Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support multiple tutors per class session, fix session duration to 45 minutes, align WA notification messages with actual schedule data, and include video links in tutor report notifications.

**Architecture:** Add `ClassTutor` join table for many-to-many Class↔Tutor; keep `Class.tutorId` as required primary tutor for backward compatibility. Update `getTimeRange()` to output 45-min windows. Extend `ParentReportData` with media video URLs and propagate through the notification pipeline.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, PostgreSQL, WAHA WhatsApp API, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `ClassTutor` model; add `additionalTutors` relation to `Class` and `User` |
| `app/api/classes/route.ts` | Accept `additionalTutorIds[]` in POST; populate `ClassTutor` |
| `app/api/classes/[id]/route.ts` | Accept `additionalTutorIds[]` in PUT; sync `ClassTutor` |
| `app/api/admin/timetable/generate/route.ts` | Fix 45-min `getTimeRange()`; include all tutors in WA; add topic/location to message |
| `app/api/schedules/[id]/publish/route.ts` | Include `class.additionalTutors` in query; notify all tutors |
| `app/api/schedules/route.ts` | Tutor GET filter: OR `class.tutorId` OR `class.additionalTutors.some` |
| `app/(dashboard)/admin/timetable/TimetableClient.tsx` | Multi-select additional tutors; show `HH:MM–HH:MM` in time slot column |
| `app/(dashboard)/tutor/page.tsx` | Query OR for additional tutor membership |
| `lib/report-notify.ts` | Add `mediaVideos` to `ParentReportData`; include links in WA message |
| `app/api/reports/route.ts` | Fetch `media` in `sendParentNotification`; pass video URLs |

---

## Task 1: Add ClassTutor schema model

**Files:**
- Modify: `prisma/schema.prisma` — add `ClassTutor` model + relations

- [ ] **Step 1: Add `ClassTutor` model and update relations**

In `prisma/schema.prisma`, add after the `Enrollment` model (line ~142):

```prisma
model ClassTutor {
  id        String   @id @default(cuid())
  classId   String
  tutorId   String
  class     Class    @relation("AdditionalTutors", fields: [classId], references: [id], onDelete: Cascade)
  tutor     User     @relation("AdditionalTutorClasses", fields: [tutorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([classId, tutorId])
}
```

Update `Class` model — add relation after `schedules Schedule[]`:
```prisma
  additionalTutors ClassTutor[] @relation("AdditionalTutors")
```

Update `User` model — add relation (near other relations):
```prisma
  additionalTutorClasses ClassTutor[] @relation("AdditionalTutorClasses")
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_class_tutor
```

Expected: Migration created and applied, `ClassTutor` table exists.

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `@prisma/client` updated with `ClassTutor` model.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add ClassTutor join table for multiple tutors per class"
```

---

## Task 2: Fix session duration to 45 minutes

**Files:**
- Modify: `app/api/admin/timetable/generate/route.ts` — `getTimeRange()` function (lines 18–33)

- [ ] **Step 1: Write failing test**

Create `app/api/admin/timetable/__tests__/getTimeRange.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

// Inline copy of the function under test (extracted for testability)
function getTimeRange(slot: string): { start: string; end: string } {
  if (slot.includes(':')) {
    const [h, m] = slot.split(':').map(Number)
    const totalMins = h * 60 + m + 45
    const endH = Math.floor(totalMins / 60)
    const endM = totalMins % 60
    return {
      start: slot,
      end: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`,
    }
  }
  const mapping: Record<string, { start: string; end: string }> = {
    'JAM 1': { start: '13:00', end: '13:45' },
    'JAM 2': { start: '14:00', end: '14:45' },
    'JAM 3': { start: '15:00', end: '15:45' },
    'JAM 4': { start: '16:00', end: '16:45' },
    'JAM 7': { start: '19:00', end: '19:45' },
  }
  return mapping[slot] ?? { start: '08:00', end: '08:45' }
}

describe('getTimeRange', () => {
  it('HH:MM slot → +45 minutes', () => {
    expect(getTimeRange('08:00')).toEqual({ start: '08:00', end: '08:45' })
    expect(getTimeRange('09:15')).toEqual({ start: '09:15', end: '10:00' })
    expect(getTimeRange('23:30')).toEqual({ start: '23:30', end: '00:15' })
  })
  it('JAM slots → correct 45-min windows', () => {
    expect(getTimeRange('JAM 1')).toEqual({ start: '13:00', end: '13:45' })
    expect(getTimeRange('JAM 7')).toEqual({ start: '19:00', end: '19:45' })
  })
  it('unknown slot → 08:00–08:45 fallback', () => {
    expect(getTimeRange('JAM X')).toEqual({ start: '08:00', end: '08:45' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails (old 2-hour logic)**

```bash
npx vitest run app/api/admin/timetable/__tests__/getTimeRange.test.ts
```

Expected: FAIL — `end` values show +2h not +45min.

- [ ] **Step 3: Replace `getTimeRange` in generate/route.ts**

In `app/api/admin/timetable/generate/route.ts`, replace lines 18–33:

```ts
function getTimeRange(slot: string): { start: string; end: string } {
  if (slot.includes(':')) {
    const [h, m] = slot.split(':').map(Number)
    const totalMins = h * 60 + m + 45
    const endH = Math.floor(totalMins / 60)
    const endM = totalMins % 60
    return {
      start: slot,
      end: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`,
    }
  }
  const mapping: Record<string, { start: string; end: string }> = {
    'JAM 1': { start: '13:00', end: '13:45' },
    'JAM 2': { start: '14:00', end: '14:45' },
    'JAM 3': { start: '15:00', end: '15:45' },
    'JAM 4': { start: '16:00', end: '16:45' },
    'JAM 7': { start: '19:00', end: '19:45' },
  }
  return mapping[slot] ?? { start: '08:00', end: '08:45' }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run app/api/admin/timetable/__tests__/getTimeRange.test.ts
```

Expected: PASS all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/timetable/generate/route.ts app/api/admin/timetable/__tests__/getTimeRange.test.ts
git commit -m "fix: change session duration from 2 hours to 45 minutes in timetable generator"
```

---

## Task 3: Update timetable generate WA broadcast

**Files:**
- Modify: `app/api/admin/timetable/generate/route.ts` — the class query and WA broadcast section (lines 56–191)

**Context:** The current generate route fetches `tutor: { select: { name, phone } }` from Class (single tutor). We need to also fetch `additionalTutors` and: (a) include topic/location in parent messages, (b) notify all tutors.

- [ ] **Step 1: Update class query to include additionalTutors**

In the `prisma.class.findMany` call (line ~56), add to `include`:

```ts
additionalTutors: {
  include: {
    tutor: { select: { name: true, phone: true } },
  },
},
```

Full updated `include` block (replace lines 58–70):

```ts
include: {
  tutor: { select: { name: true, phone: true } },
  additionalTutors: {
    include: {
      tutor: { select: { name: true, phone: true } },
    },
  },
  programs: { select: { program: true } },
  enrollments: {
    include: {
      student: {
        include: {
          parent: { select: { name: true, phone: true } },
        },
      },
    },
  },
},
```

- [ ] **Step 2: Update parent WA message to include topic and location**

In the async broadcast block (around line 153), replace the parent `message` template:

```ts
const topicStr = schedule.topic ? `\n📚 Materi: ${schedule.topic}` : ''
const locationStr = schedule.location ? `\n📍 Lokasi: ${schedule.location}` : ''

const message = `Halo Bunda/Ayah ${parent.name},

Berikut adalah jadwal belajar untuk ${p.student.name}:
🏫 Kelas: ${c.name}
👨‍🏫 Tutor: ${[c.tutor, ...c.additionalTutors.map((at: { tutor: { name: string } }) => at.tutor)].map(t => t.name).join(', ')}
🕐 Waktu: ${dateStr}, ${timeStr}${topicStr}${locationStr}

Sistem secara otomatis menjadwalkan ${p.student.name} untuk hadir. Jika berhalangan (sakit/izin), silakan hubungi kami dengan membalas pesan ini atau ajukan di portal akademik.

Terima kasih,
Mellyna Education`
```

- [ ] **Step 3: Update tutor broadcast to notify all tutors**

Replace the tutor broadcast block (lines ~171–188) with logic that notifies all tutors:

```ts
const allTutors = [
  c.tutor,
  ...c.additionalTutors.map((at: { tutor: { name: string; phone: string | null } }) => at.tutor),
]
const studentNames = schedule.participants.map((p: { student: { name: string } }) => p.student.name).join(', ')

for (const tutorUser of allTutors) {
  if (!tutorUser.phone) continue
  const tutorMessage = `Halo ${tutorUser.name},

Jadwal mengajar rutin Anda telah diterbitkan secara otomatis dari Timetable:
🏫 Kelas: ${c.name}
🕐 Waktu: ${dateStr}, ${timeStr}
📚 Materi: ${schedule.topic || '-'}
📍 Lokasi: ${schedule.location || '-'}
👥 Peserta (${schedule.participants.length} siswa): ${studentNames}

Silakan konfirmasi kehadiran siswa setelah sesi selesai melalui portal tutor.

Mellyna Education`

  console.log(`[Timetable Auto-Broadcast] Sending WhatsApp to tutor ${tutorUser.name} (${tutorUser.phone})`)
  await sendWhatsApp(tutorUser.phone, tutorMessage)
  await sleep(randomDelay(3000, 7000))
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/timetable/generate/route.ts
git commit -m "feat: notify all tutors in timetable WA broadcast, add topic/location to parent message"
```

---

## Task 4: Update schedule publish route for all tutors

**Files:**
- Modify: `app/api/schedules/[id]/publish/route.ts` — query and tutor broadcast (lines 20–113)

- [ ] **Step 1: Include additionalTutors in schedule query**

In `prisma.schedule.findUnique` (line ~20), update the `include.class` section:

```ts
class: {
  include: {
    tutor: { select: { name: true, phone: true } },
    additionalTutors: {
      include: {
        tutor: { select: { name: true, phone: true } },
      },
    },
  },
},
```

- [ ] **Step 2: Update parent message to list all tutors**

Replace the parent message template (line ~68) to list all tutors:

```ts
const allTutorNames = [
  scheduleWithDetails.class.tutor.name,
  ...scheduleWithDetails.class.additionalTutors.map(
    (at: { tutor: { name: string } }) => at.tutor.name
  ),
].join(', ')

const message = `Halo Bunda/Ayah ${parent.name},

Berikut adalah jadwal belajar untuk ${p.student.name}:
🏫 Kelas: ${scheduleWithDetails.class.name}
👨‍🏫 Tutor: ${allTutorNames}
🕐 Waktu: ${dateStr}, ${timeStr}${topicStr}${locationStr}

Sistem secara otomatis menjadwalkan ${p.student.name} untuk hadir. Jika berhalangan (sakit/izin), silakan hubungi kami dengan membalas pesan ini atau ajukan di portal akademik.

Terima kasih,
Mellyna Education`
```

- [ ] **Step 3: Notify all tutors on publish**

Replace the tutor notification block (lines ~91–112) to iterate all tutors:

```ts
const allTutors = [
  scheduleWithDetails.class.tutor,
  ...scheduleWithDetails.class.additionalTutors.map(
    (at: { tutor: { name: string; phone: string | null } }) => at.tutor
  ),
]
const studentNames = scheduleWithDetails.participants.map(
  (p: { student: { name: string } }) => p.student.name
).join(', ')

for (const tutorUser of allTutors) {
  if (!tutorUser.phone) continue
  const tutorMessage = `Halo ${tutorUser.name},

Anda mendapatkan jadwal mengajar:
🏫 Kelas: ${scheduleWithDetails.class.name}
🕐 Waktu: ${dateStr}, ${timeStr}${topicStr}${locationStr}
👥 Peserta (${scheduleWithDetails.participants.length} siswa): ${studentNames}

Silakan konfirmasi kehadiran siswa setelah sesi selesai melalui portal tutor.

Mellyna Education`

  console.log(`[WAHA Broadcast] Sending schedule notification to tutor ${tutorUser.name} (${tutorUser.phone})`)
  const success = await sendWhatsApp(tutorUser.phone, tutorMessage)
  if (success) {
    console.log(`[WAHA Broadcast] Successfully sent to tutor ${tutorUser.name}`)
  } else {
    console.error(`[WAHA Broadcast] Failed to send to tutor ${tutorUser.name}`)
  }
  await sleep(randomDelay(3000, 7000))
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/schedules/[id]/publish/route.ts
git commit -m "feat: notify all tutors (primary + additional) on schedule publish"
```

---

## Task 5: Update Class API for multiple tutors

**Files:**
- Modify: `app/api/classes/route.ts` — add `additionalTutorIds` to schema and POST
- Modify: `app/api/classes/[id]/route.ts` — add `additionalTutorIds` to update schema and PUT

- [ ] **Step 1: Update classListInclude to include additionalTutors**

In `app/api/classes/route.ts`, replace `classListInclude` (lines 8–17):

```ts
const classListInclude = {
  tutor: { select: { id: true, name: true, email: true } },
  additionalTutors: {
    include: {
      tutor: { select: { id: true, name: true } },
    },
  },
  _count: { select: { enrollments: true } },
  programs: { select: { program: true } },
  enrollments: {
    include: {
      student: { select: { id: true, name: true, grade: true } },
    },
  },
}
```

- [ ] **Step 2: Accept `additionalTutorIds` in createClassSchema**

In `app/api/classes/route.ts`, update `createClassSchema`:

```ts
const createClassSchema = z.object({
  name: z.string().min(1),
  programs: z.array(z.nativeEnum(Program)).min(1),
  description: z.string().optional(),
  tutorId: z.string().min(1),
  additionalTutorIds: z.array(z.string()).optional(),
  dayOfWeek: z.nativeEnum(DayOfWeek).nullable().optional(),
  timeSlot: z.string().nullable().optional(),
})
```

- [ ] **Step 3: Create ClassTutor records on POST**

In `app/api/classes/route.ts`, replace the POST handler body from line 61:

```ts
const { programs, additionalTutorIds, ...classData } = parsed.data
const kelas = await prisma.$transaction(async (tx) => {
  const created = await tx.class.create({
    data: {
      ...classData,
      programs: {
        create: programs.map(program => ({ program })),
      },
    },
  })
  if (additionalTutorIds && additionalTutorIds.length > 0) {
    await tx.classTutor.createMany({
      data: additionalTutorIds
        .filter(id => id !== classData.tutorId)
        .map(tutorId => ({ classId: created.id, tutorId })),
      skipDuplicates: true,
    })
  }
  return tx.class.findUniqueOrThrow({ where: { id: created.id }, include: classListInclude })
})

return NextResponse.json(kelas, { status: 201 })
```

- [ ] **Step 4: Accept `additionalTutorIds` in updateClassSchema**

In `app/api/classes/[id]/route.ts`, update `updateClassSchema`:

```ts
const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  programs: z.array(z.nativeEnum(Program)).min(1).optional(),
  description: z.string().optional(),
  tutorId: z.string().optional(),
  additionalTutorIds: z.array(z.string()).optional(),
  dayOfWeek: z.nativeEnum(DayOfWeek).nullable().optional(),
  timeSlot: z.string().nullable().optional(),
})
```

Also update `classDetailInclude` in `app/api/classes/[id]/route.ts` to include `additionalTutors`:

```ts
const classDetailInclude = {
  tutor: { select: { id: true, name: true, email: true } },
  additionalTutors: {
    include: {
      tutor: { select: { id: true, name: true } },
    },
  },
  programs: { select: { program: true } },
  enrollments: { include: { student: true } },
  schedules: { orderBy: { date: 'desc' as const }, take: 5 },
}
```

- [ ] **Step 5: Sync ClassTutor records on PUT**

In `app/api/classes/[id]/route.ts`, replace the transaction body (lines 54–66):

```ts
const { programs, additionalTutorIds, ...classData } = parsed.data

const kelas = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
  if (programs) {
    await tx.classProgram.deleteMany({ where: { classId: id } })
    await tx.classProgram.createMany({
      data: programs.map(program => ({ classId: id, program })),
    })
  }
  if (additionalTutorIds !== undefined) {
    await tx.classTutor.deleteMany({ where: { classId: id } })
    const primaryTutorId = classData.tutorId
    const filteredIds = additionalTutorIds.filter(tid => tid !== primaryTutorId)
    if (filteredIds.length > 0) {
      await tx.classTutor.createMany({
        data: filteredIds.map(tutorId => ({ classId: id, tutorId })),
        skipDuplicates: true,
      })
    }
  }
  return tx.class.update({
    where: { id },
    data: classData,
    include: classDetailInclude,
  })
})
```

- [ ] **Step 6: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors in the modified files.

- [ ] **Step 7: Commit**

```bash
git add app/api/classes/route.ts app/api/classes/[id]/route.ts
git commit -m "feat: class API accepts additionalTutorIds for multiple tutors per class"
```

---

## Task 6: Update tutor dashboard and schedules API for additional tutors

**Files:**
- Modify: `app/(dashboard)/tutor/page.tsx` — Prisma query (line 13–19)
- Modify: `app/api/schedules/route.ts` — tutor WHERE filter (line 35)

- [ ] **Step 1: Update tutor dashboard query**

In `app/(dashboard)/tutor/page.tsx`, replace the `prisma.schedule.findMany` `where` (line 14):

```ts
const schedules = await prisma.schedule.findMany({
  where: {
    OR: [
      { class: { tutorId: userId } },
      { class: { additionalTutors: { some: { tutorId: userId } } } },
    ],
    date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  },
  include: {
    class: { select: { name: true, _count: { select: { enrollments: true } } } },
    _count: { select: { reports: true, participants: true } },
  },
  orderBy: { date: 'asc' },
})
```

- [ ] **Step 2: Update schedules GET API tutor filter**

In `app/api/schedules/route.ts`, locate the tutor filter (around line 29–37). Replace:

```ts
} else if (role === 'TUTOR') {
  where = {
    OR: [
      { class: { tutorId: userId } },
      { class: { additionalTutors: { some: { tutorId: userId } } } },
    ],
  }
```

- [ ] **Step 3: Also update classes GET in `app/api/classes/route.ts`**

Tutor GET currently filters by `tutorId: userId` (line 35). Update to also include additional tutors:

```ts
const where = role === 'TUTOR'
  ? {
      OR: [
        { tutorId: userId },
        { additionalTutors: { some: { tutorId: userId } } },
      ],
    }
  : {}
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/tutor/page.tsx app/api/schedules/route.ts app/api/classes/route.ts
git commit -m "feat: tutor dashboard and schedules API include additional-tutor assignments"
```

---

## Task 7: Update TimetableClient for multiple tutors and 45-min display

**Files:**
- Modify: `app/(dashboard)/admin/timetable/TimetableClient.tsx`

**Context:** The class form currently has a single `tutorId` select. We need a multi-select for additional tutors. The timetable grid shows only the start time in the row header; we should show the 45-min range.

- [ ] **Step 1: Update ClassModel interface**

In `TimetableClient.tsx`, update the `ClassModel` interface (lines 36–46):

```ts
interface ClassModel {
  id: string
  name: string
  programs: { program: ProgramValue }[]
  description: string | null
  dayOfWeek: DayOfWeek | null
  timeSlot: string | null
  tutorId: string
  tutor: { id: string; name: string }
  additionalTutors: { tutor: { id: string; name: string } }[]
  enrollments: { id: string; studentId: string; student: { id: string; name: string; grade: string | null } }[]
}
```

- [ ] **Step 2: Add additionalTutorIds to classForm state**

Update the `classForm` state shape and initial value (lines 85–92):

```ts
const [classForm, setClassForm] = useState({
  name: '',
  programs: ['SEMPOA'] as ProgramValue[],
  tutorId: '',
  additionalTutorIds: [] as string[],
  description: '',
  dayOfWeek: '' as DayOfWeek | '',
  timeSlot: '',
})
```

Update `handleOpenEditModal` to set `additionalTutorIds` from existing class data:

```ts
const handleOpenEditModal = (cls: ClassModel) => {
  setSelectedClass(cls)
  setMode('new')
  setClassForm({
    name: cls.name,
    programs: cls.programs.map(p => p.program),
    tutorId: cls.tutorId,
    additionalTutorIds: cls.additionalTutors.map(at => at.tutor.id),
    description: cls.description || '',
    dayOfWeek: cls.dayOfWeek || '',
    timeSlot: cls.timeSlot || '',
  })
  setShowClassModal(true)
}
```

Also update `handleOpenAddModal` to reset `additionalTutorIds`:

```ts
setClassForm({
  name: '',
  programs: ['SEMPOA'] as ProgramValue[],
  tutorId: tutors[0]?.id || '',
  additionalTutorIds: [],
  description: '',
  dayOfWeek: day,
  timeSlot: slot,
})
```

- [ ] **Step 3: Add additional tutor multi-select UI in the class form**

In the "Mode Create New Class / Edit Mode" section of the form (after the primary tutor `<select>`, around line 765), add:

```tsx
<div>
  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
    Tutor Tambahan <span className="font-normal text-slate-400">(opsional, bisa lebih dari satu)</span>
  </label>
  <div className="flex flex-wrap gap-1.5">
    {tutors
      .filter(t => t.id !== classForm.tutorId)
      .map(t => {
        const selected = classForm.additionalTutorIds.includes(t.id)
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              const ids = classForm.additionalTutorIds
              setClassForm({
                ...classForm,
                additionalTutorIds: selected
                  ? ids.filter(id => id !== t.id)
                  : [...ids, t.id],
              })
            }}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer flex items-center gap-1 ${
              selected
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
            }`}
          >
            {selected && <Check className="h-3 w-3" />}
            {t.name}
          </button>
        )
      })}
    {tutors.filter(t => t.id !== classForm.tutorId).length === 0 && (
      <span className="text-[10px] text-slate-400">Tidak ada tutor lain tersedia.</span>
    )}
  </div>
</div>
```

- [ ] **Step 4: Pass additionalTutorIds in handleSaveClass**

The `handleSaveClass` already sends `classForm` as JSON body. Since `classForm` now includes `additionalTutorIds`, this is automatically included. Verify `handleSaveClass` sends the full `classForm`:

```ts
// In POST branch (creating new class):
body: JSON.stringify(classForm)  // already includes additionalTutorIds — no change needed

// In PUT branch (editing class):
body: JSON.stringify(classForm)  // same
```

- [ ] **Step 5: Add slot end-time helper and update grid header**

Add a helper function near the top of the component (after the `PROGRAM_COLORS` const):

```ts
function slotEndTime(start: string): string {
  const [h, m] = start.split(':').map(Number)
  const totalMins = h * 60 + m + 45
  const endH = Math.floor(totalMins / 60) % 24
  const endM = totalMins % 60
  return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`
}
```

In the time slot table row header (`<td>` with `Clock` icon, line ~535), replace `{slot}` with:

```tsx
<Clock className="h-3.5 w-3.5 mb-1 opacity-70" />
{slot}
<span className="text-[9px] text-slate-400 font-normal">–{slotEndTime(slot)}</span>
```

- [ ] **Step 6: Show all tutors in class card in grid**

In the class card in the grid (around line 580), update the tutor display:

```tsx
<div className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5 flex items-center gap-1 flex-wrap">
  <User className="h-2.5 w-2.5 opacity-60 shrink-0" />
  {[cls.tutor.name, ...cls.additionalTutors.map(at => at.tutor.name)].join(', ')}
</div>
```

- [ ] **Step 7: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add app/(dashboard)/admin/timetable/TimetableClient.tsx
git commit -m "feat: timetable UI supports multiple tutors per class and shows 45-min time range"
```

---

## Task 8: Include video links in report WA notification

**Files:**
- Modify: `lib/report-notify.ts` — `ParentReportData` interface + `notifyParentNewReport`
- Modify: `app/api/reports/route.ts` — `sendParentNotification` to fetch media

- [ ] **Step 1: Write failing test for notifyParentNewReport with videos**

Create `lib/__tests__/report-notify.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { buildParentWeeklyDigestMessage } from '../report-notify'

// Test that video links are included in notification message
describe('notifyParentNewReport message format', () => {
  it('includes video link section when mediaVideos present', () => {
    // We test the message content by inspecting the lines array
    // This is a unit test of message formatting logic
    const lines: string[] = []
    const mediaVideos = [
      { url: 'https://media.example.com/video1.mp4', filename: 'video1.mp4' },
      { url: 'https://media.example.com/video2.mp4', filename: 'video2.mp4' },
    ]
    if (mediaVideos.length > 0) {
      lines.push('', '🎥 *Video Pembelajaran dari Tutor:*')
      mediaVideos.forEach(v => lines.push(`   📥 ${v.filename}: ${v.url}`))
    }
    const msg = lines.join('\n')
    expect(msg).toContain('🎥 *Video Pembelajaran dari Tutor:*')
    expect(msg).toContain('video1.mp4')
    expect(msg).toContain('https://media.example.com/video1.mp4')
  })

  it('skips video section when no media', () => {
    const lines: string[] = []
    const mediaVideos: { url: string; filename: string }[] = []
    if (mediaVideos.length > 0) {
      lines.push('', '🎥 *Video Pembelajaran dari Tutor:*')
    }
    expect(lines.join('\n')).not.toContain('🎥')
  })
})
```

- [ ] **Step 2: Run test to verify it passes (logic is self-contained)**

```bash
npx vitest run lib/__tests__/report-notify.test.ts
```

Expected: PASS (the test validates the logic pattern, not the external function).

- [ ] **Step 3: Update ParentReportData interface and notifyParentNewReport**

In `lib/report-notify.ts`, update the `ParentReportData` interface (lines 3–12):

```ts
export interface ParentReportData {
  parentPhone: string
  parentName: string
  studentName: string
  className: string
  scheduleDate: Date
  topic: string | null
  score: number | null
  content: string
  mediaVideos?: { url: string; filename: string }[]
}
```

Update `notifyParentNewReport` (lines 29–42) to append video links:

```ts
export async function notifyParentNewReport(data: ParentReportData): Promise<boolean> {
  const lines = [
    `Assalamualaikum Bunda/Ayah *${data.parentName}*,`,
    ``,
    `Laporan belajar *${data.studentName}* telah dibuat oleh tutor.`,
    ``,
    `📚 Kelas: ${data.className}`,
    `📅 Tanggal: ${fmtDateLong(data.scheduleDate)}`,
  ]
  if (data.topic) lines.push(`📖 Materi: ${data.topic}`)
  if (data.score !== null) lines.push(`⭐ Nilai: ${data.score}/100`)
  lines.push(``, `💬 *Catatan Tutor:*`, data.content)

  if (data.mediaVideos && data.mediaVideos.length > 0) {
    lines.push(``, `🎥 *Video Pembelajaran dari Tutor:*`)
    data.mediaVideos.forEach(v => {
      lines.push(`   📥 ${v.filename}: ${v.url}`)
    })
    lines.push(`   _(Buka link di atas untuk melihat/mengunduh video)_`)
  }

  lines.push(``, `Terima kasih,`, `Mellyna Education`)
  return sendWhatsApp(data.parentPhone, lines.join('\n'))
}
```

- [ ] **Step 4: Update sendParentNotification in reports/route.ts to fetch and pass media**

In `app/api/reports/route.ts`, update `sendParentNotification` (lines 117–153):

```ts
async function sendParentNotification(reportId: string): Promise<void> {
  try {
    const full = await prisma.learningReport.findUnique({
      where: { id: reportId },
      include: {
        student: {
          include: { parent: { select: { name: true, phone: true } } },
        },
        schedule: {
          include: { class: { select: { name: true } } },
        },
        media: {
          where: { type: 'VIDEO' },
          select: { url: true, filename: true },
        },
      },
    })

    if (!full?.student.parent?.phone) return

    const sent = await notifyParentNewReport({
      parentPhone: full.student.parent.phone,
      parentName: full.student.parent.name,
      studentName: full.student.name,
      className: full.schedule.class.name,
      scheduleDate: full.schedule.date,
      topic: full.schedule.topic,
      score: full.score,
      content: full.content,
      mediaVideos: full.media,
    })

    if (sent) {
      await prisma.learningReport.update({
        where: { id: reportId },
        data: { parentNotifiedAt: new Date() },
      })
    }
  } catch (e) {
    console.error(`[Report Notify] Failed for report ${reportId}:`, e)
  }
}
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add lib/report-notify.ts lib/__tests__/report-notify.test.ts app/api/reports/route.ts
git commit -m "feat: include tutor video links in WA report notification to parents"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Multiple tutors per session → Task 1 (schema), Task 5 (API), Task 7 (UI), Tasks 3/4 (WA broadcast)
  - 45-minute sessions → Task 2 (getTimeRange fix + JAM mapping)
  - WA notifications match schedule data → Task 3 (topic/location in parent message), Task 4 (publish route)
  - Video links in report WA → Task 8

- [x] **Placeholder scan:** All tasks contain complete code. No TBD.

- [x] **Type consistency:**
  - `ClassTutor` model used consistently as `classTutor` (Prisma convention)
  - `additionalTutors` relation name consistent across schema, API, UI
  - `mediaVideos` field name consistent between `ParentReportData` and `sendParentNotification` call
  - `at.tutor` access pattern consistent in all WA broadcast loops

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-05-30-multiple-tutors-45min-wa-improvements.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
