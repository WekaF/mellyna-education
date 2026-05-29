# Recurring Schedules & Teaching Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add weekly-recurring schedule creation and per-session teaching log (LearningReport) UI for tutors and parents.

**Architecture:**
- Recurring schedules use a "recurrence group" pattern: add `isRecurring`, `recurrenceGroupId`, and `recurrenceWeeks` to the existing `Schedule` model. Admin creates once; API generates N weekly Schedule records sharing the same `recurrenceGroupId`. Each instance is independent (cancel/modify without affecting siblings).
- Teaching log reuses the existing `LearningReport` model (already in schema: per-student, per-schedule, `content`, `score`, `media`). Missing pieces: API endpoints and UI for tutor input + parent history view.
- Flexible location is already supported (`location` field per Schedule). Add permission for TUTOR to update `location` and `topic` on their own class schedules.

**Tech Stack:** Next.js 14 App Router, Prisma ORM (PostgreSQL), NextAuth, Tailwind CSS, shadcn/ui

---

## Recommendation Summary

| Feature | Approach | Reason |
|---------|----------|--------|
| Recurring schedule | Recurrence group ID on Schedule | Existing queries unchanged; per-session independence |
| Flexible location | Already supported via `location` field | No schema change needed |
| Tutor update location/topic | Extend PUT /api/schedules/[id] TUTOR permission | Tutor knows where session happens |
| Teaching history | Existing `LearningReport` model | Schema already designed for this |

---

## File Structure

**Modified files:**
- `prisma/schema.prisma` — add `isRecurring`, `recurrenceGroupId`, `recurrenceWeeks` to Schedule
- `app/api/schedules/route.ts` — POST support recurring generation
- `app/api/schedules/[id]/route.ts` — PUT allow TUTOR to update location/topic; GET include reports
- `app/(dashboard)/parent/schedule/page.tsx` — include LearningReport data
- `components/dashboard/ParentScheduleList.tsx` — show report per completed session

**New files:**
- `app/api/reports/route.ts` — GET list reports (tutor/parent/admin views)
- `app/api/schedules/[id]/reports/route.ts` — POST create LearningReport (tutor)
- `app/(dashboard)/tutor/page.tsx` — tutor dashboard
- `app/(dashboard)/tutor/schedule/page.tsx` — tutor's schedule list with report action
- `components/dashboard/TutorScheduleList.tsx` — schedule cards + fill report modal

---

## Phase 1: Recurring Schedules

### Task 1: Schema Migration — Add Recurrence Fields

**Files:**
- Modify: `prisma/schema.prisma` (Schedule model, lines 112-129)

- [ ] **Step 1: Add recurrence fields to Schedule model**

Edit `prisma/schema.prisma` — replace the Schedule model:

```prisma
model Schedule {
  id                String         @id @default(cuid())
  classId           String
  class             Class          @relation(fields: [classId], references: [id])
  date              DateTime
  startTime         String
  endTime           String
  topic             String?
  location          String?
  status            ScheduleStatus @default(DRAFT)
  publishedAt       DateTime?
  isRecurring       Boolean        @default(false)
  recurrenceGroupId String?
  recurrenceWeeks   Int?
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  attendances  Attendance[]
  reports      LearningReport[]
  participants ScheduleParticipant[]

  @@index([recurrenceGroupId])
}
```

- [ ] **Step 2: Generate and apply migration**

```bash
npx prisma migrate dev --name add_schedule_recurrence
```

Expected: migration file created, database updated successfully.

- [ ] **Step 3: Verify schema applied**

```bash
npx prisma studio
```

