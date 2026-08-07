# Pencatatan Pengeluaran (Expense Recording) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `SUPER_ADMIN` a new "Pencatatan Pengeluaran" menu for manually recording expenses, and show a net total ("Total Bersih" = gross invoice total − period expenses) on the existing "Laporan Keuangan" page.

**Architecture:** Two new Prisma models (`ExpenseCategory`, `Expense`) behind a new CRUD menu (`/admin/expenses`) that follows the existing Milestone CRUD pattern (server page + client component + REST route handlers, all gated to `SUPER_ADMIN`). Categories are created on the fly via a "quick add" combobox rather than a separate CRUD screen. The Financial Report page/API gain an `expenseTotal` + `netTotal` field computed the same way the existing gross total is computed (period-filtered Prisma aggregate), duplicated across the two files that already duplicate this logic today (no refactor, matches existing pattern).

**Tech Stack:** Next.js 15 App Router, Prisma 6 + PostgreSQL, NextAuth (JWT session), Zod validation, Jest (with mocked `prisma`/`next-auth`) for API route tests, `react-select/creatable` for the category combobox (already a project dependency).

**Design spec:** `docs/superpowers/specs/2026-08-07-pencatatan-pengeluaran-design.md`

---

## Task 1: Data model — `ExpenseCategory` + `Expense`

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the `expenses` back-relation to `User`**

In `prisma/schema.prisma`, find the `User` model's last relation field:

```prisma
  tutorCheckIns        TutorCheckIn[]    @relation("TutorCheckIns")
}
```

Change it to:

```prisma
  tutorCheckIns        TutorCheckIn[]    @relation("TutorCheckIns")
  expenses             Expense[]
}
```

- [ ] **Step 2: Add the `ExpenseCategory` and `Expense` models**

Insert this block right after the closing `}` of the `MilestoneReport` model (before the `enum Role {` block):

```prisma
model ExpenseCategory {
  id        String    @id @default(cuid())
  name      String    @unique
  createdAt DateTime  @default(now())
  expenses  Expense[]
}

model Expense {
  id          String          @id @default(cuid())
  categoryId  String
  amount      Int
  description String
  date        DateTime
  createdById String
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  category    ExpenseCategory @relation(fields: [categoryId], references: [id])
  createdBy   User            @relation(fields: [createdById], references: [id])

  @@index([date])
}
```

- [ ] **Step 3: Format and validate the schema**

Run: `npx prisma format && npx prisma validate`
Expected: both commands exit with no errors; `prisma format` may reformat whitespace only.

- [ ] **Step 4: Create and apply the migration**

Run: `npx prisma migrate dev --name add_expense_tracking`
Expected: output ending with `Your database is now in sync with your schema.` and a new folder `prisma/migrations/<timestamp>_add_expense_tracking/migration.sql` containing `CREATE TABLE "ExpenseCategory"` and `CREATE TABLE "Expense"` statements. This also regenerates `@prisma/client` with the new `prisma.expenseCategory` and `prisma.expense` delegates.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add ExpenseCategory and Expense models"
```

---

## Task 2: `GET /api/expense-categories`

**Files:**
- Create: `app/api/expense-categories/route.ts`
- Test: `__tests__/api/expense-categories.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/expense-categories.test.ts`:

```typescript
import { GET } from '@/app/api/expense-categories/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    expenseCategory: { findMany: jest.fn() },
  },
}))

