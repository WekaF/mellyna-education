# Master Data Program Utama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SUPER_ADMIN bisa menambah/ubah/nonaktifkan/hapus "Program Utama" (selain SEMPOA, CALISTUNG, ENGLISH) lewat master data, dan menu Kelas + Timetable memakai daftar itu (bukan hardcode).

**Architecture:** Tabel baru `MainProgram` dengan primary key `code` (string, mis. `CODING_KIDS`). Kolom `Class.mainProgram` diubah dari enum `Program` ke `TEXT` + foreign key ke `MainProgram.code` — nilai lama (`'SEMPOA'` dst) tetap sama, jadi semua kode yang membandingkan string tetap jalan. Sub-program (`ClassProgram`), `ProgramEnrollment`, `Milestone` **tetap** pakai enum `Program` (di luar scope). Kelas dengan program utama custom boleh punya 0 sub-program.

**Tech Stack:** Next.js 15 App Router, Prisma 6 + PostgreSQL, next-auth, zod 4, Jest (prisma di-mock), Tailwind.

**Di luar scope (sengaja):**
- Program utama custom **tidak** muncul di ProgramEnrollment (pendaftaran program siswa), Milestone, Raport, halaman "Master Program" (Kurikulum), dan marketing. Itu butuh konversi enum `Program` → tabel di ~38 file; plan terpisah kalau dibutuhkan.
- Form "Buat kelas baru" di Timetable tidak dapat picker program utama. Kelas program custom dibuat dari menu Kelas, lalu dijadwalkan di Timetable via "pilih kelas existing".
- Warna badge program custom: fallback abu-abu (`bg-slate-100`). Tambah kolom warna kalau diminta.

---

## File Map

| File | Aksi | Tanggung jawab |
|---|---|---|
| `prisma/schema.prisma` | Modify | model `MainProgram`, relasi `Class.mainProgram` |
| `prisma/migrations/<ts>_add_main_program_master/migration.sql` | Create | tabel + seed 3 default + enum→text + FK |
| `lib/program-config.ts` | Modify | `isEnumProgram()` (client-safe) |
| `lib/main-program.ts` | Create | `toMainProgramCode`, `sessionTopic`, `resolveMainProgram` (server) |
| `app/api/main-programs/route.ts` | Create | GET list, POST create |
| `app/api/main-programs/[code]/route.ts` | Create | PUT update, DELETE |
| `app/api/classes/route.ts` | Modify | validasi `mainProgram` via tabel, `programs` boleh kosong |
| `app/api/classes/[id]/route.ts` | Modify | idem; hapus fallback yang menimpa mainProgram |
| `app/api/admin/timetable/generate/route.ts` | Modify | topic pakai `sessionTopic` |
| `app/api/cron/timetable-generate/route.ts` | Modify | topic pakai `sessionTopic` |
| `app/(dashboard)/admin/main-programs/page.tsx` | Create | server page, guard SUPER_ADMIN |
| `app/(dashboard)/admin/main-programs/MainProgramsClient.tsx` | Create | UI CRUD |
| `components/dashboard/sidebar.tsx` | Modify | menu "Program Utama" (SUPER_ADMIN) |
| `app/(dashboard)/admin/classes/page.tsx` | Modify | kirim `mainPrograms`, `canManageMainPrograms` |
| `app/(dashboard)/admin/classes/ClassesClient.tsx` | Modify | picker & grouping dinamis |
| `app/(dashboard)/admin/timetable/page.tsx` | Modify | kirim `mainPrograms` |
| `app/(dashboard)/admin/timetable/TimetableClient.tsx` | Modify | grouping dinamis |
| `__tests__/lib/main-program.test.ts` | Create | test helper |
| `__tests__/api/main-programs.test.ts` | Create | test API master |
| `__tests__/api/classes-main-program.test.ts` | Create | test POST /api/classes |

---

### Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (model `Class` ~line 55-70, tambah model baru)
- Create: `prisma/migrations/<timestamp>_add_main_program_master/migration.sql`

- [ ] **Step 1: Cek data existing sebelum migrasi**

Run:
```bash
docker compose exec postgres psql -U mellyna -d mellyna_db -c 'SELECT "mainProgram", COUNT(*) FROM "Class" GROUP BY 1;'
```
Expected: daftar nilai. Baris dengan nilai selain `SEMPOA`/`CALISTUNG`/`ENGLISH` (mis. `AHE`) akan di-set `NULL` oleh migrasi. Ini tidak mengubah tampilan — kelas itu sudah tampil di grup "Lainnya" sekarang. Catat jumlahnya untuk laporan.

- [ ] **Step 2: Ubah schema**

Di `model Class`, ganti baris `mainProgram      Program?` dengan:
```prisma
  mainProgram      String?
  mainProgramRef   MainProgram?   @relation(fields: [mainProgram], references: [code], onDelete: Restrict, onUpdate: Cascade)
```
Tambah model baru (setelah `model Class`):
```prisma
model MainProgram {
  code      String   @id
  name      String
  order     Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  classes   Class[]
}
```

- [ ] **Step 3: Generate migration kosong (jangan apply dulu)**

Run: `rtk npx prisma migrate dev --create-only --name add_main_program_master`
Expected: folder baru `prisma/migrations/<timestamp>_add_main_program_master/`.

- [ ] **Step 4: Ganti SQL hasil generate**