Open Schedule table — confirm `isRecurring`, `recurrenceGroupId`, `recurrenceWeeks` columns exist.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add recurrence fields to Schedule model"
```

---

### Task 2: API — Recurring Schedule Creation

**Files:**
- Modify: `app/api/schedules/route.ts`

- [ ] **Step 1: Write failing test (manual)**

Using a REST client (or curl), POST to `/api/schedules` with body:
```json
{
  "classId": "<valid-class-id>",
  "date": "2026-06-02T00:00:00.000Z",
  "startTime": "09:00",
  "endTime": "11:00",
  "topic": "Matematika Dasar",
  "location": "Rumah Pak Budi",
  "studentIds": ["<student-id>"],
  "isRecurring": true,
  "recurrenceWeeks": 4
}
```
Expected before change: only 1 schedule created. Expected after: 4 schedules created.

- [ ] **Step 2: Update POST handler in `app/api/schedules/route.ts`**

Find the POST handler. Replace the body parse section and creation logic:

```typescript
// Inside the POST handler, after auth check
const body = await req.json();
const {
  classId,
  date,
  startTime,
  endTime,
  topic,
  location,
  studentIds,
  isRecurring = false,
  recurrenceWeeks = 1,
} = body;

if (!classId || !date || !startTime || !endTime || !studentIds?.length) {
  return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
}

const recurrenceGroupId = isRecurring ? crypto.randomUUID() : undefined;
const weeksCount = isRecurring ? Math.max(1, Math.min(52, recurrenceWeeks)) : 1;

// Generate one schedule per week
const baseDate = new Date(date);
const scheduleData = Array.from({ length: weeksCount }, (_, i) => {
  const scheduleDate = new Date(baseDate);
  scheduleDate.setDate(baseDate.getDate() + i * 7);
  return {
    classId,
    date: scheduleDate,
    startTime,
    endTime,
    topic: topic || undefined,
    location: location || undefined,
    status: "DRAFT" as const,
    isRecurring,
    recurrenceGroupId,
    recurrenceWeeks: isRecurring ? weeksCount : undefined,
  };
});

// Create all schedules in a transaction
const createdSchedules = await prisma.$transaction(
  scheduleData.map((data) =>
    prisma.schedule.create({
      data: {
        ...data,
        participants: {
          create: studentIds.map((studentId: string) => ({ studentId })),
        },
      },
    })
  )
);

return NextResponse.json(
  { schedules: createdSchedules, count: createdSchedules.length },
  { status: 201 }
);
```

- [ ] **Step 3: Test recurring creation**

POST to `/api/schedules` with `isRecurring: true, recurrenceWeeks: 4`.
Expected: response `{ schedules: [...], count: 4 }` with 4 schedules all sharing same `recurrenceGroupId`.

- [ ] **Step 4: Test non-recurring still works**

POST without `isRecurring` field.
Expected: `{ schedules: [{ ... }], count: 1 }` (single schedule, no recurrenceGroupId).

- [ ] **Step 5: Commit**

```bash
git add app/api/schedules/route.ts
git commit -m "feat(api): support recurring weekly schedule creation"
```

---

### Task 3: API — Tutor Can Update Location & Topic

**Files:**
- Modify: `app/api/schedules/[id]/route.ts`

- [ ] **Step 1: Find the PUT handler and identify the auth check**

Read `app/api/schedules/[id]/route.ts`. The PUT handler currently restricts to `SUPER_ADMIN`. We extend it to allow `TUTOR` to update only `location` and `topic` on schedules belonging to their class.

- [ ] **Step 2: Update PUT handler**

Replace the role check and update logic:

```typescript
// Inside PUT handler
const session = await getServerSession(authOptions);
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const schedule = await prisma.schedule.findUnique({
  where: { id: params.id },
  include: { class: true },
});
if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 });

const isSuperAdmin = session.user.role === "SUPER_ADMIN";
const isTutorOfClass = session.user.role === "TUTOR" && schedule.class.tutorId === session.user.id;

if (!isSuperAdmin && !isTutorOfClass) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

const body = await req.json();

// Tutors can only update location and topic
const updateData = isSuperAdmin
  ? {
      date: body.date ? new Date(body.date) : undefined,
      startTime: body.startTime,
      endTime: body.endTime,
      topic: body.topic,
      location: body.location,
      status: body.status,
    }
  : {
      topic: body.topic,
      location: body.location,
    };

const updated = await prisma.schedule.update({
  where: { id: params.id },
  data: updateData,
});