describe('GET /api/expense-categories', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-SUPER_ADMIN', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'TUTOR' } })
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns categories ordered by name', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
    ;(prisma.expenseCategory.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', name: 'Gaji' },
      { id: 'c2', name: 'Operasional' },
    ])
    const res = await GET()
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toEqual([
      { id: 'c1', name: 'Gaji' },
      { id: 'c2', name: 'Operasional' },
    ])
    expect(prisma.expenseCategory.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- expense-categories.test.ts`
Expected: FAIL with `Cannot find module '@/app/api/expense-categories/route'`

- [ ] **Step 3: Write the implementation**

Create `app/api/expense-categories/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const categories = await prisma.expenseCategory.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(categories)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- expense-categories.test.ts`
Expected: PASS, 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add app/api/expense-categories/route.ts __tests__/api/expense-categories.test.ts
git commit -m "feat: add GET /api/expense-categories"
```

---

## Task 3: `GET`/`POST /api/expenses`

**Files:**
- Create: `app/api/expenses/route.ts`
- Test: `__tests__/api/expenses.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/expenses.test.ts`:

```typescript
import { GET, POST } from '@/app/api/expenses/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    expense: { findMany: jest.fn(), create: jest.fn() },
    expenseCategory: { upsert: jest.fn() },
  },
}))

const makeGetReq = (qs = '') => new NextRequest(`http://localhost/api/expenses${qs}`)
const makePostReq = (body: object) =>
  new NextRequest('http://localhost/api/expenses', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

describe('GET /api/expenses', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeGetReq())
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-SUPER_ADMIN', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'PARENT' } })
    const res = await GET(makeGetReq())
    expect(res.status).toBe(403)
  })

  it('filters by month/year using the date field', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
    ;(prisma.expense.findMany as jest.Mock).mockResolvedValue([])
    await GET(makeGetReq('?month=8&year=2026'))
    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { date: { gte: new Date(2026, 7, 1), lt: new Date(2026, 8, 1) } },
      })
    )
  })

  it('filters by year only when month is absent', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
    ;(prisma.expense.findMany as jest.Mock).mockResolvedValue([])
    await GET(makeGetReq('?year=2026'))
    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { date: { gte: new Date(2026, 0, 1), lt: new Date(2027, 0, 1) } },
      })
    )
  })

  it('returns all expenses when no filter given', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
    ;(prisma.expense.findMany as jest.Mock).mockResolvedValue([])
    await GET(makeGetReq())
    expect(prisma.expense.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })
})

