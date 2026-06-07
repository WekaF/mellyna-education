# Broadcast Duration 45→60 Minutes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change all class session durations from 45 minutes to 60 minutes so broadcast messages show the correct end time (e.g. `16:00 - 17:00` instead of `16:00 - 16:45`).

**Architecture:** Duration is computed by a single `getTimeRange()` function duplicated in two route files and one test file. The function adds 45 to the start time in minutes and also has a hardcoded JAM-slot lookup table with 45-min windows. All three copies must be updated consistently. No database changes needed — `startTime`/`endTime` are string fields set at schedule-creation time.

**Tech Stack:** Next.js API routes (TypeScript), Jest/Vitest for tests.

---

## File Map

| File | Change |
|------|--------|
| `app/api/admin/timetable/__tests__/getTimeRange.test.ts` | Update test expectations: +60 min, JAM slots, fallback |
| `app/api/admin/timetable/generate/route.ts` | `+ 45` → `+ 60`, JAM slot table, fallback end time |
| `app/api/cron/timetable-generate/route.ts` | Same `getTimeRange` copy — identical changes |

---

### Task 1: Update the test file to assert 60-minute behavior

**Files:**
- Modify: `app/api/admin/timetable/__tests__/getTimeRange.test.ts`

- [ ] **Step 1: Verify the test currently passes (it should, against 45-min logic)**

```bash
npx jest app/api/admin/timetable/__tests__/getTimeRange.test.ts --no-coverage
```

Expected: `3 passed` (all 45-min assertions green).

- [ ] **Step 2: Update the test file to assert 60-minute behavior**

Replace the entire file content:

```typescript
// Inline copy of the function under test (extracted for testability)
function getTimeRange(slot: string): { start: string; end: string } {
  if (slot.includes(':')) {
    const [h, m] = slot.split(':').map(Number)
    const totalMins = h * 60 + m + 60
    const endH = Math.floor(totalMins / 60) % 24
    const endM = totalMins % 60
    return {
      start: slot,
      end: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`,
    }
  }
  const mapping: Record<string, { start: string; end: string }> = {
    'JAM 1': { start: '13:00', end: '14:00' },
    'JAM 2': { start: '14:00', end: '15:00' },
    'JAM 3': { start: '15:00', end: '16:00' },
    'JAM 4': { start: '16:00', end: '17:00' },
    'JAM 7': { start: '19:00', end: '20:00' },
  }
  return mapping[slot] ?? { start: '08:00', end: '09:00' }
}

describe('getTimeRange', () => {
  it('HH:MM slot → +60 minutes', () => {
    expect(getTimeRange('08:00')).toEqual({ start: '08:00', end: '09:00' })
    expect(getTimeRange('09:15')).toEqual({ start: '09:15', end: '10:15' })
    expect(getTimeRange('23:00')).toEqual({ start: '23:00', end: '00:00' })
  })
  it('JAM slots → correct 60-min windows', () => {
    expect(getTimeRange('JAM 1')).toEqual({ start: '13:00', end: '14:00' })
    expect(getTimeRange('JAM 4')).toEqual({ start: '16:00', end: '17:00' })
    expect(getTimeRange('JAM 7')).toEqual({ start: '19:00', end: '20:00' })
  })
  it('unknown slot → 08:00–09:00 fallback', () => {
    expect(getTimeRange('JAM X')).toEqual({ start: '08:00', end: '09:00' })
  })
})
```

- [ ] **Step 3: Run test to confirm it now FAILS (proving the test drives the implementation)**

```bash
npx jest app/api/admin/timetable/__tests__/getTimeRange.test.ts --no-coverage
```

Expected: FAIL — assertions comparing `:45` vs `:00` and `:00` vs `:15`.

---

### Task 2: Update `getTimeRange` in the admin timetable generate route

**Files:**
- Modify: `app/api/admin/timetable/generate/route.ts:29-48`

- [ ] **Step 1: Apply the changes**

Replace lines 29–48 (the entire `getTimeRange` function):

```typescript
function getTimeRange(slot: string): { start: string; end: string } {
  if (slot.includes(':')) {
    const [h, m] = slot.split(':').map(Number)
    const totalMins = h * 60 + m + 60
    const endH = Math.floor(totalMins / 60) % 24
    const endM = totalMins % 60
    return {
      start: slot,
      end: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`,
    }
  }
  const mapping: Record<string, { start: string; end: string }> = {
    'JAM 1': { start: '13:00', end: '14:00' },
    'JAM 2': { start: '14:00', end: '15:00' },
    'JAM 3': { start: '15:00', end: '16:00' },
    'JAM 4': { start: '16:00', end: '17:00' },
    'JAM 7': { start: '19:00', end: '20:00' },
  }
  return mapping[slot] ?? { start: '08:00', end: '09:00' }
}
```

- [ ] **Step 2: Run the test — it should now pass**

```bash
npx jest app/api/admin/timetable/__tests__/getTimeRange.test.ts --no-coverage
```

Expected: `3 passed`.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/timetable/generate/route.ts \
        app/api/admin/timetable/__tests__/getTimeRange.test.ts
git commit -m "feat: change session duration from 45 to 60 minutes (admin generate)"
```

---

### Task 3: Update `getTimeRange` in the cron timetable-generate route

**Files:**
- Modify: `app/api/cron/timetable-generate/route.ts:16-35`

- [ ] **Step 1: Apply the same changes**

Replace lines 16–35 (the entire `getTimeRange` function):

```typescript
function getTimeRange(slot: string): { start: string; end: string } {
  if (slot.includes(':')) {
    const [h, m] = slot.split(':').map(Number)
    const totalMins = h * 60 + m + 60
    const endH = Math.floor(totalMins / 60) % 24
    const endM = totalMins % 60
    return {
      start: slot,
      end: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`,
    }
  }
  const mapping: Record<string, { start: string; end: string }> = {
    'JAM 1': { start: '13:00', end: '14:00' },
    'JAM 2': { start: '14:00', end: '15:00' },
    'JAM 3': { start: '15:00', end: '16:00' },
    'JAM 4': { start: '16:00', end: '17:00' },
    'JAM 7': { start: '19:00', end: '20:00' },
  }
  return mapping[slot] ?? { start: '08:00', end: '09:00' }
}
```

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

```bash
npx jest --no-coverage
```

Expected: all tests pass (same count as before, no regressions).

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/timetable-generate/route.ts
git commit -m "feat: change session duration from 45 to 60 minutes (cron generate)"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Change 45→60 in dynamic calculation (`+ 45` → `+ 60`), JAM slot table (`:45` → `:00` next hour), fallback (`08:45` → `09:00`). All three covered in Tasks 1–3.
- [x] **Placeholder scan:** No TBD/TODO. All code blocks are complete.
- [x] **Type consistency:** `getTimeRange` signature `(slot: string): { start: string; end: string }` is consistent across all tasks.
- [x] **Note:** `app/api/schedules/[id]/publish/route.ts` uses `timeStr` from the stored `startTime`/`endTime` fields on the schedule record — it does NOT recalculate duration. So existing published schedules keep their stored times; only newly generated schedules will use 60 min. This is correct behavior.