return NextResponse.json(updated);
```

- [ ] **Step 3: Test TUTOR can update location**

As TUTOR, PUT `/api/schedules/<id>` with `{ "location": "Kafe Belajar Jl. Merdeka 5" }`.
Expected: 200 OK, location updated.

- [ ] **Step 4: Test TUTOR cannot update date**

As TUTOR, PUT with `{ "date": "2026-07-01", "location": "somewhere" }`.
Expected: 200 OK but `date` unchanged, only `location` updated.

- [ ] **Step 5: Commit**

```bash
git add app/api/schedules/[id]/route.ts
git commit -m "feat(api): allow tutor to update schedule location and topic"
```

---

### Task 4: Admin UI — Recurring Schedule Toggle

**Files:**
- Modify: whichever admin component contains the schedule creation form (find with `grep -r "startTime" app/\(dashboard\)/admin/ --include="*.tsx" -l`)

- [ ] **Step 1: Locate the schedule creation form**

```bash
grep -r "startTime\|createSchedule\|POST.*schedules" app/\(dashboard\)/admin/ --include="*.tsx" -l
```

Note the file path returned.

- [ ] **Step 2: Add recurring fields to the form state**

In the form component, add to state:
```typescript
const [isRecurring, setIsRecurring] = useState(false);
const [recurrenceWeeks, setRecurrenceWeeks] = useState(12);
```

- [ ] **Step 3: Add recurring UI to the form JSX**

After the `location` input, add:

```tsx
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    id="isRecurring"
    checked={isRecurring}
    onChange={(e) => setIsRecurring(e.target.checked)}
    className="w-4 h-4"
  />
  <label htmlFor="isRecurring" className="text-sm font-medium">
    Jadwal Berulang Mingguan
  </label>
</div>