describe('POST /api/expenses', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', role: 'SUPER_ADMIN' } })
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await POST(makePostReq({ date: '2026-08-01', amount: 10000, description: 'Test', categoryId: 'c1' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-SUPER_ADMIN', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'TUTOR' } })
    const res = await POST(makePostReq({ date: '2026-08-01', amount: 10000, description: 'Test', categoryId: 'c1' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when both categoryId and categoryName are given', async () => {
    const res = await POST(
      makePostReq({ date: '2026-08-01', amount: 10000, description: 'Test', categoryId: 'c1', categoryName: 'Baru' })
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when neither categoryId nor categoryName is given', async () => {
    const res = await POST(makePostReq({ date: '2026-08-01', amount: 10000, description: 'Test' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-positive amount', async () => {
    const res = await POST(makePostReq({ date: '2026-08-01', amount: 0, description: 'Test', categoryId: 'c1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty description', async () => {
    const res = await POST(makePostReq({ date: '2026-08-01', amount: 10000, description: '', categoryId: 'c1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON body', async () => {
    const badReq = new NextRequest('http://localhost/api/expenses', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(badReq)
    expect(res.status).toBe(400)
  })

  it('creates an expense using an existing categoryId', async () => {
    ;(prisma.expense.create as jest.Mock).mockResolvedValue({ id: 'e1', amount: 10000, categoryId: 'c1' })
    const res = await POST(makePostReq({ date: '2026-08-01', amount: 10000, description: 'Test', categoryId: 'c1' }))
    expect(res.status).toBe(201)
    expect(prisma.expenseCategory.upsert).not.toHaveBeenCalled()
    expect(prisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ categoryId: 'c1', amount: 10000, description: 'Test', createdById: 'u1' }),
      })
    )
  })

  it('auto-creates the category when categoryName is given', async () => {
    ;(prisma.expenseCategory.upsert as jest.Mock).mockResolvedValue({ id: 'c2', name: 'Sewa' })
    ;(prisma.expense.create as jest.Mock).mockResolvedValue({ id: 'e2', amount: 20000, categoryId: 'c2' })
    const res = await POST(makePostReq({ date: '2026-08-01', amount: 20000, description: 'Sewa gedung', categoryName: 'Sewa' }))
    expect(res.status).toBe(201)
    expect(prisma.expenseCategory.upsert).toHaveBeenCalledWith({
      where: { name: 'Sewa' },
      update: {},
      create: { name: 'Sewa' },
    })
    expect(prisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ categoryId: 'c2' }) })
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- expenses.test.ts`
Expected: FAIL with `Cannot find module '@/app/api/expenses/route'`

- [ ] **Step 3: Write the implementation**

Create `app/api/expenses/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const createExpenseSchema = z
  .object({
    date: z.string().min(1),
    amount: z.number().int().positive(),
    description: z.string().min(1),
    categoryId: z.string().optional(),
    categoryName: z.string().optional(),
  })
  .refine((data) => Boolean(data.categoryId) !== Boolean(data.categoryName), {
    message: 'Provide exactly one of categoryId or categoryName',
  })

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null

  const dateFilter =
    month !== null && year !== null
      ? { date: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } }
      : year !== null
      ? { date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } }
      : {}

  const expenses = await prisma.expense.findMany({
    where: dateFilter,
    include: { category: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(expenses)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = createExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { date, amount, description, categoryId, categoryName } = parsed.data

  const resolvedCategoryId = categoryId
    ? categoryId
    : (
        await prisma.expenseCategory.upsert({
          where: { name: categoryName! },
          update: {},
          create: { name: categoryName! },
        })
      ).id

  const expense = await prisma.expense.create({
    data: {
      date: new Date(date),
      amount,
      description,
      categoryId: resolvedCategoryId,
      createdById: (session.user as any).id,
    },
    include: { category: { select: { id: true, name: true } } },
  })

  return NextResponse.json(expense, { status: 201 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- expenses.test.ts`
Expected: PASS, all 14 tests passed.

- [ ] **Step 5: Commit**

```bash
git add app/api/expenses/route.ts __tests__/api/expenses.test.ts
git commit -m "feat: add GET/POST /api/expenses"
```

---

## Task 4: `PATCH`/`DELETE /api/expenses/[id]`

**Files:**
- Create: `app/api/expenses/[id]/route.ts`
- Test: `__tests__/api/expenses-id.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/expenses-id.test.ts`:

```typescript
import { PATCH, DELETE } from '@/app/api/expenses/[id]/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    expense: { update: jest.fn(), delete: jest.fn() },
    expenseCategory: { upsert: jest.fn() },
  },
}))

const makeReq = (body: object) =>
  new NextRequest('http://localhost/api/expenses/e1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
const makeParams = () => ({ params: Promise.resolve({ id: 'e1' }) })

describe('PATCH /api/expenses/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await PATCH(makeReq({ amount: 5000 }), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-SUPER_ADMIN', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'TUTOR' } })
    const res = await PATCH(makeReq({ amount: 5000 }), makeParams())
    expect(res.status).toBe(403)
  })

  it('returns 400 when both categoryId and categoryName are given', async () => {
    const res = await PATCH(makeReq({ categoryId: 'c1', categoryName: 'Baru' }), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-positive amount', async () => {
    const res = await PATCH(makeReq({ amount: -1 }), makeParams())
    expect(res.status).toBe(400)
  })

  it('updates fields without touching category when none given', async () => {
    ;(prisma.expense.update as jest.Mock).mockResolvedValue({ id: 'e1', amount: 15000 })
    const res = await PATCH(makeReq({ amount: 15000 }), makeParams())
    expect(res.status).toBe(200)
    expect(prisma.expenseCategory.upsert).not.toHaveBeenCalled()
    expect(prisma.expense.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e1' },
        data: expect.objectContaining({ amount: 15000, categoryId: undefined }),
      })
    )
  })

  it('resolves a new categoryId when categoryName is given', async () => {
    ;(prisma.expenseCategory.upsert as jest.Mock).mockResolvedValue({ id: 'c3', name: 'Transport' })
    ;(prisma.expense.update as jest.Mock).mockResolvedValue({ id: 'e1', categoryId: 'c3' })
    const res = await PATCH(makeReq({ categoryName: 'Transport' }), makeParams())
    expect(res.status).toBe(200)
    expect(prisma.expenseCategory.upsert).toHaveBeenCalledWith({
      where: { name: 'Transport' },
      update: {},
      create: { name: 'Transport' },
    })
    expect(prisma.expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ categoryId: 'c3' }) })
    )
  })
})

describe('DELETE /api/expenses/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(new NextRequest('http://localhost/api/expenses/e1'), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-SUPER_ADMIN', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'PARENT' } })
    const res = await DELETE(new NextRequest('http://localhost/api/expenses/e1'), makeParams())
    expect(res.status).toBe(403)
  })

  it('deletes the expense', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
    ;(prisma.expense.delete as jest.Mock).mockResolvedValue({ id: 'e1' })
    const res = await DELETE(new NextRequest('http://localhost/api/expenses/e1'), makeParams())
    expect(res.status).toBe(200)
    expect(prisma.expense.delete).toHaveBeenCalledWith({ where: { id: 'e1' } })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- expenses-id.test.ts`
Expected: FAIL with `Cannot find module '@/app/api/expenses/[id]/route'`

- [ ] **Step 3: Write the implementation**

Create `app/api/expenses/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const updateExpenseSchema = z
  .object({
    date: z.string().min(1).optional(),
    amount: z.number().int().positive().optional(),
    description: z.string().min(1).optional(),
    categoryId: z.string().optional(),
    categoryName: z.string().optional(),
  })
  .refine((data) => !(data.categoryId && data.categoryName), {
    message: 'Provide at most one of categoryId or categoryName',
  })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = updateExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { date, amount, description, categoryId, categoryName } = parsed.data

  const resolvedCategoryId = categoryName
    ? (
        await prisma.expenseCategory.upsert({
          where: { name: categoryName },
          update: {},
          create: { name: categoryName },
        })
      ).id
    : categoryId

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      date: date ? new Date(date) : undefined,
      amount,
      description,
      categoryId: resolvedCategoryId,
    },
    include: { category: { select: { id: true, name: true } } },
  })

  return NextResponse.json(expense)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  await prisma.expense.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- expenses-id.test.ts`
Expected: PASS, all 9 tests passed.

- [ ] **Step 5: Commit**

```bash
git add app/api/expenses/[id]/route.ts __tests__/api/expenses-id.test.ts
git commit -m "feat: add PATCH/DELETE /api/expenses/[id]"
```

---

## Task 5: Sidebar menu entry

**Files:**
- Modify: `components/dashboard/sidebar.tsx:8-32` (icon imports), `components/dashboard/sidebar.tsx:93-101` (Billing group)

- [ ] **Step 1: Add the `Wallet` icon import**

In `components/dashboard/sidebar.tsx`, the `lucide-react` import block currently ends with:

```typescript
  Scroll,
  UserCheck,
} from 'lucide-react'
```

Change it to:

```typescript
  Scroll,
  UserCheck,
  Wallet,
} from 'lucide-react'
```

- [ ] **Step 2: Add the menu item to the Billing group**

Find this block (inside the `SUPER_ADMIN` case of `getNavLinks()`):

```typescript
          {
            name: 'Billing',
            icon: CreditCard,
            subItems: [
              { name: 'Tagihan', href: '/admin/billing', icon: CreditCard },
              { name: 'Laporan Keuangan', href: '/admin/financial-report', icon: BarChart3 },
              { name: 'Paket Harga', href: '/admin/pricing', icon: Tag },
            ],
          },