Prisma akan generate DROP+ADD column untuk perubahan tipe → data hilang. Ganti seluruh isi `migration.sql` dengan:
```sql
-- CreateTable
CREATE TABLE "MainProgram" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MainProgram_pkey" PRIMARY KEY ("code")
);

-- Seed default main programs
INSERT INTO "MainProgram" ("code", "name", "order", "updatedAt") VALUES
  ('SEMPOA', 'Sempoa', 1, CURRENT_TIMESTAMP),
  ('CALISTUNG', 'Calistung', 2, CURRENT_TIMESTAMP),
  ('ENGLISH', 'English', 3, CURRENT_TIMESTAMP);

-- Class.mainProgram: enum -> text, keep values
ALTER TABLE "Class" ALTER COLUMN "mainProgram" TYPE TEXT USING "mainProgram"::TEXT;

-- Sub-program codes (AHE, EFK, ...) stored as mainProgram already render under "Lainnya"; NULL keeps that
UPDATE "Class" SET "mainProgram" = NULL
WHERE "mainProgram" IS NOT NULL AND "mainProgram" NOT IN (SELECT "code" FROM "MainProgram");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_mainProgram_fkey"
  FOREIGN KEY ("mainProgram") REFERENCES "MainProgram"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 5: Apply + generate client**

Run: `rtk npx prisma migrate dev`
Expected: "Your database is now in sync with your schema." dan Prisma Client ter-generate. Tidak boleh ada prompt "drift"/"reset". Kalau muncul prompt reset → STOP, jangan setuju, laporkan.

- [ ] **Step 6: Verifikasi**

Run:
```bash
docker compose exec postgres psql -U mellyna -d mellyna_db -c 'SELECT code, name, "order" FROM "MainProgram" ORDER BY "order";'
```
Expected: 3 baris SEMPOA / CALISTUNG / ENGLISH.

- [ ] **Step 7: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat). Sertakan jumlah kelas yang di-NULL-kan dari Step 1.

- [ ] **Step 8: Commit**

```bash
rtk git add prisma/schema.prisma prisma/migrations
rtk git commit -m "feat(db): add MainProgram master table for class main program

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Helper program utama

**Files:**
- Modify: `lib/program-config.ts` (append)
- Create: `lib/main-program.ts`
- Test: `__tests__/lib/main-program.test.ts`

- [ ] **Step 1: Tulis test gagal**

`__tests__/lib/main-program.test.ts`:
```ts
jest.mock('@/lib/db', () => ({
  prisma: { mainProgram: { findUnique: jest.fn(), findMany: jest.fn() } },
}))

import { prisma } from '@/lib/db'
import { toMainProgramCode, sessionTopic, resolveMainProgram } from '@/lib/main-program'
import { isEnumProgram } from '@/lib/program-config'

describe('toMainProgramCode', () => {
  it('uppercases and joins words with underscore', () => {
    expect(toMainProgramCode('Coding Kids')).toBe('CODING_KIDS')
    expect(toMainProgramCode('  bahasa-arab  ')).toBe('BAHASA_ARAB')
  })
  it('returns empty string for no alphanumerics', () => {
    expect(toMainProgramCode('!!!')).toBe('')
  })
})

describe('isEnumProgram', () => {
  it('detects legacy enum codes', () => {
    expect(isEnumProgram('SEMPOA')).toBe(true)
    expect(isEnumProgram('CODING')).toBe(false)
  })
})

describe('sessionTopic', () => {
  it('uses sub-programs when present', () => {
    expect(sessionTopic({ mainProgram: 'SEMPOA', programs: [{ program: 'SEMPOA' }, { program: 'AHE' }] }))
      .toBe('Sesi Belajar SEMPOA + AHE - Rutin')
  })
  it('falls back to main program', () => {
    expect(sessionTopic({ mainProgram: 'CODING', programs: [] })).toBe('Sesi Belajar CODING - Rutin')
  })
  it('falls back to "Kelas" when nothing set', () => {
    expect(sessionTopic({ mainProgram: null, programs: [] })).toBe('Sesi Belajar Kelas - Rutin')
  })
})

describe('resolveMainProgram', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns requested code when it exists', async () => {
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue({ code: 'CODING' })
    await expect(resolveMainProgram('CODING', [])).resolves.toBe('CODING')
  })
  it('returns undefined when requested code is unknown', async () => {
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue(null)
    await expect(resolveMainProgram('XYZ', [])).resolves.toBeUndefined()
  })
  it('picks first program that is a main program', async () => {
    ;(prisma.mainProgram.findMany as jest.Mock).mockResolvedValue([{ code: 'SEMPOA' }])
    await expect(resolveMainProgram(undefined, ['AHE', 'SEMPOA'])).resolves.toBe('SEMPOA')
  })
  it('returns null without querying when nothing given', async () => {
    await expect(resolveMainProgram(undefined, [])).resolves.toBeNull()
    expect(prisma.mainProgram.findMany).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test, pastikan gagal**

Run: `rtk npx jest __tests__/lib/main-program.test.ts`
Expected: FAIL — "Cannot find module '@/lib/main-program'".

- [ ] **Step 3: Implementasi**

Append ke `lib/program-config.ts`:
```ts

/** true if code is also a value of the Prisma `Program` enum (storable in ClassProgram) */
export function isEnumProgram(code: string): code is ProgramKey {
  return (PROGRAMS as readonly string[]).includes(code)
}
```

Create `lib/main-program.ts`:
```ts
import { prisma } from '@/lib/db'