{isRecurring && (
  <div>
    <label className="text-sm font-medium">Jumlah Minggu</label>
    <input
      type="number"
      min={2}
      max={52}
      value={recurrenceWeeks}
      onChange={(e) => setRecurrenceWeeks(Number(e.target.value))}
      className="w-full border rounded px-3 py-2 mt-1"
    />
    <p className="text-xs text-muted-foreground mt-1">
      Akan membuat {recurrenceWeeks} jadwal mingguan sekaligus
    </p>
  </div>
)}
```

- [ ] **Step 4: Include recurring fields in the submit payload**

In the form submit handler, add to the POST body:
```typescript
isRecurring,
recurrenceWeeks: isRecurring ? recurrenceWeeks : 1,
```

- [ ] **Step 5: Update success message to show count**

After successful creation, if the API returns `{ count }`, show:
```typescript
toast.success(`${data.count} jadwal berhasil dibuat`);
```

- [ ] **Step 6: Test in browser**

1. Open admin schedule creation form
2. Check "Jadwal Berulang Mingguan", set 3 weeks
3. Submit
4. Verify 3 schedule entries appear in the schedule list

- [ ] **Step 7: Commit**

```bash
git add app/\(dashboard\)/admin/
git commit -m "feat(ui): add recurring weekly schedule toggle in admin form"
```

---

## Phase 2: Teaching Log (LearningReport)

### Task 5: API — Create LearningReport (Tutor)

**Files:**
- Create: `app/api/schedules/[id]/reports/route.ts`

- [ ] **Step 1: Write the test scenario (manual)**

As TUTOR, POST to `/api/schedules/<scheduleId>/reports` with:
```json
{
  "studentId": "<student-id>",
  "content": "Hari ini belajar penjumlahan dan pengurangan. Siswa sudah bisa mengerjakan soal latihan.",
  "score": 85
}
```
Expected: 201 Created with LearningReport object.

- [ ] **Step 2: Create `app/api/schedules/[id]/reports/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "TUTOR" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: params.id },
    include: { class: true },
  });
  if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

  if (session.user.role === "TUTOR" && schedule.class.tutorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentId, content, score } = await req.json();
  if (!studentId || !content) {
    return NextResponse.json({ error: "studentId and content required" }, { status: 400 });
  }

  // Verify student is a participant
  const participant = await prisma.scheduleParticipant.findUnique({
    where: { scheduleId_studentId: { scheduleId: params.id, studentId } },
  });
  if (!participant) {
    return NextResponse.json({ error: "Student not in this schedule" }, { status: 400 });
  }

  const report = await prisma.learningReport.upsert({
    where: { studentId_scheduleId: { studentId, scheduleId: params.id } },
    create: {
      studentId,
      scheduleId: params.id,
      tutorId: session.user.id,
      content,
      score: score ?? null,
    },
    update: {
      content,
      score: score ?? null,
    },
    include: { student: true },
  });

  return NextResponse.json(report, { status: 201 });
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reports = await prisma.learningReport.findMany({
    where: { scheduleId: params.id },
    include: {
      student: { select: { id: true, name: true, grade: true } },
      tutor: { select: { id: true, name: true } },
      media: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(reports);
}
```

- [ ] **Step 3: Test POST creates report**

POST to `/api/schedules/<id>/reports` as TUTOR.
Expected: 201 with report object including student name.

- [ ] **Step 4: Test upsert — second POST updates, not duplicates**

POST same studentId + scheduleId again with different content.
Expected: 200, report updated (no duplicate error).

- [ ] **Step 5: Commit**

```bash
git add app/api/schedules/[id]/reports/
git commit -m "feat(api): add LearningReport create/list endpoint for schedule"
```

---

### Task 6: API — List Reports (Parent History View)

**Files:**
- Create: `app/api/reports/route.ts`

- [ ] **Step 1: Create `app/api/reports/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const tutorId = searchParams.get("tutorId");

  let where: Record<string, unknown> = {};

  if (session.user.role === "PARENT") {
    // Parent sees only their children's reports
    const children = await prisma.student.findMany({
      where: { parentId: session.user.id },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);
    where = { studentId: { in: childIds } };
    if (studentId && childIds.includes(studentId)) {
      where = { studentId };
    }
  } else if (session.user.role === "TUTOR") {
    where = { tutorId: session.user.id };
    if (studentId) where = { ...where, studentId };
  } else if (session.user.role === "SUPER_ADMIN") {
    if (studentId) where = { studentId };
    if (tutorId) where = { ...where, tutorId };
  }

  const reports = await prisma.learningReport.findMany({
    where,
    include: {
      student: { select: { id: true, name: true, grade: true } },
      tutor: { select: { id: true, name: true } },
      schedule: {
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          topic: true,
          location: true,
          class: { select: { name: true, subject: true } },
        },
      },
      media: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(reports);
}
```

- [ ] **Step 2: Test as PARENT**

GET `/api/reports` as parent user.
Expected: only reports for that parent's children.

- [ ] **Step 3: Test as PARENT with studentId filter**

GET `/api/reports?studentId=<child-id>` as parent.
Expected: reports only for that specific child. If studentId belongs to another parent's child, returns empty array.

- [ ] **Step 4: Commit**

```bash
git add app/api/reports/route.ts
git commit -m "feat(api): add reports list endpoint with role-based filtering"
```

---

### Task 7: Tutor Dashboard & Schedule List

**Files:**
- Create: `app/(dashboard)/tutor/page.tsx`
- Create: `app/(dashboard)/tutor/schedule/page.tsx`
- Create: `components/dashboard/TutorScheduleList.tsx`

- [ ] **Step 1: Create tutor main page `app/(dashboard)/tutor/page.tsx`**

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function TutorDashboard() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "TUTOR") redirect("/login");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todaySchedules = await prisma.schedule.count({
    where: {
      class: { tutorId: session.user.id },
      date: { gte: today, lt: tomorrow },
      status: { in: ["PUBLISHED", "COMPLETED"] },
    },
  });

  const pendingReports = await prisma.schedule.count({
    where: {
      class: { tutorId: session.user.id },
      status: "COMPLETED",
      reports: { none: {} },
    },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Tutor</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Jadwal Hari Ini</p>
          <p className="text-3xl font-bold">{todaySchedules}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Laporan Belum Diisi</p>
          <p className="text-3xl font-bold text-orange-500">{pendingReports}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/(dashboard)/tutor/schedule/page.tsx`**

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TutorScheduleList } from "@/components/dashboard/TutorScheduleList";

export default async function TutorSchedulePage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "TUTOR") redirect("/login");

  const schedules = await prisma.schedule.findMany({
    where: {
      class: { tutorId: session.user.id },
      status: { in: ["PUBLISHED", "COMPLETED"] },
    },
    include: {
      class: { select: { name: true, subject: true } },
      participants: {
        include: {
          student: { select: { id: true, name: true, grade: true } },
        },
      },
      reports: {
        select: { studentId: true, score: true, createdAt: true },
      },
    },
    orderBy: { date: "asc" },
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Jadwal Mengajar</h1>
      <TutorScheduleList schedules={schedules} />
    </div>
  );
}
```

- [ ] **Step 3: Create `components/dashboard/TutorScheduleList.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id } from "date-fns/locale";

type Student = { id: string; name: string; grade: string | null };
type Participant = { student: Student };
type Report = { studentId: string; score: number | null; createdAt: string };
type Schedule = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  topic: string | null;
  location: string | null;
  status: string;
  class: { name: string; subject: string };
  participants: Participant[];
  reports: Report[];
};

