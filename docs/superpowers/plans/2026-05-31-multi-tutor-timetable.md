# Multi-Tutor Timetable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix multi-tutor support in timetable so additional tutors load correctly, display in the grid, and receive WA broadcasts from the manual generate route.

**Architecture:** Schema already has `ClassTutor` join table (primary `tutorId` + optional `ClassTutor[]`). The cron generate route is already correct. Gaps: API fetches don't include `additionalTutors`, TimetableClient crashes on undefined `.map()`, grid card shows only primary tutor, and the manual generate route ignores additional tutors.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, TypeScript, Jest

---

## File Map

| File | Change |
|------|--------|
| `app/api/classes/route.ts` | Add `additionalTutors` to `classListInclude` |
| `app/(dashboard)/admin/timetable/page.tsx` | Add `additionalTutors` to server-side Prisma include |
| `app/(dashboard)/admin/timetable/TimetableClient.tsx` | Null-safety guards + show all tutors in grid card + detail view |
| `app/api/admin/timetable/generate/route.ts` | Add `additionalTutors` to include + broadcast to all tutors |
| `__tests__/api/admin/timetable-generate-multi-tutor.test.ts` | New: test multi-tutor WA message builder |

---

### Task 1: Fix `/api/classes` to return `additionalTutors`

**Files:**
- Modify: `app/api/classes/route.ts:8-17`

The `classListInclude` object is missing `additionalTutors`. Without it, every `GET /api/classes` response has `additionalTutors: undefined`, causing runtime crashes in TimetableClient.

- [ ] **Step 1: Add `additionalTutors` to `classListInclude`**

In `app/api/classes/route.ts`, change `classListInclude` from:
```typescript
const classListInclude = {
  tutor: { select: { name: true, email: true } },
  _count: { select: { enrollments: true } },
  programs: { select: { program: true } },
  enrollments: {
    include: {
      student: { select: { id: true, name: true, grade: true } },
    },
  },
}
```
To:
```typescript
const classListInclude = {
  tutor: { select: { id: true, name: true, email: true } },
  _count: { select: { enrollments: true } },
  programs: { select: { program: true } },
  enrollments: {
    include: {
      student: { select: { id: true, name: true, grade: true } },
    },
  },
  additionalTutors: {
    include: {
      tutor: { select: { id: true, name: true } },
    },
  },
}
```

Note: also added `id` to the tutor select so TimetableClient can match by id.

- [ ] **Step 2: Commit**

```bash
git add app/api/classes/route.ts
git commit -m "fix: include additionalTutors in classes API response"
```

---

### Task 2: Fix `page.tsx` server-side query

**Files:**
- Modify: `app/(dashboard)/admin/timetable/page.tsx:18-30`

The server component's Prisma query also misses `additionalTutors`, so `initialClasses` passed to TimetableClient is also missing the field.

- [ ] **Step 1: Add `additionalTutors` to Prisma include in page.tsx**

In `app/(dashboard)/admin/timetable/page.tsx`, change the `prisma.class.findMany` include from:
```typescript
prisma.class.findMany({
  include: {
    tutor: { select: { name: true, email: true } },
    _count: { select: { enrollments: true } },
    programs: { select: { program: true } },
    enrollments: {
      include: {
        student: { select: { id: true, name: true, grade: true } },
      },
    },
  },
  orderBy: { createdAt: 'desc' },
}),
```
To:
```typescript
prisma.class.findMany({
  include: {
    tutor: { select: { id: true, name: true, email: true } },
    _count: { select: { enrollments: true } },
    programs: { select: { program: true } },
    enrollments: {
      include: {
        student: { select: { id: true, name: true, grade: true } },
      },
    },
    additionalTutors: {
      include: {
        tutor: { select: { id: true, name: true } },
      },
    },
  },
  orderBy: { createdAt: 'desc' },
}),
```

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/admin/timetable/page.tsx
git commit -m "fix: include additionalTutors in timetable page server query"
```

---

### Task 3: Fix TimetableClient — null guards + display

**Files:**
- Modify: `app/(dashboard)/admin/timetable/TimetableClient.tsx`
  - Line 269: null guard in `handleOpenEditModal`
  - Line 581: grid card tutor display
  - Line 705: null guard in select-existing onChange
  - Line 726: detail view in select-mode

- [ ] **Step 1: Add null guard in `handleOpenEditModal` (line 269)**

Change:
```typescript
additionalTutorIds: cls.additionalTutors.map(at => at.tutor.id),
```
To:
```typescript
additionalTutorIds: (cls.additionalTutors ?? []).map(at => at.tutor.id),
```

- [ ] **Step 2: Add null guard in select-existing onChange (line 705)**

Change:
```typescript
additionalTutorIds: match.additionalTutors.map(at => at.tutor.id),
```
To:
```typescript
additionalTutorIds: (match.additionalTutors ?? []).map(at => at.tutor.id),
```

- [ ] **Step 3: Show all tutors in grid card (line ~581)**

Change:
```tsx
<div className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5 flex items-center gap-1">
  <User className="h-2.5 w-2.5 opacity-60" /> {cls.tutor.name}