```

Change it to:

```typescript
          {
            name: 'Billing',
            icon: CreditCard,
            subItems: [
              { name: 'Tagihan', href: '/admin/billing', icon: CreditCard },
              { name: 'Laporan Keuangan', href: '/admin/financial-report', icon: BarChart3 },
              { name: 'Pencatatan Pengeluaran', href: '/admin/expenses', icon: Wallet },
              { name: 'Paket Harga', href: '/admin/pricing', icon: Tag },
            ],
          },
```

- [ ] **Step 3: Verify the app still builds**

Run: `npx tsc --noEmit`
Expected: no new type errors (exits 0, or with only pre-existing errors unrelated to `sidebar.tsx`).

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/sidebar.tsx
git commit -m "feat: add Pencatatan Pengeluaran to superadmin sidebar"
```

---

## Task 6: Expense recording page (CRUD UI)

**Files:**
- Create: `app/(dashboard)/admin/expenses/page.tsx`
- Create: `app/(dashboard)/admin/expenses/ExpensesClient.tsx`

- [ ] **Step 1: Create the server page**

Create `app/(dashboard)/admin/expenses/page.tsx`:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import ExpensesClient from './ExpensesClient'

export default async function AdminExpensesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') redirect('/admin')

  const now = new Date()
  const defaultMonth = String(now.getMonth() + 1)
  const defaultYear = String(now.getFullYear())

  const [expensesData, categoriesData] = await Promise.all([
    prisma.expense.findMany({
      where: {
        date: {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
          lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    }),
    prisma.expenseCategory.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const expenses = expensesData.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    amount: e.amount,
    description: e.description,
    category: e.category,
  }))

  return (
    <ExpensesClient
      initialExpenses={expenses}
      initialCategories={categoriesData}
      defaultMonth={defaultMonth}
      defaultYear={defaultYear}
    />
  )
}
```

- [ ] **Step 2: Create the client component**

Create `app/(dashboard)/admin/expenses/ExpensesClient.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import CreatableSelect from 'react-select/creatable'
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useToastNotification } from '@/lib/hooks/use-toast-notification'
import { formatRupiah } from '@/lib/utils'

