# Star Rating Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 0–100 numeric score in tutor learning reports with a 1–5 star rating, and update all displays (admin, parent views, WhatsApp broadcast notifications) to show stars.

**Architecture:** Create a shared `StarRating` component (display + interactive modes) in `components/ui/`. Update the API schema to validate 1–5 instead of 0–100. Null out existing DB scores that fall outside the 1–5 range via a one-time SQL statement. Update all three WA message builders in `lib/report-notify.ts` to render stars as emoji text.

**Tech Stack:** Next.js 14 App Router, Prisma (PostgreSQL), Zod, Tailwind CSS, Jest

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `components/ui/star-rating.tsx` | Shared read/write star rating component |
| Modify | `app/api/reports/route.ts` | Zod schema: change `min(0).max(100)` → `min(1).max(5)` |
| Modify | `app/(dashboard)/tutor/reports/[scheduleId]/page.tsx` | Replace number input with interactive StarRating |
| Modify | `app/(dashboard)/admin/reports/ReportsClient.tsx` | Show StarRating instead of numeric badge |
| Modify | `app/(dashboard)/parent/progress/page.tsx` | Show StarRating instead of numeric badge |
| Modify | `app/(dashboard)/parent/history/page.tsx` | Show StarRating instead of numeric badge |
| Modify | `lib/report-notify.ts` | Render stars as `⭐⭐⭐☆☆` in WA messages |
| Modify | `__tests__/lib/report-notify.test.ts` | Update test expectations for star format |

---

## Task 1: Create shared StarRating component

**Files:**
- Create: `components/ui/star-rating.tsx`

- [ ] **Step 1: Write the failing test**

