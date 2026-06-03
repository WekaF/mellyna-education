# Fix Parents Page Stale Drawer After Program Select

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After adding a program on `/admin/parents`, the drawer and table both show updated program data without requiring a page reload.

**Architecture:** `fetchParents()` calls `setParents(data)` which updates the table (which reads from `parents` state), but never syncs `selectedStudent` or `selectedParent` — the open drawer keeps showing the stale student snapshot. Fix by adding functional-update setState calls for both after `setParents(data)` inside `fetchParents`. Use functional form (`setState((prev) => ...)`) to avoid stale closure since `fetchParents` is memoized with `useCallback([], [])`.

**Tech Stack:** React (useState, useCallback), Next.js App Router, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `app/(dashboard)/admin/parents/ParentsClient.tsx` | Add `setSelectedStudent` + `setSelectedParent` sync in `fetchParents` (lines ~164–177) |

---

### Task 1: Sync selectedStudent and selectedParent after fetchParents

**Files:**
- Modify: `app/(dashboard)/admin/parents/ParentsClient.tsx:164-177`

- [ ] **Step 1: Write the logic test**

Create `__tests__/pages/parents-client-sync.test.ts`:

```typescript
describe('fetchParents sync logic', () => {
  it('finds updated student from fresh parent list', () => {
    const freshParents = [
      {
        id: 'parent-1',
        children: [
          { id: 'student-1', name: 'Budi', programEnrollments: [{ id: 'pe-1', program: 'SEMPOA', status: 'ACTIVE', startedAt: '2026-01-01T00:00:00.000Z' }] },
        ],
      },
    ]
    const prevStudent = { id: 'student-1', name: 'Budi', programEnrollments: [] }

    let result: typeof prevStudent | null = prevStudent
    // Simulate the functional update
    result = (() => {
      if (!prevStudent) return null
      for (const parent of freshParents) {
        const found = parent.children.find((c) => c.id === prevStudent.id)
        if (found) return found as typeof prevStudent
      }
      return prevStudent
    })()

    expect(result?.programEnrollments).toHaveLength(1)
    expect((result?.programEnrollments as any[])[0].program).toBe('SEMPOA')
  })

  it('returns null when no student was selected', () => {
    const freshParents = [{ id: 'parent-1', children: [{ id: 'student-1', name: 'Budi' }] }]
    const prevStudent = null

    const result = (() => {
      if (!prevStudent) return null
      for (const parent of freshParents) {
        const found = parent.children.find((c) => (c as any).id === (prevStudent as any).id)
        if (found) return found
      }
      return prevStudent
    })()

    expect(result).toBeNull()
  })

  it('finds updated parent from fresh parent list', () => {
    const freshParents = [
      { id: 'parent-1', name: 'Ibu Ani', children: [{ id: 'student-1', programEnrollments: [{ program: 'SEMPOA' }] }] },
    ]
    const prevParent = { id: 'parent-1', name: 'Ibu Ani', children: [] }

    const result = (() => {
      if (!prevParent) return null
      return freshParents.find((p) => p.id === prevParent.id) ?? prevParent
    })()

    expect((result as any)?.children).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it passes (pure logic — no mocks needed)**

```
npx jest __tests__/pages/parents-client-sync.test.ts --no-coverage
```

Expected: 3 tests PASS

- [ ] **Step 3: Update `fetchParents` in `ParentsClient.tsx`**

Find the current `fetchParents` block (lines ~163–177):

```typescript
  // Fetch all parents data
  const fetchParents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/parents')
      if (!res.ok) throw new Error('Gagal memuat data wali murid.')
      const data = await res.json()
      setParents(data)
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem saat memuat data.')
    } finally {
      setLoading(false)
    }
  }, [])
```

Replace with:

```typescript
  // Fetch all parents data
  const fetchParents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/parents')
      if (!res.ok) throw new Error('Gagal memuat data wali murid.')
      const data: Parent[] = await res.json()
      setParents(data)
      setSelectedParent((prev) =>
        prev ? (data.find((p) => p.id === prev.id) ?? prev) : null
      )
      setSelectedStudent((prev) => {
        if (!prev) return null
        for (const parent of data) {
          const found = parent.children.find((c) => c.id === prev.id)
          if (found) return found
        }
        return prev
      })
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem saat memuat data.')
    } finally {
      setLoading(false)
    }
  }, [])
```

- [ ] **Step 4: Run TypeScript check**

```
npx tsc --noEmit 2>&1 | grep "ParentsClient" | head -10
```

Expected: no errors

- [ ] **Step 5: Run all tests**

```
npx jest --no-coverage 2>&1 | tail -8
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/admin/parents/ParentsClient.tsx" __tests__/pages/parents-client-sync.test.ts
git commit -m "fix: sync selectedStudent and selectedParent after data refresh"
```

---

### Manual Verification

- [ ] Start dev server: `npm run dev`
- [ ] Go to `/admin/parents`, open a student's analytics drawer (📊 button)
- [ ] In the drawer, click "+ Daftarkan Program" or "+ Tambah Program"
- [ ] Select a program and save
- [ ] **Expected:** drawer immediately shows the new program badge without closing/reopening
- [ ] **Expected:** table column for that student also shows the new badge
- [ ] Click "+" again on same student — modal should open in 'add' mode with the newly-added program excluded from the grid