type Category = { id: string; name: string }
type Expense = {
  id: string
  date: string
  amount: number
  description: string
  category: Category
}
type CategoryOption = { value: string; label: string; isNew?: boolean }

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)
const MONTHS = [
  { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' }, { value: '4', label: 'April' },
  { value: '5', label: 'Mei' }, { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' }, { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' }, { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
]

const emptyForm = { date: new Date().toISOString().slice(0, 10), amount: 0, description: '' }

export default function ExpensesClient({
  initialExpenses,
  initialCategories,
  defaultMonth,
  defaultYear,
}: {
  initialExpenses: Expense[]
  initialCategories: Category[]
  defaultMonth: string
  defaultYear: string
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const toast = useToastNotification()
  const [month, setMonth] = useState(defaultMonth)
  const [year, setYear] = useState(defaultYear)
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Expense | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedCategory, setSelectedCategory] = useState<CategoryOption | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const categoryOptions: CategoryOption[] = categories.map((c) => ({ value: c.id, label: c.name }))

  const fetchExpenses = useCallback(async (m: string, y: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/expenses?month=${m}&year=${y}`)
      setExpenses(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  const handleFilterChange = (m: string, y: string) => {
    setMonth(m)
    setYear(y)
    fetchExpenses(m, y)
  }

  const openCreate = () => {
    setEditTarget(null)
    setForm(emptyForm)
    setSelectedCategory(null)
    setError('')
    setShowForm(true)
  }

  const openEdit = (e: Expense) => {
    setEditTarget(e)
    setForm({ date: e.date.slice(0, 10), amount: e.amount, description: e.description })
    setSelectedCategory({ value: e.category.id, label: e.category.name })
    setError('')
    setShowForm(true)
  }

  const handleSubmit = useCallback(async () => {
    if (!form.description.trim()) { setError('Deskripsi wajib diisi'); return }
    if (form.amount <= 0) { setError('Jumlah harus lebih dari 0'); return }
    if (!selectedCategory) { setError('Kategori wajib dipilih'); return }

    setLoading(true)
    setError('')
    const categoryField = selectedCategory.isNew
      ? { categoryName: selectedCategory.label }
      : { categoryId: selectedCategory.value }
    const payload = { date: form.date, amount: form.amount, description: form.description, ...categoryField }

    try {
      if (editTarget) {
        const res = await fetch(`/api/expenses/${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Gagal memperbarui pengeluaran')
      } else {
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Gagal mencatat pengeluaran')
      }
      if (selectedCategory.isNew) {
        const catRes = await fetch('/api/expense-categories')
        setCategories(await catRes.json())
      }
      setShowForm(false)
      await fetchExpenses(month, year)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [form, selectedCategory, editTarget, month, year, fetchExpenses, router])

  const handleDelete = useCallback(async (id: string) => {
    const ok = await confirm({
      title: 'Hapus Pengeluaran',
      message: 'Hapus catatan pengeluaran ini?',
      variant: 'danger',
      confirmLabel: 'Hapus',
    })
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus pengeluaran')
      setExpenses((prev) => prev.filter((e) => e.id !== id))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [confirm, toast])

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-rose-600 to-orange-600 p-5 sm:p-8 text-white shadow-xl shadow-rose-600/10">
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">Pencatatan Pengeluaran</h1>
        <p className="mt-2 text-sm sm:text-base text-rose-100">
          Catat pengeluaran operasional untuk menghitung total bersih pendapatan.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
        <div className="flex gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Bulan</label>
            <select
              value={month}
              onChange={(e) => handleFilterChange(e.target.value, year)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 min-w-[130px]"
            >
              {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tahun</label>
            <select
              value={year}
              onChange={(e) => handleFilterChange(month, e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 min-w-[90px]"
            >
              {YEARS.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors"
        >
          <Plus className="h-4 w-4" />
          Tambah Pengeluaran
        </button>
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-orange-600 text-white">
              <Wallet className="h-4 w-4" />
            </div>
            <h2 className="font-bold text-slate-800 dark:text-white">
              {expenses.length} Pengeluaran — Total {formatRupiah(total)}
            </h2>
          </div>
        </div>

        {expenses.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <p className="text-3xl">💸</p>
            <p className="mt-2 text-sm">Belum ada pengeluaran pada periode ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-start justify-between px-6 py-4 gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">{e.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(e.date).toLocaleDateString('id-ID')} · {e.category.name}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-rose-600 text-sm">{formatRupiah(e.amount)}</span>
                  <button
                    onClick={() => openEdit(e)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 border border-rose-100 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="font-extrabold text-slate-800 dark:text-white">
              {editTarget ? 'Edit Pengeluaran' : 'Tambah Pengeluaran Baru'}
            </h3>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-600">{error}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tanggal *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kategori *</label>
                <CreatableSelect<CategoryOption>
                  className="mt-1.5"
                  value={selectedCategory}
                  onChange={(opt) => setSelectedCategory(opt)}
                  options={categoryOptions}
                  placeholder="Pilih atau ketik kategori baru..."
                  formatCreateLabel={(input) => `Tambah kategori "${input}"`}
                  getNewOptionData={(inputValue, label) => ({ value: inputValue, label: label as string, isNew: true })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Jumlah (Rp) *</label>
                <input
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: parseInt(e.target.value) || 0 })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deskripsi *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="contoh: Bayar listrik bulan Agustus"
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : editTarget ? 'Simpan Perubahan' : 'Tambah Pengeluaran'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify the app builds**

Run: `npx tsc --noEmit`
Expected: no new type errors introduced by these two files.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, log in as a `SUPER_ADMIN` user, open `/admin/expenses`.
Expected: page loads, "Tambah Pengeluaran" opens the modal, submitting with a brand-new category name creates both the category and the expense, the list re-filters when month/year change, and edit/delete work. Stop the dev server after checking (`Ctrl+C`).

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/admin/expenses"
git commit -m "feat: add Pencatatan Pengeluaran admin page"
```

---

## Task 7: Net total on Laporan Keuangan

**Files:**
- Modify: `app/api/admin/financial-report/summary/route.ts`
- Modify: `app/(dashboard)/admin/financial-report/page.tsx`
- Modify: `app/(dashboard)/admin/financial-report/FinancialReportClient.tsx`
- Test: `__tests__/api/admin/financial-report-summary.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/admin/financial-report-summary.test.ts`:

```typescript
import { GET } from '@/app/api/admin/financial-report/summary/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    invoice: { findMany: jest.fn() },
    expense: { aggregate: jest.fn() },
  },
}))

const makeReq = (qs: string) => new NextRequest(`http://localhost/api/admin/financial-report/summary${qs}`)

describe('GET /api/admin/financial-report/summary — net total', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
  })

  it('computes netTotal as gross invoice total minus expense total for the period', async () => {
    ;(prisma.invoice.findMany as jest.Mock).mockResolvedValue([
      { amount: 500000, status: 'PAID' },
      { amount: 300000, status: 'PENDING' },
    ])
    ;(prisma.expense.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 200000 } })

    const res = await GET(makeReq('?month=8&year=2026'))
    const data = await res.json()

    expect(data.total.amount).toBe(800000)
    expect(data.expenseTotal).toBe(200000)
    expect(data.netTotal).toBe(600000)
    expect(prisma.expense.aggregate).toHaveBeenCalledWith({
      where: { date: { gte: new Date(2026, 7, 1), lt: new Date(2026, 8, 1) } },
      _sum: { amount: true },
    })
  })

  it('treats a period with no expenses as expenseTotal 0', async () => {
    ;(prisma.invoice.findMany as jest.Mock).mockResolvedValue([{ amount: 100000, status: 'PAID' }])
    ;(prisma.expense.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: null } })

    const res = await GET(makeReq('?month=8&year=2026'))
    const data = await res.json()

    expect(data.expenseTotal).toBe(0)
    expect(data.netTotal).toBe(100000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- financial-report-summary.test.ts`
Expected: FAIL — `data.expenseTotal` is `undefined`, `data.netTotal` is `undefined`.

- [ ] **Step 3: Update the summary API route**

In `app/api/admin/financial-report/summary/route.ts`, replace:

```typescript
  const classFilter = classId ? { student: { enrollments: { some: { classId } } } } : {}

  const invoices = await prisma.invoice.findMany({
    where: { ...dateFilter, ...classFilter },
    select: { amount: true, status: true },
  })

  const summary = {
    total:     { count: invoices.length, amount: invoices.reduce((s, i) => s + i.amount, 0) },
    paid:      { count: invoices.filter(i => i.status === 'PAID').length,      amount: invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0) },
    pending:   { count: invoices.filter(i => i.status === 'PENDING').length,   amount: invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.amount, 0) },
    overdue:   { count: invoices.filter(i => i.status === 'OVERDUE').length,   amount: invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.amount, 0) },
    cancelled: { count: invoices.filter(i => i.status === 'CANCELLED').length, amount: invoices.filter(i => i.status === 'CANCELLED').reduce((s, i) => s + i.amount, 0) },
  }

  return NextResponse.json(summary)
```

with:

```typescript
  const classFilter = classId ? { student: { enrollments: { some: { classId } } } } : {}

  // Expense.date is the expense's own date, so it reuses the same month/year
  // filter shape as Invoice.createdAt, just applied to a different field.
  const expenseDateFilter =
    month !== null && year !== null
      ? { date: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } }
      : year !== null
      ? { date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } }
      : {}

  const [invoices, expenseAgg] = await Promise.all([
    prisma.invoice.findMany({
      where: { ...dateFilter, ...classFilter },
      select: { amount: true, status: true },
    }),
    prisma.expense.aggregate({ where: expenseDateFilter, _sum: { amount: true } }),
  ])

  const expenseTotal = expenseAgg._sum.amount ?? 0
  const grossTotal = invoices.reduce((s, i) => s + i.amount, 0)

  const summary = {
    total:     { count: invoices.length, amount: grossTotal },
    paid:      { count: invoices.filter(i => i.status === 'PAID').length,      amount: invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0) },
    pending:   { count: invoices.filter(i => i.status === 'PENDING').length,   amount: invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.amount, 0) },
    overdue:   { count: invoices.filter(i => i.status === 'OVERDUE').length,   amount: invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.amount, 0) },
    cancelled: { count: invoices.filter(i => i.status === 'CANCELLED').length, amount: invoices.filter(i => i.status === 'CANCELLED').reduce((s, i) => s + i.amount, 0) },
    expenseTotal,
    netTotal: grossTotal - expenseTotal,
  }

  return NextResponse.json(summary)
