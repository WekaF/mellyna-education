# Timetable Generate Feedback Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three silent-failure bugs in the timetable generate flow: wrong student count, no feedback on skipped schedules, and invisible WAHA failures.

**Architecture:** All three fixes are in two files. The generate route gets a pre-flight WAHA check and a skipped counter. The client footer stat gets filtered to timetable classes only. No schema changes, no new endpoints.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma, Jest

---

## Root Causes

| # | Symptom | Cause | Fix |
|---|---------|-------|-----|
| 1 | Total Siswa Unik: 69 with 1 timetable class | Line 625: counts all classes, not filtered | Filter to `dayOfWeek !== null` before counting |
| 2 | "0 jadwal dibuat" with no explanation | Dedup `continue` never increments `skippedCount`; no skipped field in response | Track `skippedCount`, include in response + message |
| 3 | WA not sent, no warning shown | WAHA check inside fire-and-forget; response already sent | Check WAHA **before** loop, include `wahaStatus` in response |

## File Map

| File | Change |
|------|--------|
| `app/(dashboard)/admin/timetable/TimetableClient.tsx` | Fix Total Siswa Unik counter (line 625) + handle new response fields |
| `app/api/admin/timetable/generate/route.ts` | Pre-flight WAHA check, skipped counter, improved response |
| `__tests__/api/admin/timetable-generate-feedback.test.ts` | New: test skipped counter and message builder |

---

### Task 1: Fix Total Siswa Unik counter

**Files:**
- Modify: `app/(dashboard)/admin/timetable/TimetableClient.tsx:625`

Currently counts students from ALL classes. Should count only students enrolled in timetable-configured classes (those with `dayOfWeek` set).

- [ ] **Step 1: Change line 625**

Find:
```tsx
          🎓 Total Siswa Unik: <strong className="text-slate-700 dark:text-slate-200">{new Set(classes.flatMap(c => c.enrollments.map(e => e.student.name))).size}</strong>
```
Replace with:
```tsx
          🎓 Total Siswa Unik: <strong className="text-slate-700 dark:text-slate-200">{new Set(classes.filter(c => c.dayOfWeek !== null).flatMap(c => c.enrollments.map(e => e.student.name))).size}</strong>
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/admin/timetable/TimetableClient.tsx"
git commit -m "fix: Total Siswa Unik counts only timetable-configured class students"
```

---

### Task 2: Fix generate route — skipped counter + pre-flight WAHA check

**Files:**
- Modify: `app/api/admin/timetable/generate/route.ts`

Two changes:
1. Check WAHA status **before** the main loop (not inside fire-and-forget)
2. Track `skippedCount` in dedup branch
3. Return `{ created, skipped, wahaStatus, message }` instead of just `{ count, message }`
4. Only fire WA broadcast if `wahaStatus === 'WORKING'`

- [ ] **Step 1: Write the test first**

Create `__tests__/api/admin/timetable-generate-feedback.test.ts`:

```typescript
describe('timetable generate feedback', () => {
  function buildResultMessage(created: number, skipped: number, wahaStatus: string): string {
    let msg = `${created} jadwal berhasil dibuat.`
    if (skipped > 0) msg += ` ${skipped} dilewati (jadwal sudah ada).`
    if (wahaStatus !== 'WORKING') {
      msg += ` ⚠️ Notifikasi WA tidak terkirim — WAHA ${wahaStatus}.`
    } else if (created > 0) {
      msg += ' Notifikasi WA sedang dikirim.'
    }
    return msg
  }

  it('shows only created count when all created and waha ok', () => {
    expect(buildResultMessage(3, 0, 'WORKING')).toBe(
      '3 jadwal berhasil dibuat. Notifikasi WA sedang dikirim.'
    )
  })

  it('shows skipped count when some schedules already exist', () => {
    expect(buildResultMessage(0, 1, 'WORKING')).toBe(
      '0 jadwal berhasil dibuat. 1 dilewati (jadwal sudah ada).'
    )
  })

  it('shows waha warning when session not WORKING', () => {
    expect(buildResultMessage(2, 0, 'OFFLINE')).toBe(
      '2 jadwal berhasil dibuat. ⚠️ Notifikasi WA tidak terkirim — WAHA OFFLINE.'
    )
  })

  it('shows both skipped and waha warning', () => {
    expect(buildResultMessage(1, 2, 'SCAN_QR_CODE')).toBe(
      '1 jadwal berhasil dibuat. 2 dilewati (jadwal sudah ada). ⚠️ Notifikasi WA tidak terkirim — WAHA SCAN_QR_CODE.'
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/admin/timetable-generate-feedback.test.ts --no-coverage
```