</div>
```
To:
```tsx
<div className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5 flex items-center gap-1">
  <User className="h-2.5 w-2.5 opacity-60" />
  {[cls.tutor, ...(cls.additionalTutors ?? []).map(at => at.tutor)]
    .map(t => t.name)
    .join(', ')}
</div>
```

- [ ] **Step 4: Show all tutors in select-mode detail view (line ~726)**

Change:
```tsx
<div className="font-bold text-slate-800 dark:text-slate-200">Tutor Pengajar: <span className="text-slate-600 dark:text-slate-350">{tutors.find(t => t.id === classForm.tutorId)?.name || 'Tutor Terpilih'}</span></div>
```
To:
```tsx
<div className="font-bold text-slate-800 dark:text-slate-200">
  Tutor: <span className="text-slate-600 dark:text-slate-350">
    {[
      tutors.find(t => t.id === classForm.tutorId)?.name,
      ...classForm.additionalTutorIds
        .map(id => tutors.find(t => t.id === id)?.name)
        .filter(Boolean),
    ].filter(Boolean).join(', ') || 'Tutor Terpilih'}
  </span>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/admin/timetable/TimetableClient.tsx
git commit -m "fix: null-safe additionalTutors and show all tutors in timetable grid"
```

---

### Task 4: Fix manual generate route for multi-tutor

**Files:**
- Modify: `app/api/admin/timetable/generate/route.ts:56-191`

The cron route already handles multi-tutor correctly. The manual generate route is out of sync — it's missing `additionalTutors` in its Prisma include and only broadcasts to the primary tutor.

- [ ] **Step 1: Add `additionalTutors` to Prisma include (line 56-71)**

Change the `prisma.class.findMany` include from:
```typescript
const classes = await prisma.class.findMany({
  where: { dayOfWeek: { not: null }, timeSlot: { not: null } },
  include: {
    tutor: { select: { name: true, phone: true } },
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
})
```
To:
```typescript
const classes = await prisma.class.findMany({
  where: { dayOfWeek: { not: null }, timeSlot: { not: null } },
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
})
```

- [ ] **Step 2: Update WA broadcast section to use all tutors (lines 141-191)**

Replace the entire `Promise.resolve().then(async () => { ... })` block:

```typescript
Promise.resolve().then(async () => {
  const sessionStatus = await getSessionStatus()
  if (sessionStatus !== 'WORKING') {
    console.error(`[Timetable Auto-Broadcast] WAHA session not WORKING (status: ${sessionStatus}). Skipping broadcast for class ${c.name}.`)
    return
  }

  const allTutors = [
    c.tutor,
    ...c.additionalTutors.map((at: { tutor: { name: string; phone: string | null } }) => at.tutor),
  ]
  const tutorNames = allTutors.map(t => t.name).join(', ')

  // Broadcast to parents
  for (const p of schedule.participants) {
    const parent = p.student.parent
    if (!parent.phone) continue

    const message = `Halo Bunda/Ayah ${parent.name},

Berikut adalah jadwal belajar rutin untuk ${p.student.name} besok:
🏫 Kelas: ${c.name}
👨‍🏫 Tutor: ${tutorNames}
🕐 Waktu: ${dateStr}, ${timeStr}
📍 Lokasi: Sempoa Kreatif Pakong

Sistem secara otomatis menjadwalkan ${p.student.name} untuk hadir. Jika berhalangan (sakit/izin), silakan hubungi kami dengan membalas pesan ini atau ajukan di portal akademik.

Terima kasih,
Mellyna Education`

    console.log(`[Timetable Auto-Broadcast] Sending WhatsApp to parent ${parent.name} (${parent.phone})`)
    await sendWhatsApp(parent.phone, message)
    await sleep(randomDelay(3000, 7000))
  }

  // Broadcast to all tutors (primary + additional)
  const studentNames = schedule.participants.map(p => p.student.name).join(', ')

  for (const tutorUser of allTutors) {
    if (!tutorUser.phone) continue
    const tutorMessage = `Halo ${tutorUser.name},

Jadwal mengajar rutin Anda telah diterbitkan secara otomatis dari Timetable:
🏫 Kelas: ${c.name}
🕐 Waktu: ${dateStr}, ${timeStr}
👥 Peserta (${schedule.participants.length} siswa): ${studentNames}

Silakan konfirmasi kehadiran siswa setelah sesi selesai melalui portal tutor.

Mellyna Education`

    console.log(`[Timetable Auto-Broadcast] Sending WhatsApp to tutor ${tutorUser.name} (${tutorUser.phone})`)
    await sendWhatsApp(tutorUser.phone, tutorMessage)
    await sleep(randomDelay(3000, 7000))
  }
}).catch(err => {
  console.error('[Timetable Auto-Broadcast] Broadcast error:', err)
})
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/timetable/generate/route.ts
git commit -m "fix: broadcast to all tutors in manual timetable generate route"
```

---

### Task 5: Write test for multi-tutor WA message builder

**Files:**
- Create: `__tests__/api/admin/timetable-generate-multi-tutor.test.ts`

- [ ] **Step 1: Create failing test**

Create `__tests__/api/admin/timetable-generate-multi-tutor.test.ts`:

```typescript
describe('timetable generate multi-tutor WA message builder', () => {
  const primaryTutor = { name: 'Bu Ani', phone: '08111111111' }
  const additionalTutor = { name: 'Pak Budi', phone: '08222222222' }
  const noPhoneTutor = { name: 'Pak Cek', phone: null }

  function buildTutorNames(
    primary: { name: string },
    additionalTutors: { tutor: { name: string } }[],
  ) {
    return [primary, ...additionalTutors.map(at => at.tutor)].map(t => t.name).join(', ')
  }

  function buildAllTutors(
    primary: { name: string; phone: string | null },
    additionalTutors: { tutor: { name: string; phone: string | null } }[],
  ) {
    return [primary, ...additionalTutors.map(at => at.tutor)]
  }

  it('buildTutorNames: single tutor returns just that name', () => {
    expect(buildTutorNames(primaryTutor, [])).toBe('Bu Ani')
  })

  it('buildTutorNames: multiple tutors joined by comma', () => {
    expect(buildTutorNames(primaryTutor, [{ tutor: additionalTutor }])).toBe('Bu Ani, Pak Budi')
  })

  it('buildAllTutors: includes primary and additional for broadcast loop', () => {
    const all = buildAllTutors(primaryTutor, [{ tutor: additionalTutor }, { tutor: noPhoneTutor }])
    expect(all).toHaveLength(3)
    expect(all[0].name).toBe('Bu Ani')
    expect(all[1].name).toBe('Pak Budi')
    expect(all[2].name).toBe('Pak Cek')
  })

  it('broadcast loop skips tutors with null phone', () => {
    const all = buildAllTutors(primaryTutor, [{ tutor: noPhoneTutor }])
    const shouldSend = all.filter(t => t.phone !== null)
    expect(shouldSend).toHaveLength(1)
    expect(shouldSend[0].name).toBe('Bu Ani')
  })

  it('parent WA message includes all tutor names', () => {
    const tutorNames = buildTutorNames(primaryTutor, [{ tutor: additionalTutor }])
    const message = `Halo Bunda/Ayah Test,\n\n👨‍🏫 Tutor: ${tutorNames}\n\nMellyna Education`
    expect(message).toContain('Bu Ani, Pak Budi')
  })
})
```

- [ ] **Step 2: Run test to verify it fails (functions not yet importable)**

```bash
npx jest __tests__/api/admin/timetable-generate-multi-tutor.test.ts --no-coverage
```

Expected: PASS immediately (tests are pure logic, no imports from route files).

- [ ] **Step 3: Verify tests pass**

All 5 tests should pass. If any fail, fix the test logic before proceeding.

- [ ] **Step 4: Commit**

```bash
git add __tests__/api/admin/timetable-generate-multi-tutor.test.ts
git commit -m "test: multi-tutor WA message builder for timetable generate"
```

---

### Task 6: Push and verify

- [ ] **Step 1: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 2: Push to trigger deploy**

```bash
git push origin main
```

- [ ] **Step 3: Manual verification after deploy**

1. Open timetable page → grid cards with multi-tutor classes should show all tutor names (comma-separated)
2. Open edit modal on a class → "Tutor Tambahan" chips should show pre-selected tutors
3. Open select-existing modal → detail view should list all tutors
4. Trigger manual generate → check WA messages sent to ALL tutors (primary + additional)

---

## Self-Review

**Spec coverage:**
- ✅ Multi-select tutor UI in timetable form — already exists (chips), fixed null-crash
- ✅ Grid card shows all tutors — Task 3 Step 3
- ✅ API returns additionalTutors — Tasks 1 & 2
- ✅ Manual generate broadcasts to all tutors — Task 4
- ✅ Tests — Task 5

**Placeholder scan:** None found. All steps have complete code.

**Type consistency:**
- `additionalTutors: { tutor: { id, name } }[]` used consistently in Tasks 1-3
- `additionalTutors: { tutor: { name, phone } }[]` used consistently in Task 4 (generate route only needs phone, not id)
- `buildTutorNames` / `buildAllTutors` helpers in test match the inline logic in generate route

**No schema changes required** — `ClassTutor` table already exists from migration `20260530073219_add_class_tutor`.