export function TutorScheduleList({ schedules }: { schedules: Schedule[] }) {
  const router = useRouter();
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [reportData, setReportData] = useState<Record<string, { content: string; score: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [locationEdit, setLocationEdit] = useState<{ id: string; value: string } | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = schedules.filter((s) => new Date(s.date) >= today);
  const past = schedules.filter((s) => new Date(s.date) < today);

  async function handleSubmitReports() {
    if (!selectedSchedule) return;
    setSubmitting(true);
    try {
      for (const participant of selectedSchedule.participants) {
        const data = reportData[participant.student.id];
        if (!data?.content) continue;
        await fetch(`/api/schedules/${selectedSchedule.id}/reports`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: participant.student.id,
            content: data.content,
            score: data.score ? Number(data.score) : undefined,
          }),
        });
      }
      setSelectedSchedule(null);
      setReportData({});
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveLocation(scheduleId: string, location: string) {
    await fetch(`/api/schedules/${scheduleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location }),
    });
    setLocationEdit(null);
    router.refresh();
  }

  function ScheduleCard({ schedule }: { schedule: Schedule }) {
    const reportedIds = new Set(schedule.reports.map((r) => r.studentId));
    const allReported =
      schedule.participants.length > 0 &&
      schedule.participants.every((p) => reportedIds.has(p.student.id));
    const isPast = new Date(schedule.date) < today;

    return (
      <div className="border rounded-lg p-4 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-semibold">{schedule.class.name}</p>
            <p className="text-sm text-muted-foreground">{schedule.class.subject}</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${schedule.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
            {schedule.status === "COMPLETED" ? "Selesai" : "Terjadwal"}
          </span>
        </div>

        <p className="text-sm">
          {format(new Date(schedule.date), "EEEE, d MMMM yyyy", { locale: id })}
          {" · "}
          {schedule.startTime}–{schedule.endTime}
        </p>

        {locationEdit?.id === schedule.id ? (
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded px-2 py-1 text-sm"
              value={locationEdit.value}
              onChange={(e) => setLocationEdit({ id: schedule.id, value: e.target.value })}
            />
            <button
              className="text-xs bg-primary text-white px-2 py-1 rounded"
              onClick={() => handleSaveLocation(schedule.id, locationEdit.value)}
            >
              Simpan
            </button>
            <button className="text-xs px-2 py-1" onClick={() => setLocationEdit(null)}>Batal</button>
          </div>
        ) : (
          <p
            className="text-sm text-muted-foreground cursor-pointer hover:text-primary"
            onClick={() => setLocationEdit({ id: schedule.id, value: schedule.location ?? "" })}
          >
            📍 {schedule.location || "Tambah lokasi…"}
          </p>
        )}

        {schedule.topic && <p className="text-sm">📚 {schedule.topic}</p>}

        <div className="text-xs text-muted-foreground">
          {schedule.participants.length} siswa ·{" "}
          {allReported ? (
            <span className="text-green-600 font-medium">Laporan lengkap ✓</span>
          ) : isPast ? (
            <span className="text-orange-500">{schedule.reports.length}/{schedule.participants.length} laporan diisi</span>
          ) : null}
        </div>

        {isPast && !allReported && (
          <button
            className="w-full mt-2 bg-orange-500 hover:bg-orange-600 text-white text-sm py-2 rounded"
            onClick={() => {
              setSelectedSchedule(schedule);
              const initial: Record<string, { content: string; score: string }> = {};
              schedule.participants.forEach((p) => {
                initial[p.student.id] = { content: "", score: "" };
              });
              setReportData(initial);
            }}
          >
            Isi Laporan
          </button>
        )}
        {isPast && allReported && (
          <button
            className="w-full mt-2 border text-sm py-2 rounded"
            onClick={() => {
              setSelectedSchedule(schedule);
              const initial: Record<string, { content: string; score: string }> = {};
              schedule.participants.forEach((p) => {
                initial[p.student.id] = { content: "", score: "" };
              });
              setReportData(initial);
            }}
          >
            Edit Laporan
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Akan Datang</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map((s) => <ScheduleCard key={s.id} schedule={s} />)}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Riwayat</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {past.map((s) => <ScheduleCard key={s.id} schedule={s} />)}
          </div>
        </section>
      )}

      {/* Report Modal */}
      {selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto space-y-4">
            <h3 className="text-lg font-bold">
              Laporan — {selectedSchedule.class.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {format(new Date(selectedSchedule.date), "d MMMM yyyy", { locale: id })}
            </p>

            {selectedSchedule.participants.map(({ student }) => (
              <div key={student.id} className="border rounded p-3 space-y-2">
                <p className="font-medium text-sm">{student.name} {student.grade && `(${student.grade})`}</p>
                <textarea
                  className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
                  placeholder="Materi yang dipelajari, catatan perkembangan siswa..."
                  value={reportData[student.id]?.content ?? ""}
                  onChange={(e) =>
                    setReportData((prev) => ({
                      ...prev,
                      [student.id]: { ...prev[student.id], content: e.target.value },
                    }))
                  }
                />
                <div>
                  <label className="text-xs text-muted-foreground">Nilai (opsional, 0–100)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-full border rounded px-3 py-1 text-sm mt-1"
                    placeholder="cth. 85"
                    value={reportData[student.id]?.score ?? ""}
                    onChange={(e) =>
                      setReportData((prev) => ({
                        ...prev,
                        [student.id]: { ...prev[student.id], score: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <button
                className="flex-1 bg-primary text-white py-2 rounded disabled:opacity-50"
                disabled={submitting}
                onClick={handleSubmitReports}
              >
                {submitting ? "Menyimpan..." : "Simpan Laporan"}
              </button>
              <button
                className="px-4 border rounded"
                onClick={() => setSelectedSchedule(null)}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add tutor schedule link to sidebar**

Find the sidebar nav component (grep for existing TUTOR nav items).
Add link: `{ href: "/tutor/schedule", label: "Jadwal Mengajar" }` to TUTOR navigation.

- [ ] **Step 5: Test in browser as TUTOR**

1. Login as tutor
2. Navigate to `/tutor/schedule`
3. Verify upcoming and past schedules appear
4. Click "📍 Tambah lokasi…" on an upcoming schedule, save
5. Verify location updates without page reload delay

- [ ] **Step 6: Commit**

```bash
git add app/\(dashboard\)/tutor/ components/dashboard/TutorScheduleList.tsx
git commit -m "feat(ui): add tutor schedule page with report fill-in and location edit"
```

---

### Task 8: Parent UI — View Teaching History

**Files:**
- Modify: `app/(dashboard)/parent/schedule/page.tsx`
- Modify: `components/dashboard/ParentScheduleList.tsx`

- [ ] **Step 1: Update parent schedule page query to include reports**

In `app/(dashboard)/parent/schedule/page.tsx`, add `reports` to the `include` block:

```typescript
include: {
  class: { include: { tutor: { select: { name: true } } } },
  participants: { include: { student: true } },
  attendances: {
    where: { studentId: { in: childIds } },
  },
  reports: {
    where: { studentId: { in: childIds } },
    select: {
      id: true,
      studentId: true,
      content: true,
      score: true,
      createdAt: true,
      tutor: { select: { name: true } },
    },
  },
},
```

Where `childIds` is the array of the parent's children IDs (already computed in the query).

- [ ] **Step 2: Pass reports data to ParentScheduleList**

In the page, pass `schedules` (which now includes `reports`) to `<ParentScheduleList schedules={schedules} />` — no signature change needed if the component accepts `any[]` or the type already includes reports.

Update the type definition at the top of `ParentScheduleList.tsx` to add:
```typescript
type Report = {
  id: string;
  studentId: string;
  content: string;
  score: number | null;
  createdAt: string;
  tutor: { name: string };
};

// Add to Schedule type:
reports: Report[];
```

- [ ] **Step 3: Add "Lihat Laporan" button/section to past schedule cards**

In `components/dashboard/ParentScheduleList.tsx`, for past schedules that have at least one report, add an expandable section:

```tsx
const [showReport, setShowReport] = useState<string | null>(null);

// Inside each schedule card for past schedules:
{schedule.reports.length > 0 && (
  <div className="mt-3 border-t pt-3">
    <button
      className="text-sm text-primary hover:underline"
      onClick={() => setShowReport(showReport === schedule.id ? null : schedule.id)}
    >
      {showReport === schedule.id ? "Sembunyikan" : "Lihat Laporan Belajar"}
    </button>

    {showReport === schedule.id && (
      <div className="mt-2 space-y-3">
        {schedule.reports.map((report) => {
          const student = schedule.participants.find(
            (p) => p.student.id === report.studentId
          )?.student;
          return (
            <div key={report.id} className="bg-muted/40 rounded p-3 text-sm">
              <p className="font-medium">{student?.name}</p>
              <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{report.content}</p>
              {report.score !== null && (
                <p className="mt-1 font-medium">Nilai: {report.score}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Tutor: {report.tutor.name} ·{" "}
                {format(new Date(report.createdAt), "d MMM yyyy", { locale: id })}
              </p>
            </div>
          );
        })}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Test as PARENT**

1. Login as parent
2. Navigate to `/parent/schedule`
3. Scroll to past schedules
4. If tutor has submitted a report, "Lihat Laporan Belajar" button appears
5. Click → content, score, tutor name shown
6. Click again → collapses

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/parent/schedule/page.tsx components/dashboard/ParentScheduleList.tsx
git commit -m "feat(ui): show teaching log reports on parent schedule history"
```

---

## Self-Review Checklist

- [x] **Recurring schedules:** Schema migration + API + Admin UI (Tasks 1–4)
- [x] **Flexible location:** Tutor permission to update location (Task 3) 
- [x] **Teaching log create:** API endpoint POST /schedules/[id]/reports (Task 5)
- [x] **Teaching log list:** API endpoint GET /reports (Task 6)
- [x] **Tutor UI:** Dashboard + schedule list + report fill-in modal (Task 7)
- [x] **Parent UI:** Reports visible in schedule history (Task 8)
- [x] **No placeholder code:** All steps contain actual implementation
- [x] **Type consistency:** `LearningReport` model used throughout; `upsert` used (studentId_scheduleId unique constraint exists in schema)
- [x] **YAGNI:** No media upload in this plan (existing Media model supports it later)

---

## Execution Options

Plan saved. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks

**2. Inline Execution** — execute tasks in this session using executing-plans

Which approach?