/** "Coding Kids" -> "CODING_KIDS" */
export function toMainProgramCode(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export function sessionTopic(c: { mainProgram: string | null; programs: { program: string }[] }): string {
  const label = c.programs.length > 0 ? c.programs.map(p => p.program).join(' + ') : (c.mainProgram ?? 'Kelas')
  return `Sesi Belajar ${label} - Rutin`
}

/**
 * requested set   -> its code if it exists in MainProgram, else undefined (invalid).
 * requested empty -> first of `programs` registered as MainProgram, else null.
 */
export async function resolveMainProgram(
  requested: string | null | undefined,
  programs: string[],
): Promise<string | null | undefined> {
  if (requested) {
    const found = await prisma.mainProgram.findUnique({ where: { code: requested }, select: { code: true } })
    return found ? found.code : undefined
  }
  if (programs.length === 0) return null
  const rows = await prisma.mainProgram.findMany({ where: { code: { in: programs } }, select: { code: true } })
  const codes = rows.map(r => r.code)
  return programs.find(p => codes.includes(p)) ?? null
}
```

- [ ] **Step 4: Run test, pastikan lulus**

Run: `rtk npx jest __tests__/lib/main-program.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 6: Commit**

```bash
rtk git add lib/program-config.ts lib/main-program.ts __tests__/lib/main-program.test.ts
rtk git commit -m "feat(classes): add main program helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: API master `/api/main-programs`

**Files:**
- Create: `app/api/main-programs/route.ts`
- Create: `app/api/main-programs/[code]/route.ts`
- Test: `__tests__/api/main-programs.test.ts`

Aturan akses: GET = SUPER_ADMIN + ADMIN (ADMIN butuh list untuk form kelas). POST/PUT/DELETE = SUPER_ADMIN saja. `code` tidak bisa diubah (primary key); `name`, `order`, `isActive` bisa. DELETE ditolak 409 kalau masih dipakai kelas — sarankan nonaktifkan.

- [ ] **Step 1: Tulis test gagal**

`__tests__/api/main-programs.test.ts`:
```ts
import { GET, POST } from '@/app/api/main-programs/route'
import { PUT, DELETE } from '@/app/api/main-programs/[code]/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

jest.mock('next-auth')
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    mainProgram: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    class: { count: jest.fn() },
  },
}))

const asRole = (role: string) => (getServerSession as jest.Mock).mockResolvedValue({ user: { role } })
const json = (url: string, method: string, body?: unknown) =>
  new Request(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }) as any
const params = (code: string) => ({ params: Promise.resolve({ code }) })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/main-programs', () => {
  it('returns list for ADMIN', async () => {
    asRole('ADMIN')
    ;(prisma.mainProgram.findMany as jest.Mock).mockResolvedValue([{ code: 'SEMPOA' }])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ code: 'SEMPOA' }])
  })
  it('returns 403 for TUTOR', async () => {
    asRole('TUTOR')
    expect((await GET()).status).toBe(403)
  })
})

describe('POST /api/main-programs', () => {
  it('returns 403 for ADMIN', async () => {
    asRole('ADMIN')
    const res = await POST(json('http://localhost/api/main-programs', 'POST', { name: 'Coding' }))
    expect(res.status).toBe(403)
  })
  it('creates with code derived from name', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mainProgram.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve(data))
    const res = await POST(json('http://localhost/api/main-programs', 'POST', { name: 'Coding Kids' }))
    expect(res.status).toBe(201)
    expect(prisma.mainProgram.create).toHaveBeenCalledWith({ data: { code: 'CODING_KIDS', name: 'Coding Kids', order: 0 } })
  })
  it('returns 409 when code already exists', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue({ code: 'SEMPOA' })
    const res = await POST(json('http://localhost/api/main-programs', 'POST', { name: 'sempoa' }))
    expect(res.status).toBe(409)
    expect(prisma.mainProgram.create).not.toHaveBeenCalled()
  })
  it('returns 400 when name has no alphanumerics', async () => {
    asRole('SUPER_ADMIN')
    const res = await POST(json('http://localhost/api/main-programs', 'POST', { name: '!!!' }))
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/main-programs/[code]', () => {
  it('updates name/isActive', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue({ code: 'CODING' })
    ;(prisma.mainProgram.update as jest.Mock).mockResolvedValue({ code: 'CODING', isActive: false })
    const res = await PUT(json('http://localhost/api/main-programs/CODING', 'PUT', { isActive: false }), params('CODING'))
    expect(res.status).toBe(200)
    expect(prisma.mainProgram.update).toHaveBeenCalledWith({ where: { code: 'CODING' }, data: { isActive: false } })
  })
  it('returns 404 for unknown code', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await PUT(json('http://localhost/api/main-programs/NOPE', 'PUT', { name: 'x' }), params('NOPE'))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/main-programs/[code]', () => {
  it('returns 409 when used by classes', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue({ code: 'SEMPOA' })
    ;(prisma.class.count as jest.Mock).mockResolvedValue(2)
    const res = await DELETE(json('http://localhost/api/main-programs/SEMPOA', 'DELETE'), params('SEMPOA'))
    expect(res.status).toBe(409)
    expect(prisma.mainProgram.delete).not.toHaveBeenCalled()
  })
  it('deletes when unused', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue({ code: 'CODING' })
    ;(prisma.class.count as jest.Mock).mockResolvedValue(0)
    const res = await DELETE(json('http://localhost/api/main-programs/CODING', 'DELETE'), params('CODING'))
    expect(res.status).toBe(200)
    expect(prisma.mainProgram.delete).toHaveBeenCalledWith({ where: { code: 'CODING' } })
  })
})
```

- [ ] **Step 2: Run test, pastikan gagal**

Run: `rtk npx jest __tests__/api/main-programs.test.ts`
Expected: FAIL — "Cannot find module '@/app/api/main-programs/route'".

- [ ] **Step 3: Implementasi list/create**

`app/api/main-programs/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { toMainProgramCode } from '@/lib/main-program'