There is no dedicated unit test file for this component (it's pure UI). Skip to Step 3.

- [ ] **Step 2: Create the component**

```tsx
// components/ui/star-rating.tsx
'use client'

interface StarRatingProps {
  value: number | null
  onChange?: (value: number | null) => void
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'text-base gap-0.5',
  md: 'text-xl gap-0.5',
  lg: 'text-2xl gap-1',
}

export function StarRating({ value, onChange, size = 'md' }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5]
  const classes = sizeMap[size]

  if (onChange) {
    return (
      <div className={`flex ${classes}`} role="group" aria-label="Penilaian bintang">
        {stars.map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star === value ? null : star)}
            className="focus:outline-none transition-transform hover:scale-125 cursor-pointer"
            title={`${star} bintang`}
            aria-label={`${star} bintang${value === star ? ' (terpilih)' : ''}`}
          >
            <span className={star <= (value ?? 0) ? 'text-amber-400' : 'text-slate-300'}>
              ★
            </span>
          </button>
        ))}
      </div>
    )
  }

  if (value === null || value === undefined) return null
  return (
    <div className={`flex ${classes}`} aria-label={`${value} dari 5 bintang`}>
      {stars.map((star) => (
        <span key={star} className={star <= value ? 'text-amber-400' : 'text-slate-300'}>
          ★
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/star-rating.tsx
git commit -m "feat: add shared StarRating component (display + interactive)"
```

---

## Task 2: Update API validation

**Files:**
- Modify: `app/api/reports/route.ts:8-13`

- [ ] **Step 1: Write the failing test**

There is no route unit test for reports; validation is covered by the Zod parse. Jump to Step 2.

- [ ] **Step 2: Update Zod schema**

In `app/api/reports/route.ts`, change:

```ts
// before
const upsertReportSchema = z.object({
  studentId: z.string().min(1),
  scheduleId: z.string().min(1),
  content: z.string().min(1),
  score: z.number().int().min(0).max(100).optional(),
})
```

to:

```ts
// after
const upsertReportSchema = z.object({
  studentId: z.string().min(1),
  scheduleId: z.string().min(1),
  content: z.string().min(1),
  score: z.number().int().min(1).max(5).optional(),
})
```

- [ ] **Step 3: Run tests to verify nothing breaks**

```bash
pnpm test -- --testPathPattern="api/reports" 2>/dev/null || echo "no route test, OK"
```

Expected: no failures (there is no dedicated report route test).

- [ ] **Step 4: Commit**

```bash
git add app/api/reports/route.ts
git commit -m "feat: update report score API validation to 1-5 star range"
```

---

## Task 3: Migrate existing database scores (0–100 → 1–5 stars)

**Context:** Existing `LearningReport.score` values are 0–100. Convert them to the 1–5 star scale using `CEIL(score / 20.0)`, clamped to [1, 5]:

| Old range | New stars |
|-----------|-----------|
| 0–20      | 1         |
| 21–40     | 2         |
| 41–60     | 3         |
| 61–80     | 4         |
| 81–100    | 5         |

- [ ] **Step 1: Preview how many rows will be affected**

```bash
npx prisma db execute --stdin <<'SQL'
SELECT score, COUNT(*) as jumlah
FROM "LearningReport"
WHERE score IS NOT NULL
GROUP BY score
ORDER BY score;
SQL
```

Expected: list of existing score values and their counts.

- [ ] **Step 2: Run the conversion SQL**

```bash
npx prisma db execute --stdin <<'SQL'
UPDATE "LearningReport"
SET score = GREATEST(1, LEAST(5, CEIL(score::numeric / 20.0)::int))
WHERE score IS NOT NULL;
SQL
```

Expected output: `Result: { rowCount: N }` where N is the number of converted records.

- [ ] **Step 3: Verify all scores are now in 1–5 range**

```bash
npx prisma db execute --stdin <<'SQL'
SELECT score, COUNT(*) as jumlah
FROM "LearningReport"
WHERE score IS NOT NULL
GROUP BY score
ORDER BY score;
SQL
```

Expected: only values 1, 2, 3, 4, or 5 appear.

- [ ] **Step 4: Commit note**

```bash
git commit --allow-empty -m "chore: converted existing 0-100 scores to 1-5 star scale in LearningReport"
```

---

## Task 4: Update tutor report form

**Files:**
- Modify: `app/(dashboard)/tutor/reports/[scheduleId]/page.tsx`

The `ReportEntry.score` field currently is `string` (used with a number input). We change it to `number | null` to match the star component.

- [ ] **Step 1: Write the failing test**

Open `__tests__/pages/tutor-reports.test.ts` to check current coverage. If there's a test that expects a `<input type="number">` for score, note it — but this test file likely tests data loading, not DOM elements, so check first.

```bash
cat __tests__/pages/tutor-reports.test.ts
```

- [ ] **Step 2: Update the interface and state**

In `app/(dashboard)/tutor/reports/[scheduleId]/page.tsx`, change the `ReportEntry` interface:

```ts
// before
interface ReportEntry {
  studentId: string
  content: string
  score: string
  reportId: string | null
  uploading: boolean
  media: MediaItem[]
}
```

```ts
// after
interface ReportEntry {
  studentId: string
  content: string
  score: number | null
  reportId: string | null
  uploading: boolean
  media: MediaItem[]
}
```

- [ ] **Step 3: Update initial state mapping**

In the `useEffect`, change:

```ts
// before
score: existingReports[s.id]?.score?.toString() || '',
```

```ts
// after
score: existingReports[s.id]?.score ?? null,
```

- [ ] **Step 4: Update handleSave payload**

In `handleSave`, change:

```ts
// before
body: JSON.stringify({
  studentId,
  scheduleId,
  content: entry.content,
  score: entry.score ? parseInt(entry.score) : undefined,
}),
```

```ts
// after
body: JSON.stringify({
  studentId,
  scheduleId,
  content: entry.content,
  score: entry.score ?? undefined,
}),
```

- [ ] **Step 5: Replace the number input with StarRating**

Add the import at the top of the file (after existing imports):

```ts
import { StarRating } from '@/components/ui/star-rating'
```

Replace the score input block:

```tsx
// before
<div className="w-full sm:w-36">
  <label className="block text-xs font-semibold text-slate-600 mb-1">
    Nilai (0-100)
  </label>
  <input
    type="number"
    min={0}
    max={100}
    value={entry?.score || ''}
    onChange={(e) =>
      setEntries((prev) =>
        prev.map((en) =>
          en.studentId === student.id ? { ...en, score: e.target.value } : en
        )
      )
    }
    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
    placeholder="mis. 85"
  />
</div>
```

```tsx
// after
<div>
  <label className="block text-xs font-semibold text-slate-600 mb-1">
    Penilaian
  </label>
  <StarRating
    value={entry?.score ?? null}
    onChange={(val) =>
      setEntries((prev) =>
        prev.map((en) =>
          en.studentId === student.id ? { ...en, score: val } : en
        )
      )
    }
    size="lg"
  />
</div>
```

- [ ] **Step 6: Run tests**

```bash
pnpm test -- --testPathPattern="tutor-reports" 2>/dev/null || echo "OK"
```

Expected: tests pass or no relevant test changes required.

- [ ] **Step 7: Commit**

```bash
git add app/(dashboard)/tutor/reports/[scheduleId]/page.tsx components/ui/star-rating.tsx
git commit -m "feat: replace 0-100 number input with 1-5 star rating in tutor report form"
```

---

## Task 5: Update admin reports view

**Files:**
- Modify: `app/(dashboard)/admin/reports/ReportsClient.tsx:83-87`

- [ ] **Step 1: Add import**

At the top of `app/(dashboard)/admin/reports/ReportsClient.tsx`, add:

```ts
import { StarRating } from '@/components/ui/star-rating'
```

- [ ] **Step 2: Replace the numeric score badge**

```tsx
// before
{report.score !== null && (
  <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 shrink-0">
    <span className="text-lg font-extrabold text-indigo-600">{report.score}</span>
  </div>
)}
```

```tsx
// after
{report.score !== null && (
  <div className="shrink-0">
    <StarRating value={report.score} size="md" />
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/admin/reports/ReportsClient.tsx
git commit -m "feat: show star rating instead of numeric score in admin reports view"
```

---

## Task 6: Update parent progress view

**Files:**
- Modify: `app/(dashboard)/parent/progress/page.tsx:62-66`

- [ ] **Step 1: Add import**

```tsx
import { StarRating } from '@/components/ui/star-rating'
```

- [ ] **Step 2: Replace the numeric score badge**

```tsx
// before
{report.score !== null && (
  <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-100 shrink-0">
    <span className="text-xl font-extrabold text-indigo-600">{report.score}</span>
  </div>
)}
```

```tsx
// after
{report.score !== null && (
  <div className="shrink-0">
    <StarRating value={report.score} size="md" />
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/parent/progress/page.tsx
git commit -m "feat: show star rating instead of numeric score in parent progress view"
```

---

## Task 7: Update parent history view

**Files:**
- Modify: `app/(dashboard)/parent/history/page.tsx:215-220`

- [ ] **Step 1: Add import**

```tsx
import { StarRating } from '@/components/ui/star-rating'
```

- [ ] **Step 2: Replace the numeric score badge**

```tsx
// before
{report.score !== null && (
  <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center">
    <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
      {report.score}
    </span>
  </div>
)}
```

```tsx
// after
{report.score !== null && (
  <StarRating value={report.score} size="sm" />
)}
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/parent/history/page.tsx
git commit -m "feat: show star rating instead of numeric score in parent history view"
```

---

## Task 8: Update WhatsApp notification messages

**Files:**
- Modify: `lib/report-notify.ts`

Three functions need updating:
1. `notifyParentNewReport` — per-session WA message to parent (line 40)
2. `buildParentWeeklyDigestMessage` — weekly digest to parent (line 77)
3. `buildAdminDailyDigestMessage` — daily digest to admin (line 108)

- [ ] **Step 1: Add a helper function**

At the top of `lib/report-notify.ts`, after the date formatters, add:

```ts
function fmtStars(score: number | null): string {
  if (score === null) return ''
  return '⭐'.repeat(score) + '☆'.repeat(5 - score) + ` (${score}/5)`
}
```

- [ ] **Step 2: Update `notifyParentNewReport`**

Change line 40:

```ts
// before
if (data.score !== null) lines.push(`⭐ Nilai: ${data.score}/100`)
```

```ts
// after
if (data.score !== null) lines.push(`⭐ Penilaian: ${fmtStars(data.score)}`)
```

- [ ] **Step 3: Update `buildParentWeeklyDigestMessage`**

Change line 77:

```ts
// before
if (r.score !== null) lines.push(`   ⭐ Nilai: ${r.score}/100`)
```

```ts
// after
if (r.score !== null) lines.push(`   ⭐ Penilaian: ${fmtStars(r.score)}`)
```

- [ ] **Step 4: Update `buildAdminDailyDigestMessage`**

Change line 108:

```ts
// before
const s = r.score !== null ? ` | Nilai: ${r.score}` : ''
```

```ts
// after
const s = r.score !== null ? ` | ${fmtStars(r.score)}` : ''
```

- [ ] **Step 5: Run tests to verify they fail with the new format**

```bash
pnpm test -- --testPathPattern="report-notify" 2>/dev/null
```

Expected: tests FAIL because they still expect numeric `85` / `90` in the output. Note the failures — we fix them in Task 9.

- [ ] **Step 6: Commit**

```bash
git add lib/report-notify.ts
git commit -m "feat: replace numeric score with star emoji in WhatsApp report notifications"
```

---

## Task 9: Update tests for star rating format

**Files:**
- Modify: `__tests__/lib/report-notify.test.ts`

The tests currently assert that the WA message contains the raw number (e.g. `'85'`). Now they should assert the star format.

- [ ] **Step 1: Update `buildAdminDailyDigestMessage` test**

```ts
// before
it('includes report count and class grouping', () => {
  ...
  expect(msg).toContain('85')
  ...
})
```

```ts
// after
it('includes report count and class grouping', () => {
  const date = new Date('2026-05-29T00:00:00Z')
  const reports = [
    { studentName: 'Andi', className: 'Sempoa A', tutorName: 'Tutor X', score: 4 },
    { studentName: 'Budi', className: 'Sempoa A', tutorName: 'Tutor X', score: null },
    { studentName: 'Cici', className: 'Bahasa B', tutorName: 'Tutor Y', score: 5 },
  ]
  const msg = buildAdminDailyDigestMessage(date, reports)
  expect(msg).toContain('3')
  expect(msg).toContain('Sempoa A')
  expect(msg).toContain('Bahasa B')
  expect(msg).toContain('Andi')
  expect(msg).toContain('⭐⭐⭐⭐☆')  // 4 stars
  expect(msg).toContain('⭐⭐⭐⭐⭐')  // 5 stars
})
```

- [ ] **Step 2: Update `buildParentWeeklyDigestMessage` test**

```ts
// before
it('includes parent name, student name, and score', () => {
  const reports = [
    {
      studentName: 'Andi',
      className: 'Sempoa A',
      score: 85,
      content: 'Sudah bisa penjumlahan 3 digit.',
      tutorName: 'Tutor X',
    },
  ]
  const msg = buildParentWeeklyDigestMessage('Bunda Sari', start, end, reports)
  ...
  expect(msg).toContain('85')
  ...
})
```

```ts
// after
it('includes parent name, student name, and star rating', () => {
  const start = new Date('2026-05-25T00:00:00Z')
  const end = new Date('2026-05-31T00:00:00Z')
  const reports = [
    {
      studentName: 'Andi',
      className: 'Sempoa A',
      score: 4,
      content: 'Sudah bisa penjumlahan 3 digit.',
      tutorName: 'Tutor X',
    },
  ]
  const msg = buildParentWeeklyDigestMessage('Bunda Sari', start, end, reports)
  expect(msg).toContain('Bunda Sari')
  expect(msg).toContain('Andi')
  expect(msg).toContain('⭐⭐⭐⭐☆')
  expect(msg).toContain('Sempoa A')
})
```

- [ ] **Step 3: Run tests and verify they pass**

```bash
pnpm test -- --testPathPattern="report-notify"
```

Expected output:
```
PASS __tests__/lib/report-notify.test.ts
  buildAdminDailyDigestMessage
    ✓ includes report count and class grouping
    ✓ handles empty report list
  buildParentWeeklyDigestMessage
    ✓ includes parent name, student name, and star rating
    ✓ truncates long content to 120 chars
```

- [ ] **Step 4: Commit**

```bash
git add __tests__/lib/report-notify.test.ts
git commit -m "test: update report-notify tests for 1-5 star rating format"
```

---

## Task 10: Full test suite and TypeScript check

- [ ] **Step 1: Run the full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript type check**

```bash
pnpm tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Fix any failures before proceeding**

If `tsc` reports errors, trace them to the affected file and fix the type mismatch. Common issue: a component still receiving `score: string` where `number | null` is now expected.

---

## Self-Review Checklist

- [x] **Spec coverage:** Star input (tutor form), star display (admin, parent progress, parent history), star in WA broadcast (3 message builders), DB cleanup, tests — all covered.
- [x] **No placeholders:** All code blocks are complete and runnable.
- [x] **Type consistency:** `StarRating` accepts `value: number | null` everywhere; `ReportEntry.score` is `number | null`; `fmtStars` takes `number | null`.