```

Note `classFilter` does not apply to `expenseAgg` — expenses aren't tied to a class, only to a time period.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- financial-report-summary.test.ts`
Expected: PASS, 2 tests passed.

- [ ] **Step 5: Mirror the same computation in the SSR page**

In `app/(dashboard)/admin/financial-report/page.tsx`, replace:

```typescript
  const [invoicesData, summaryInvoices, classesData] = await Promise.all([
    prisma.invoice.findMany({
      where: dateFilter,
      include: { student: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.findMany({
      where: dateFilter,
      select: { amount: true, status: true },
    }),
    // mirrors /api/classes GET for admin
    prisma.class.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])
```

with:

```typescript
  // Expense.date mirrors the same month/year window as Invoice.createdAt above
  const expenseDateFilter = {
    date: {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    },
  }

  const [invoicesData, summaryInvoices, classesData, expenseAgg] = await Promise.all([
    prisma.invoice.findMany({
      where: dateFilter,
      include: { student: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.findMany({
      where: dateFilter,
      select: { amount: true, status: true },
    }),
    // mirrors /api/classes GET for admin
    prisma.class.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.expense.aggregate({ where: expenseDateFilter, _sum: { amount: true } }),
  ])
```

Then replace:

```typescript
  // Build summary (mirrors /api/admin/financial-report/summary logic)
  const summary = {
    total:     { count: summaryInvoices.length, amount: summaryInvoices.reduce((s, i) => s + i.amount, 0) },
    paid:      { count: summaryInvoices.filter(i => i.status === 'PAID').length,      amount: summaryInvoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0) },
    pending:   { count: summaryInvoices.filter(i => i.status === 'PENDING').length,   amount: summaryInvoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.amount, 0) },
    overdue:   { count: summaryInvoices.filter(i => i.status === 'OVERDUE').length,   amount: summaryInvoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.amount, 0) },
    cancelled: { count: summaryInvoices.filter(i => i.status === 'CANCELLED').length, amount: summaryInvoices.filter(i => i.status === 'CANCELLED').reduce((s, i) => s + i.amount, 0) },
  }
```