const createSchema = z.object({
  name: z.string().trim().min(1).max(50),
  order: z.number().int().min(0).optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await prisma.mainProgram.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { classes: true } } },
  })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, order } = parsed.data
  const code = toMainProgramCode(name)
  if (!code) return NextResponse.json({ error: 'Nama program harus mengandung huruf/angka.' }, { status: 400 })

  const exists = await prisma.mainProgram.findUnique({ where: { code } })
  if (exists) return NextResponse.json({ error: `Program utama "${code}" sudah ada.` }, { status: 409 })

  const created = await prisma.mainProgram.create({ data: { code, name, order: order ?? 0 } })
  return NextResponse.json(created, { status: 201 })
}
```

- [ ] **Step 4: Implementasi update/delete**

`app/api/main-programs/[code]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const updateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const denied = await requireSuperAdmin()
  if (denied) return denied

  const { code } = await params
  const parsed = updateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existing = await prisma.mainProgram.findUnique({ where: { code } })
  if (!existing) return NextResponse.json({ error: 'Not Found' }, { status: 404 })

  const updated = await prisma.mainProgram.update({ where: { code }, data: parsed.data })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const denied = await requireSuperAdmin()
  if (denied) return denied

  const { code } = await params
  const existing = await prisma.mainProgram.findUnique({ where: { code } })
  if (!existing) return NextResponse.json({ error: 'Not Found' }, { status: 404 })

  const used = await prisma.class.count({ where: { mainProgram: code } })
  if (used > 0) {
    return NextResponse.json(
      { error: `Masih dipakai ${used} kelas. Nonaktifkan saja, atau pindahkan kelasnya dulu.` },
      { status: 409 },
    )
  }

  await prisma.mainProgram.delete({ where: { code } })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Run test, pastikan lulus**

Run: `rtk npx jest __tests__/api/main-programs.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 7: Commit**

```bash
rtk git add app/api/main-programs __tests__/api/main-programs.test.ts
rtk git commit -m "feat(api): main program master CRUD (super admin)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `/api/classes` terima program utama dari master

**Files:**
- Modify: `app/api/classes/route.ts` (schema line 24-33, POST line 75-92)
- Modify: `app/api/classes/[id]/route.ts` (schema line 21-30, PUT line 59-92)
- Test: `__tests__/api/classes-main-program.test.ts`

Perilaku baru:
- `mainProgram`: string bebas, divalidasi ada di tabel `MainProgram` (400 kalau tidak). `null` diterima = tidak dikirim (Timetable mengirim `null` saat copy kelas lama).
- `programs` (sub-program, enum): boleh kosong. POST tolak 400 kalau `mainProgram` dan `programs` dua-duanya kosong.
- POST tanpa `mainProgram`: fallback ke program pertama di `programs` yang terdaftar sebagai MainProgram (perilaku lama `programs[0]` bisa melanggar FK kalau isinya `AHE`).
- PUT: `mainProgram` hanya diubah kalau dikirim. Fallback lama `mainProgram = programs[0]` **dihapus** — itu menimpa program utama custom jadi NULL setiap kali kelas diedit dari Timetable (form Timetable tidak mengirim mainProgram).

- [ ] **Step 1: Tulis test gagal**

`__tests__/api/classes-main-program.test.ts`:
```ts
import { POST } from '@/app/api/classes/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

jest.mock('next-auth')
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    mainProgram: { findUnique: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const mockTx = {
  class: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
  classTutor: { createMany: jest.fn() },
}

const post = (body: unknown) =>
  POST(new Request('http://localhost/api/classes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any)

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } })
  ;(prisma.$transaction as jest.Mock).mockImplementation((fn: (tx: typeof mockTx) => unknown) => fn(mockTx))
  mockTx.class.create.mockResolvedValue({ id: 'c1' })
  mockTx.class.findUniqueOrThrow.mockResolvedValue({ id: 'c1' })
})

describe('POST /api/classes main program', () => {
  it('accepts custom main program with no sub-programs', async () => {
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue({ code: 'CODING' })
    const res = await post({ name: 'Coding A', mainProgram: 'CODING', programs: [], tutorId: 't1' })
    expect(res.status).toBe(201)
    expect(mockTx.class.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ mainProgram: 'CODING', programs: { create: [] } }),
    })
  })

  it('rejects unknown main program', async () => {
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await post({ name: 'X', mainProgram: 'NOPE', programs: [], tutorId: 't1' })
    expect(res.status).toBe(400)
    expect(mockTx.class.create).not.toHaveBeenCalled()
  })

  it('falls back to first sub-program registered as main program', async () => {
    ;(prisma.mainProgram.findMany as jest.Mock).mockResolvedValue([{ code: 'SEMPOA' }])
    const res = await post({ name: 'S', mainProgram: null, programs: ['AHE', 'SEMPOA'], tutorId: 't1' })
    expect(res.status).toBe(201)
    expect(mockTx.class.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ mainProgram: 'SEMPOA' }),
    })
  })

  it('rejects when neither main program nor programs given', async () => {
    const res = await post({ name: 'S', programs: [], tutorId: 't1' })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test, pastikan gagal**

Run: `rtk npx jest __tests__/api/classes-main-program.test.ts`
Expected: FAIL — test pertama dapat 400 (zod `nativeEnum(Program)` menolak `'CODING'`).

- [ ] **Step 3: Ubah `app/api/classes/route.ts`**

Tambah import:
```ts
import { resolveMainProgram } from '@/lib/main-program'
```
Ganti dua baris di `createClassSchema`:
```ts
  mainProgram: z.string().min(1).nullish(),
  programs: z.array(z.nativeEnum(Program)).default([]),
```
Di `POST`, ganti:
```ts
  const { programs, additionalTutorIds, ...classData } = parsed.data
  const mainProgram = classData.mainProgram || programs[0]