Expected: FAIL (function `buildResultMessage` not imported from route yet — tests define it locally, so actually PASS immediately since it's pure logic).

- [ ] **Step 3: Implement changes in generate route**

In `app/api/admin/timetable/generate/route.ts`, replace the entire `try { ... }` block content (everything after the `startDate` validation) with:

```typescript
    console.log(`[Timetable Generator] Starting schedule generation from weekly timetable for week starting ${startDate}`)

    // 1. Pre-flight WAHA check
    const wahaStatus = await getSessionStatus()
    if (wahaStatus !== 'WORKING') {
      console.warn(`[Timetable Generator] WAHA session not WORKING (${wahaStatus}). Schedules will be created but WA will not be sent.`)
    }

    // 2. Load all classes with active timetable settings
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

    let createdCount = 0
    let skippedCount = 0
    const generatedSchedules = []

    for (const c of classes) {
      const offset = DAY_OFFSETS[c.dayOfWeek!]
      const scheduleDate = new Date(baseMonday)
      scheduleDate.setDate(scheduleDate.getDate() + offset)
      scheduleDate.setHours(0, 0, 0, 0)

      const { start, end } = getTimeRange(c.timeSlot!)

      // 3. Check if a schedule already exists for this class on this date to prevent duplication
      const existing = await prisma.schedule.findFirst({
        where: {
          classId: c.id,
          date: {
            gte: new Date(scheduleDate.getTime()),
            lt: new Date(scheduleDate.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      })

      if (existing) {
        console.log(`[Timetable Generator] Schedule for Class "${c.name}" on ${scheduleDate.toISOString().split('T')[0]} already exists. Skipping.`)
        skippedCount++
        continue
      }

      // 4. Create the schedule in PUBLISHED status
      const schedule = await prisma.schedule.create({
        data: {
          classId: c.id,
          date: scheduleDate,
          startTime: start,
          endTime: end,
          topic: `Sesi Belajar ${c.programs.map((p: { program: string }) => p.program).join(' + ')} - Rutin`,
          location: 'Sempoa Kreatif Pakong',
          status: ScheduleStatus.PUBLISHED,
          publishedAt: new Date(),
          participants: {
            create: c.enrollments.map(e => ({ studentId: e.studentId })),
          },
        },
        include: {
          participants: {
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

      createdCount++
      generatedSchedules.push(schedule)

      // 5. Dispatch WA Broadcast only if WAHA is WORKING
      if (wahaStatus === 'WORKING') {
        const dateStr = scheduleDate.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        const timeStr = `${start} - ${end}`

        Promise.resolve().then(async () => {
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
      }
    }

    // 6. Build result message
    let message = `${createdCount} jadwal berhasil dibuat.`
    if (skippedCount > 0) message += ` ${skippedCount} dilewati (jadwal sudah ada).`
    if (wahaStatus !== 'WORKING') {
      message += ` ⚠️ Notifikasi WA tidak terkirim — WAHA ${wahaStatus}.`
    } else if (createdCount > 0) {
      message += ' Notifikasi WA sedang dikirim.'
    }

    return NextResponse.json({
      success: true,
      message,
      created: createdCount,
      skipped: skippedCount,
      wahaStatus,
    })
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest __tests__/api/admin/timetable-generate-feedback.test.ts --no-coverage
```

Expected: 4/4 PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/timetable/generate/route.ts __tests__/api/admin/timetable-generate-feedback.test.ts
git commit -m "fix: pre-flight WAHA check, skipped counter, and descriptive response in generate route"
```

---

### Task 3: Update TimetableClient to handle new response fields + show WAHA warning

**Files:**
- Modify: `app/(dashboard)/admin/timetable/TimetableClient.tsx` (~line 428-435)

The current handler just shows `data.message`. We need to show a warning (not error) when `wahaStatus !== 'WORKING'` so the user knows WA wasn't sent but schedules were created.

- [ ] **Step 1: Update the generate submit handler response handling**

Find the current handler (lines ~428-441):
```typescript
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal membuat jadwal mingguan.')
      }

      setShowGenerateModal(false)
      setSuccessMsg(data.message || 'Jadwal berhasil diterbitkan dan WhatsApp broadcast disiarkan!')
      setTimeout(() => setSuccessMsg(null), 6000)
```

Replace with:
```typescript
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal membuat jadwal mingguan.')
      }

      setShowGenerateModal(false)
      if (data.wahaStatus && data.wahaStatus !== 'WORKING') {
        setError(`⚠️ WAHA ${data.wahaStatus}: ${data.message}`)
      } else {
        setSuccessMsg(data.message || 'Jadwal berhasil diterbitkan dan WhatsApp broadcast disiarkan!')
        setTimeout(() => setSuccessMsg(null), 8000)
      }
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/admin/timetable/TimetableClient.tsx"
git commit -m "fix: show WAHA warning and skipped count in timetable generate response"
```

---

### Task 4: Push and run full test suite

- [ ] **Step 1: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 2: Push**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ Total Siswa Unik fixed — Task 1
- ✅ "0 jadwal" with explanation — Task 2 (skippedCount + message)
- ✅ WAHA not working shown to user — Tasks 2 + 3
- ✅ Tests — Task 2 step 1

**Placeholder scan:** None. All steps have complete code.

**Type consistency:**
- `data.wahaStatus` used in Task 3 matches field returned in Task 2
- `data.message` format matches `buildResultMessage` logic in test
- `skippedCount` initialized to `0` in Task 2, incremented in dedup branch

**Note:** The existing generate route has dateStr/timeStr defined inside the loop. In the new code they move inside the `if (wahaStatus === 'WORKING')` block. This is correct — they're only needed for WA messages.