with:

```typescript
  // Build summary (mirrors /api/admin/financial-report/summary logic)
  const expenseTotal = expenseAgg._sum.amount ?? 0
  const grossTotal = summaryInvoices.reduce((s, i) => s + i.amount, 0)
  const summary = {
    total:     { count: summaryInvoices.length, amount: grossTotal },
    paid:      { count: summaryInvoices.filter(i => i.status === 'PAID').length,      amount: summaryInvoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0) },
    pending:   { count: summaryInvoices.filter(i => i.status === 'PENDING').length,   amount: summaryInvoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.amount, 0) },
    overdue:   { count: summaryInvoices.filter(i => i.status === 'OVERDUE').length,   amount: summaryInvoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.amount, 0) },
    cancelled: { count: summaryInvoices.filter(i => i.status === 'CANCELLED').length, amount: summaryInvoices.filter(i => i.status === 'CANCELLED').reduce((s, i) => s + i.amount, 0) },
    expenseTotal,
    netTotal: grossTotal - expenseTotal,
  }
```

- [ ] **Step 6: Update the client's `Summary` type and add the two new cards**

In `app/(dashboard)/admin/financial-report/FinancialReportClient.tsx`, replace:

```typescript
interface Summary {
  total:     { count: number; amount: number }
  paid:      { count: number; amount: number }
  pending:   { count: number; amount: number }
  overdue:   { count: number; amount: number }
  cancelled: { count: number; amount: number }
}
```

with:

```typescript
interface Summary {
  total:     { count: number; amount: number }
  paid:      { count: number; amount: number }
  pending:   { count: number; amount: number }
  overdue:   { count: number; amount: number }
  cancelled: { count: number; amount: number }
  expenseTotal: number
  netTotal: number
}
```