```
dengan:
```ts
  const { programs, additionalTutorIds, mainProgram: requestedMain, ...classData } = parsed.data
  const mainProgram = await resolveMainProgram(requestedMain, programs)
  if (mainProgram === undefined) {
    return NextResponse.json({ error: 'Program utama tidak ditemukan.' }, { status: 400 })
  }
  if (!mainProgram && programs.length === 0) {
    return NextResponse.json({ error: 'Pilih program utama atau minimal satu program.' }, { status: 400 })
  }
```
(Blok `tx.class.create({ data: { ...classData, mainProgram, programs: { create: ... } } })` tidak berubah.)

- [ ] **Step 4: Ubah `app/api/classes/[id]/route.ts`**

Tambah import:
```ts
import { resolveMainProgram } from '@/lib/main-program'
```
Ganti dua baris di `updateClassSchema`:
```ts
  mainProgram: z.string().min(1).nullish(),
  programs: z.array(z.nativeEnum(Program)).optional(),
```
Di `PUT`, ganti:
```ts
  const { programs, additionalTutorIds, ...classData } = parsed.data
```
dengan:
```ts
  const { programs, additionalTutorIds, mainProgram: requestedMain, ...classData } = parsed.data
  let mainProgram: string | undefined
  if (requestedMain) {
    const resolved = await resolveMainProgram(requestedMain, [])
    if (!resolved) return NextResponse.json({ error: 'Program utama tidak ditemukan.' }, { status: 400 })
    mainProgram = resolved
  }