Then replace the summary cards block:

```typescript
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Tagihan"  count={summary.total.count}   amount={summary.total.amount}   colorClass="bg-slate-50 border-slate-200 text-slate-800" />
          <SummaryCard label="Terbayar"       count={summary.paid.count}    amount={summary.paid.amount}    colorClass="bg-emerald-50 border-emerald-100 text-emerald-800" />
          <SummaryCard label="Belum Lunas"    count={summary.pending.count} amount={summary.pending.amount} colorClass="bg-amber-50 border-amber-100 text-amber-800" />
          <SummaryCard label="Terlambat"      count={summary.overdue.count} amount={summary.overdue.amount} colorClass="bg-rose-50 border-rose-100 text-rose-800" />
        </div>
      )}
```

with:

```typescript
      {/* Summary cards */}
      {summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Total Tagihan"  count={summary.total.count}   amount={summary.total.amount}   colorClass="bg-slate-50 border-slate-200 text-slate-800" />
            <SummaryCard label="Terbayar"       count={summary.paid.count}    amount={summary.paid.amount}    colorClass="bg-emerald-50 border-emerald-100 text-emerald-800" />
            <SummaryCard label="Belum Lunas"    count={summary.pending.count} amount={summary.pending.amount} colorClass="bg-amber-50 border-amber-100 text-amber-800" />
            <SummaryCard label="Terlambat"      count={summary.overdue.count} amount={summary.overdue.amount} colorClass="bg-rose-50 border-rose-100 text-rose-800" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SummaryCard label="Total Pengeluaran" count={0} amount={summary.expenseTotal} colorClass="bg-orange-50 border-orange-100 text-orange-800" />
            <SummaryCard label="Total Bersih"      count={0} amount={summary.netTotal}     colorClass="bg-indigo-50 border-indigo-100 text-indigo-800" />
          </div>
        </>
      )}
```

`SummaryCard` always renders a `{count} invoice` line; for these two new cards that count is meaningless, so pass `count={0}`. Instead, hide that line for these two cards by making `count` optional on `SummaryCard`. Replace the `SummaryCard` function:

```typescript
function SummaryCard({
  label, count, amount, colorClass,
}: { label: string; count: number; amount: number; colorClass: string }) {
  return (
    <div className={`rounded-2xl p-4 sm:p-5 border shadow-xs ${colorClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-base sm:text-2xl font-extrabold leading-tight">{formatRupiah(amount)}</p>
      <p className="text-xs mt-1 opacity-60">{count} invoice</p>
    </div>
  )
}
```

with:

```typescript
function SummaryCard({
  label, count, amount, colorClass,
}: { label: string; count?: number; amount: number; colorClass: string }) {
  return (
    <div className={`rounded-2xl p-4 sm:p-5 border shadow-xs ${colorClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-base sm:text-2xl font-extrabold leading-tight">{formatRupiah(amount)}</p>
      {count !== undefined && <p className="text-xs mt-1 opacity-60">{count} invoice</p>}
    </div>
  )
}
```

And drop the now-unneeded `count={0}` props on the two new cards:

```typescript
            <SummaryCard label="Total Pengeluaran" amount={summary.expenseTotal} colorClass="bg-orange-50 border-orange-100 text-orange-800" />
            <SummaryCard label="Total Bersih"      amount={summary.netTotal}     colorClass="bg-indigo-50 border-indigo-100 text-indigo-800" />
```

- [ ] **Step 7: Run the full test suite and typecheck**

Run: `npm test`
Expected: all suites pass, including the new `financial-report-summary.test.ts`.

Run: `npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 8: Manual smoke test**

Run: `npm run dev`, log in as `SUPER_ADMIN`, open `/admin/financial-report`, record an expense for the current month via `/admin/expenses`, come back and confirm "Total Bersih" drops by that expense's amount. Stop the dev server after checking.

- [ ] **Step 9: Commit**

```bash
git add app/api/admin/financial-report/summary/route.ts "app/(dashboard)/admin/financial-report/page.tsx" "app/(dashboard)/admin/financial-report/FinancialReportClient.tsx" __tests__/api/admin/financial-report-summary.test.ts
git commit -m "feat: show net total (gross minus expenses) on Laporan Keuangan"
```

---

## Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all suites pass (0 failed), including every new test file added in Tasks 2–4 and 7.

- [ ] **Step 2: Run the full typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0 with no errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: build completes successfully, including the new `/admin/expenses` route in the route list.

- [ ] **Step 4: Report to user**

Summarize for the user: all files created/modified across Tasks 1–7, the migration name applied, and confirmation that tests/typecheck/build all pass.