```
Dan ganti blok:
```ts
    const updateData: typeof classData & { mainProgram?: Program } = { ...classData }
    if (programs && !updateData.mainProgram) {
      updateData.mainProgram = programs[0]
    }

    return tx.class.update({
      where: { id },
      data: updateData,
```
dengan:
```ts
    return tx.class.update({
      where: { id },
      data: { ...classData, ...(mainProgram ? { mainProgram } : {}) },
```
Kalau `Program` tidak lagi dipakai selain di `z.nativeEnum(Program)`, import tetap (masih dipakai di schema).

- [ ] **Step 5: Run test, pastikan lulus**

Run: `rtk npx jest __tests__/api/classes-main-program.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat). Sebut eksplisit bahwa fallback PUT `mainProgram = programs[0]` dihapus.

- [ ] **Step 7: Commit**

```bash
rtk git add app/api/classes __tests__/api/classes-main-program.test.ts
rtk git commit -m "feat(api): validate class main program against master table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Topic sesi timetable untuk kelas tanpa sub-program

**Files:**
- Modify: `app/api/admin/timetable/generate/route.ts:142`
- Modify: `app/api/cron/timetable-generate/route.ts:133`

Tanpa ini, kelas program custom (0 sub-program) menghasilkan topic `"Sesi Belajar  - Rutin"`. Logika sudah dites di Task 2 (`sessionTopic`).

- [ ] **Step 1: Ganti topic di kedua file**

Tambah import di kedua file:
```ts
import { sessionTopic } from '@/lib/main-program'
```
Ganti baris:
```ts
          topic: `Sesi Belajar ${c.programs.map((p: { program: string }) => p.program).join(' + ')} - Rutin`,
```
dengan:
```ts
          topic: sessionTopic(c),
```
(`c` sudah membawa scalar `mainProgram` dan `programs` dari `include`.)

- [ ] **Step 2: Jalankan test timetable existing**

Run: `rtk npx jest __tests__/api/admin __tests__/api/cron`
Expected: PASS semua. Kalau ada test yang assert string topic lama, nilai untuk kelas dengan sub-program tidak berubah, jadi harus tetap lulus.

- [ ] **Step 3: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 4: Commit**

```bash
rtk git add app/api/admin/timetable/generate/route.ts app/api/cron/timetable-generate/route.ts
rtk git commit -m "fix(timetable): session topic falls back to main program

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Halaman master "Program Utama" + sidebar

**Files:**
- Create: `app/(dashboard)/admin/main-programs/page.tsx`
- Create: `app/(dashboard)/admin/main-programs/MainProgramsClient.tsx`
- Modify: `components/dashboard/sidebar.tsx` (blok `SUPER_ADMIN` → `Schedule.subItems`, ~line 88-92)

Middleware mengizinkan ADMIN ke `/admin/*`, jadi guard SUPER_ADMIN wajib di page (pola sama dengan `app/(dashboard)/admin/settings/page.tsx`). API sudah menolak ADMIN (Task 3).

- [ ] **Step 1: Server page**

`app/(dashboard)/admin/main-programs/page.tsx`:
```tsx
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import MainProgramsClient from './MainProgramsClient'

export default async function MainProgramsPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/admin')

  const rows = await prisma.mainProgram.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { classes: true } } },
  })

  return <MainProgramsClient initial={JSON.parse(JSON.stringify(rows))} />
}
```

- [ ] **Step 2: Client component**

`app/(dashboard)/admin/main-programs/MainProgramsClient.tsx`:
```tsx
'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Pencil, Check, X, ArrowLeft } from 'lucide-react'
import { useConfirm } from '@/lib/hooks/use-confirm'

interface MainProgramRow {
  code: string
  name: string
  order: number
  isActive: boolean
  _count: { classes: number }
}

export default function MainProgramsClient({ initial }: { initial: MainProgramRow[] }) {
  const confirm = useConfirm()
  const [rows, setRows] = useState<MainProgramRow[]>(initial)
  const [name, setName] = useState('')
  const [order, setOrder] = useState(initial.length + 1)
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editOrder, setEditOrder] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const res = await fetch('/api/main-programs')
    if (res.ok) setRows(await res.json())
  }, [])

  const call = async (url: string, init: RequestInit): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === 'string' ? body.error : 'Gagal menyimpan.')
      }
      await reload()
      return true
    } catch (err: any) {
      setError(err.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await call('/api/main-programs', { method: 'POST', body: JSON.stringify({ name, order }) })
    if (ok) {
      setName('')
      setOrder(o => o + 1)
    }
  }

  const startEdit = (row: MainProgramRow) => {
    setEditing(row.code)
    setEditName(row.name)
    setEditOrder(row.order)
  }

  const handleSaveEdit = async (code: string) => {
    const ok = await call(`/api/main-programs/${code}`, {
      method: 'PUT',
      body: JSON.stringify({ name: editName, order: editOrder }),
    })
    if (ok) setEditing(null)
  }

  const handleToggle = (row: MainProgramRow) =>
    call(`/api/main-programs/${row.code}`, { method: 'PUT', body: JSON.stringify({ isActive: !row.isActive }) })

  const handleDelete = async (row: MainProgramRow) => {
    const ok = await confirm({
      title: 'Hapus Program Utama',
      message: `Hapus program utama "${row.name}"?`,
      variant: 'danger',
      confirmLabel: 'Hapus',
    })
    if (ok) await call(`/api/main-programs/${row.code}`, { method: 'DELETE' })
  }

  const input = 'px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500'

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/classes" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Kelas
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-800 mt-2">Master Program Utama</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Program utama = jenis kelas (mis. Sempoa, Calistung, English). Program nonaktif tidak muncul di form kelas baru.
        </p>
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">⚠️ {error}</div>}

      <form onSubmit={handleCreate} className="rounded-2xl bg-white border border-slate-100 p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Program *</label>
          <input required maxLength={50} value={name} onChange={e => setName(e.target.value)} className={`w-full ${input}`} placeholder="mis. Coding Kids" />
        </div>
        <div className="sm:w-28">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Urutan</label>
          <input type="number" min={0} value={order} onChange={e => setOrder(Number(e.target.value))} className={`w-full ${input}`} />
        </div>
        <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
          <Plus className="h-4 w-4" /> Tambah
        </button>
      </form>

      <div className="rounded-2xl bg-white border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="text-left px-4 py-3">Kode</th>
              <th className="text-left px-4 py-3">Nama</th>
              <th className="text-left px-4 py-3">Urutan</th>
              <th className="text-left px-4 py-3">Kelas</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.code} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.code}</td>
                <td className="px-4 py-3">
                  {editing === row.code
                    ? <input value={editName} maxLength={50} onChange={e => setEditName(e.target.value)} className={input} />
                    : <span className="font-semibold text-slate-800">{row.name}</span>}
                </td>
                <td className="px-4 py-3">
                  {editing === row.code
                    ? <input type="number" min={0} value={editOrder} onChange={e => setEditOrder(Number(e.target.value))} className={`w-20 ${input}`} />
                    : row.order}
                </td>
                <td className="px-4 py-3">{row._count.classes}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleToggle(row)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-full cursor-pointer ${row.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {row.isActive ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {editing === row.code ? (
                      <>
                        <button aria-label="Simpan" disabled={saving} onClick={() => handleSaveEdit(row.code)} className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 cursor-pointer"><Check className="h-4 w-4" /></button>
                        <button aria-label="Batal" onClick={() => setEditing(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 cursor-pointer"><X className="h-4 w-4" /></button>
                      </>
                    ) : (
                      <>
                        <button aria-label="Edit" onClick={() => startEdit(row)} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"><Pencil className="h-4 w-4" /></button>
                        <button aria-label="Hapus" disabled={saving} onClick={() => handleDelete(row)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Sidebar SUPER_ADMIN**

Di `components/dashboard/sidebar.tsx`, blok `case 'SUPER_ADMIN'` → item `Schedule` → `subItems`, tambah setelah baris `Kelas` (BookMarked sudah di-import):
```tsx
              { name: 'Program Utama', href: '/admin/main-programs', icon: BookMarked },
```
Blok `case 'ADMIN'` **jangan** diubah.

- [ ] **Step 4: Type check**

Run: `rtk tsc --noEmit`
Expected: tidak ada error baru di `main-programs/*` atau `sidebar.tsx` (error lain di ClassesClient/TimetableClient boleh muncul — diberesin Task 7-8).

- [ ] **Step 5: Smoke manual**

Run `rtk npm run dev`, login SUPER_ADMIN, buka `/admin/main-programs`:
- tabel menampilkan SEMPOA/CALISTUNG/ENGLISH dengan jumlah kelas.
- tambah "Coding Kids" → baris `CODING_KIDS` muncul.
- tambah "coding kids" lagi → pesan error "sudah ada".
- hapus SEMPOA (dipakai kelas) → pesan "Masih dipakai N kelas".
- login ADMIN, buka `/admin/main-programs` → redirect ke `/admin`; menu "Program Utama" tidak tampil.

- [ ] **Step 6: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 7: Commit**

```bash
rtk git add "app/(dashboard)/admin/main-programs" components/dashboard/sidebar.tsx
rtk git commit -m "feat(admin): main program master page for super admin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Menu Kelas pakai master program utama

**Files:**
- Modify: `app/(dashboard)/admin/classes/page.tsx`
- Modify: `app/(dashboard)/admin/classes/ClassesClient.tsx` (line 7-11, 26-28, 76, 144-150, 150, 186-221, 309-316, 330-345, 382-400, 440-460, 512-530)

- [ ] **Step 1: page.tsx — kirim master + flag role**

Tambah import:
```ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
```
Ubah awal fungsi:
```ts
export default async function AdminClassesPage() {
  const session = await getServerSession(authOptions)
  const [rawClasses, tutors, students, mainPrograms] = await Promise.all([
```
Tambah elemen ke-4 di `Promise.all` (setelah query `prisma.student.findMany(...)`):
```ts
    prisma.mainProgram.findMany({
      select: { code: true, name: true, isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    }),
```
Tambah props di `<ClassesClient ... />`:
```tsx
      mainPrograms={mainPrograms}
      canManageMainPrograms={(session?.user as any)?.role === 'SUPER_ADMIN'}
```

- [ ] **Step 2: ClassesClient — konstanta & tipe**

Ubah import baris 3-5:
```tsx
import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Users, Pencil, Info, Trash2, Settings2 } from 'lucide-react'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { isEnumProgram } from '@/lib/program-config'
```
Hapus baris `const MAIN_PROGRAMS: ProgramValue[] = ['SEMPOA', 'CALISTUNG', 'ENGLISH']`.

Setelah objek `PROGRAM_COLORS`, tambah:
```tsx
const mainColor = (code: string) =>
  PROGRAM_COLORS[code as ProgramValue] ?? 'bg-slate-100 text-slate-700 border border-slate-200'

interface MainProgramOption { code: string; name: string; isActive: boolean }
```
Di `interface Class`, ganti `mainProgram: ProgramValue | null` → `mainProgram: string | null`.

Ganti `makeEmptyForm`:
```tsx
const makeEmptyForm = () => ({ name: '', mainProgram: '', programs: [] as ProgramValue[], description: '', tutorId: '' })
```
Di `interface ClassesClientProps` tambah:
```tsx
  mainPrograms: MainProgramOption[]
  canManageMainPrograms: boolean
```
Signature komponen:
```tsx
export default function ClassesClient({ initialClasses, initialTutors, initialStudents, mainPrograms, canManageMainPrograms }: ClassesClientProps) {
```
Tepat setelah `const confirm = useConfirm()`:
```tsx
  const activeMainPrograms = mainPrograms.filter(m => m.isActive)
  const knownMain = new Set(mainPrograms.map(m => m.code))
```

- [ ] **Step 3: Submit handlers — hanya kode enum masuk `programs`**

Di `handleSubmit` ganti blok `const allPrograms = ...` (3 baris) dengan:
```tsx
      const allPrograms = [
        ...(isEnumProgram(form.mainProgram) ? [form.mainProgram] : []),
        ...form.programs.filter(p => p !== form.mainProgram),
      ]
```
Di `handleEditSubmit` ganti blok `const allPrograms = ...` (3 baris) dengan:
```tsx
      const allPrograms = [
        ...(isEnumProgram(editForm.mainProgram) ? [editForm.mainProgram] : []),
        ...editForm.programs.filter(p => p !== editForm.mainProgram),
      ]
```
Di `handleSubmit`, ganti `if (!res.ok) throw new Error('Gagal menyimpan kelas.')` dengan (supaya pesan 400 dari API kebaca):
```tsx
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === 'string' ? body.error : 'Gagal menyimpan kelas.')
      }
```

- [ ] **Step 4: Header — tombol kelola (SUPER_ADMIN)**

Bungkus tombol "Buat Kelas Baru" di header jadi:
```tsx
        <div className="flex gap-2">
          {canManageMainPrograms && (
            <Link
              href="/admin/main-programs"
              className="flex items-center gap-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <Settings2 className="h-4 w-4" /> Kelola Program Utama
            </Link>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Buat Kelas Baru
          </button>
        </div>
```

- [ ] **Step 5: Info box dinamis**

Ganti `<strong>Program Utama</strong> adalah jenis kelas (SEMPOA, CALISTUNG, ENGLISH).` dengan:
```tsx
          <strong>Program Utama</strong> adalah jenis kelas ({activeMainPrograms.map(m => m.name).join(', ')}).
```

- [ ] **Step 6: Picker form tambah**

Ganti blok `{MAIN_PROGRAMS.map(p => ( ... ))}` di form tambah dengan:
```tsx
                {activeMainPrograms.map(m => (
                  <button
                    key={m.code}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, mainProgram: m.code, programs: [] }))}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
                      form.mainProgram === m.code
                        ? `${mainColor(m.code)} shadow-sm`
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
```

- [ ] **Step 7: Picker form edit (tetap tampilkan program nonaktif yang sedang dipakai)**

Ganti blok `{MAIN_PROGRAMS.map(p => ( ... ))}` di form edit dengan:
```tsx
                  {mainPrograms.filter(m => m.isActive || m.code === editForm.mainProgram).map(m => (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, mainProgram: m.code, programs: [] }))}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
                        editForm.mainProgram === m.code
                          ? `${mainColor(m.code)} shadow-sm`
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
```

- [ ] **Step 8: Grouping list kelas**

Ganti blok `{MAIN_PROGRAMS.map(prog => { const group = ... })}` dengan:
```tsx
          {mainPrograms.map(m => {
            const group = classes.filter(c => c.mainProgram === m.code)
            if (group.length === 0) return null
            return (
              <div key={m.code}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${mainColor(m.code)}`}>{m.name}</span>
                  <span className="text-xs text-slate-400">{group.length} kelas</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {group.map((cls) => (
                    <ClassCard key={cls.id} cls={cls} onEdit={handleEditOpen} onEnroll={setEnrollClass} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )
          })}
```
Dan baris `ungrouped`:
```tsx
            const ungrouped = classes.filter(c => !c.mainProgram || !knownMain.has(c.mainProgram))
```

- [ ] **Step 9: Type check + lint file**

Run: `rtk tsc --noEmit`
Expected: tidak ada error di `admin/classes/*`. Sisa referensi `MAIN_PROGRAMS` → error "Cannot find name" — cari & ganti sesuai Step 6-8.

- [ ] **Step 10: Smoke manual**

`rtk npm run dev`, login SUPER_ADMIN, `/admin/classes`:
- tombol "Kelola Program Utama" tampil; login ADMIN → tidak tampil.
- Buat kelas dengan program utama "Coding Kids" tanpa sub-program → tersimpan, muncul di grup "Coding Kids".
- Buat kelas SEMPOA + AHE → tetap seperti sebelumnya (badge SEMPOA, AHE).
- Edit kelas Coding Kids → nama berubah, program utama tetap.
- Nonaktifkan Coding Kids di master → hilang dari picker "Tambah", masih ada di picker "Edit" kelas Coding Kids, grup list masih tampil.

- [ ] **Step 11: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 12: Commit**

```bash
rtk git add "app/(dashboard)/admin/classes"
rtk git commit -m "feat(classes): main program picker from master data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Timetable grouping pakai master

**Files:**
- Modify: `app/(dashboard)/admin/timetable/page.tsx` (Promise.all line 16-49, JSX line 70-75)
- Modify: `app/(dashboard)/admin/timetable/TimetableClient.tsx` (line 27, 50, 74-79, 81, 253-270)

- [ ] **Step 1: page.tsx**

Ubah destructuring:
```ts
  const [classesData, tutorsData, studentsData, piketData, mainPrograms] = await Promise.all([
```
Tambah elemen terakhir di `Promise.all` (setelah `prisma.dailyPiket.findMany()`):
```ts
    prisma.mainProgram.findMany({
      select: { code: true, name: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    }),
```
Tambah prop di `<TimetableClient ... />`:
```tsx
      mainPrograms={mainPrograms}
```

- [ ] **Step 2: TimetableClient**

Hapus baris `const MAIN_PROGRAMS_ORDER = ['SEMPOA', 'CALISTUNG', 'ENGLISH'] as const`.

Di `interface ClassModel`: `mainProgram: ProgramValue | null` → `mainProgram: string | null`.

Di `interface Props` tambah:
```ts
  mainPrograms: { code: string; name: string }[]
```
Signature:
```tsx
export default function TimetableClient({ initialClasses, initialTutors, initialStudents, initialPiketList, mainPrograms }: Props) {
```
Di `filteredGroupedClasses`, ganti:
```ts
    const grouped: Record<string, ClassModel[]> = {}
    for (const prog of MAIN_PROGRAMS_ORDER) {
      grouped[prog] = filtered.filter(c => c.mainProgram === prog)
    }
    const other = filtered.filter(
      c => !c.mainProgram || !MAIN_PROGRAMS_ORDER.includes(c.mainProgram as typeof MAIN_PROGRAMS_ORDER[number])
    )
    if (other.length > 0) grouped['LAINNYA'] = other
    return grouped
  }, [classes, classSearch])
```
dengan (key = nama, jadi label `<optgroup>` otomatis pakai nama):
```ts
    const grouped: Record<string, ClassModel[]> = {}
    for (const m of mainPrograms) {
      grouped[m.name] = filtered.filter(c => c.mainProgram === m.code)
    }
    const known = new Set(mainPrograms.map(m => m.code))
    const other = filtered.filter(c => !c.mainProgram || !known.has(c.mainProgram))
    if (other.length > 0) grouped['LAINNYA'] = other
    return grouped
  }, [classes, classSearch, mainPrograms])
```

- [ ] **Step 3: Type check**

Run: `rtk tsc --noEmit`
Expected: 0 error. (Kalau ada error di `scripts/backfill-main-program.ts` → bukan blocker: script sekali-jalan; jangan dijalankan lagi karena `programs[0]` bisa `AHE` dan melanggar FK. Laporkan saja.)

- [ ] **Step 4: Smoke manual**

`/admin/timetable` → klik slot kosong → dropdown "Pilih Kelas" ber-grup `── Sempoa (n) ──`, `── Coding Kids (n) ──`, dst. Pilih kelas Coding Kids → simpan → kelas terjadwal. Klik "Generate" sesi → topic sesi Coding Kids = `Sesi Belajar CODING_KIDS - Rutin`.

- [ ] **Step 5: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 6: Commit**

```bash
rtk git add "app/(dashboard)/admin/timetable"
rtk git commit -m "feat(timetable): group classes by main program master

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verifikasi akhir

- [ ] **Step 1: Full test suite**

Run: `rtk npx jest`
Expected: semua PASS (termasuk 24 test baru dari Task 2-4).

- [ ] **Step 2: Type check + lint**

Run: `rtk tsc --noEmit` lalu `rtk lint`
Expected: 0 error baru dibanding `main` (bandingkan dengan `tsc-output.txt` / `lint-output.txt` lama kalau ada error pre-existing).

- [ ] **Step 3: Build**

Run: `rtk next build`
Expected: build sukses, route `/admin/main-programs` dan `/api/main-programs` terdaftar.

- [ ] **Step 4: Catatan deploy**

Production wajib `npx prisma migrate deploy` sebelum app baru jalan (kolom `Class.mainProgram` berubah tipe). Jalankan Step 1 Task 1 (query cek data) di production dulu dan simpan hasilnya.

- [ ] **Step 5: Report ke user**

Lapor: ringkasan semua file yang dibuat/diubah lintas task, hasil test/tsc/lint/build (angka pass/fail aktual), dan jumlah kelas yang mainProgram-nya di-NULL-kan oleh migrasi.
