# Restricted ADMIN Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new, restricted `ADMIN` role that can manage users/schedule/billing/curriculum and fill in per-student learning reports, but cannot see financial reports, revenue figures, analytics, tutor monitoring, announcements, or settings — all of which stay exclusive to `SUPER_ADMIN` (the renamed-in-spirit "superadmin", already the correct enum value in the DB).

**Architecture:** `SUPER_ADMIN` already is the full-power admin role in this codebase (`prisma/schema.prisma`) — there is no literal `"admin"` role to rename. We add a new `ADMIN` value to the existing `Role` enum, widen the specific API route checks and sidebar/page guards that must be shared with `SUPER_ADMIN`, and add explicit deny-guards to the handful of `/admin/*` pages that currently have **no** page-level role check at all (they only rely on `middleware.ts` blocking anyone who isn't `SUPER_ADMIN` — once we open `/admin/*` to `ADMIN` too, those pages would otherwise become reachable). `ADMIN` reuses the exact same `/admin/*` routes as `SUPER_ADMIN` — there is no separate `/staff` URL prefix.

**Tech Stack:** Next.js App Router, NextAuth (JWT session, role on token), Prisma + PostgreSQL, Jest.

**Key decisions locked in during scoping (see chat for rationale):**
- Admin's Dashboard is a single plain "Dashboard" link (no Analitik / Monitoring Tutor submenu).
- Pengumuman and Pengaturan are hidden for ADMIN (not in the requested menu list).
- User / Schedule / Kurikulum are full CRUD for ADMIN, same as SUPER_ADMIN.
- Billing shows Tagihan + Paket Harga for ADMIN, but hides "Laporan Keuangan".
- Dashboard hides the "Pendapatan Bulan Ini" stat card and the revenue-by-month chart for ADMIN; other billing-status widgets (invoice status pie, tagihan-needing-attention list) stay, since those are operational billing/invoice-recording data, not an income report.
- "Isi laporan per siswa" for ADMIN reuses the exact same input form tutors use, extracted into a shared component, reached via a new "Isi Laporan" button on the admin Jadwal (schedules) table — mirroring how a tutor reaches their own report form from their dashboard's today's-schedule list.

---

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | Add `ADMIN` to the `Role` enum |
| `prisma/seed.ts` | Add one ADMIN fixture user for local testing |
| `middleware.ts` | Let `ADMIN` through the `/admin/*` path gate |
| `app/page.tsx` | Root post-login redirect: send `ADMIN` to `/admin` |
| `app/(dashboard)/layout.tsx` | Role type union used to type the `Sidebar` prop |
| `components/dashboard/sidebar.tsx` | `ADMIN` menu tree, badge color, label |
| `app/(dashboard)/admin/analytics/page.tsx`, `settings/page.tsx`, `announcements/page.tsx`, `financial-report/page.tsx` | New explicit deny-guards for `ADMIN` (currently unguarded, rely only on middleware) |
| `app/(dashboard)/admin/milestones/page.tsx`, `milestones/progress/page.tsx`, `milestones/reports/page.tsx` | Widen existing `SUPER_ADMIN`-only guard to include `ADMIN` |
| ~40 files under `app/api/**` | Widen the specific `role !== 'SUPER_ADMIN'` checks that belong to User/Schedule/Billing/Kurikulum/Laporan domains |
| `app/(dashboard)/admin/page.tsx`, `DashboardClient.tsx` | Hide income figures for `ADMIN` |
| `components/reports/ReportInputClient.tsx` (new) | Shared per-student report input form, extracted from the tutor page |
| `app/(dashboard)/tutor/reports/[scheduleId]/page.tsx` | Becomes a thin wrapper around the shared component |
| `app/(dashboard)/admin/reports/[scheduleId]/page.tsx` (new) | Admin's report input page, same shared component |
| `app/(dashboard)/admin/schedules/SchedulesClient.tsx` | Add "Isi Laporan" entry-point link per schedule row |
| `__tests__/api/tutors.test.ts` (new) | Regression test: ADMIN is now allowed into an "opened" endpoint |
| `__tests__/api/admin/financial-report-summary.test.ts` (new) | Regression test: ADMIN stays forbidden from the financial report |

---

## Task 1: Add ADMIN to the Role enum

**Files:**
- Modify: `prisma/schema.prisma:350-354`

- [ ] **Step 1: Edit the `Role` enum**

In `prisma/schema.prisma`, change:

```prisma
enum Role {
  SUPER_ADMIN
  TUTOR
  PARENT
}
```

to:

```prisma
enum Role {
  SUPER_ADMIN
  ADMIN
  TUTOR
  PARENT
}
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npm run db:migrate -- --name add_admin_role`

Expected: Prisma creates `prisma/migrations/<timestamp>_add_admin_role/migration.sql` containing `ALTER TYPE "Role" ADD VALUE 'ADMIN';`, applies it to the dev database, and regenerates the Prisma client. Confirm the new migration folder exists:

Run: `ls prisma/migrations | tail -3`
Expected: the new `..._add_admin_role` folder is the most recent entry.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add ADMIN role to the Role enum"
```

---

## Task 2: Seed an ADMIN fixture account

**Files:**
- Modify: `prisma/seed.ts:28-38`

- [ ] **Step 1: Add an ADMIN user after the Super Admin block**

In `prisma/seed.ts`, right after the existing "1. Create Super Admin" block (ends at line 38), insert:

```ts
  // 1b. Create Admin (restricted staff role)
  const staffAdminPassword = await hash('staffadmin123')
  await prisma.user.create({
    data: {
      name: 'Admin Keuangan',
      email: 'staff@mellyna.id',
      password: staffAdminPassword,
      role: Role.ADMIN,
      phone: '6281234567899',
    },
  })
```

- [ ] **Step 2: Reseed and verify**

Run: `npm run db:seed`
Expected: seed log completes without errors; a user with email `staff@mellyna.id` and role `ADMIN` now exists.

Run: `npm run db:seed && node -e "const {PrismaClient}=require('@prisma/client');new PrismaClient().user.findUnique({where:{email:'staff@mellyna.id'}}).then(u=>{console.log(u.role); process.exit(0)})"`
Expected: prints `ADMIN`.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed an ADMIN fixture account for local testing"
```

---

## Task 3: Let ADMIN through the route middleware

**Files:**
- Modify: `middleware.ts:13-14`

- [ ] **Step 1: Widen the `/admin` path check**

In `middleware.ts`, change:

```ts
    if (pathname.startsWith('/admin') && role !== 'SUPER_ADMIN')
      return NextResponse.redirect(new URL('/login', req.url))
```

to:

```ts
    if (pathname.startsWith('/admin') && role !== 'SUPER_ADMIN' && role !== 'ADMIN')
      return NextResponse.redirect(new URL('/login', req.url))
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: allow ADMIN role through the /admin route gate"
```

---

## Task 4: Root redirect and dashboard layout type

**Files:**
- Modify: `app/page.tsx:11-14`
- Modify: `app/(dashboard)/layout.tsx:24`

- [ ] **Step 1: Add an explicit ADMIN branch to the root redirect**

In `app/page.tsx`, change:

```ts
  const role = (session.user as any).role
  if (role === 'SUPER_ADMIN') redirect('/admin')
  if (role === 'TUTOR') redirect('/tutor')
  redirect('/parent')
```

to:

```ts
  const role = (session.user as any).role
  if (role === 'SUPER_ADMIN') redirect('/admin')
  if (role === 'ADMIN') redirect('/admin')
  if (role === 'TUTOR') redirect('/tutor')
  redirect('/parent')
```

- [ ] **Step 2: Widen the layout's role type union**

In `app/(dashboard)/layout.tsx`, change:

```ts
    role: (session.user as any).role as 'SUPER_ADMIN' | 'TUTOR' | 'PARENT',
```

to:

```ts
    role: (session.user as any).role as 'SUPER_ADMIN' | 'ADMIN' | 'TUTOR' | 'PARENT',
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx "app/(dashboard)/layout.tsx"
git commit -m "feat: route ADMIN role to the admin dashboard"
```

---

## Task 5: Sidebar menu, badge, and label for ADMIN

**Files:**
- Modify: `components/dashboard/sidebar.tsx:39` (prop type)
- Modify: `components/dashboard/sidebar.tsx:62-135` (`getNavLinks`)
- Modify: `components/dashboard/sidebar.tsx:146-157` (`getRoleBadge`)
- Modify: `components/dashboard/sidebar.tsx:159-170` (`getRoleLabel`)

- [ ] **Step 1: Widen the `SidebarProps` role type**

Change:

```ts
    role: 'SUPER_ADMIN' | 'TUTOR' | 'PARENT'
```

to:

```ts
    role: 'SUPER_ADMIN' | 'ADMIN' | 'TUTOR' | 'PARENT'
```

- [ ] **Step 2: Add the ADMIN menu case**

In `getNavLinks()`, insert a new `case 'ADMIN':` between the closing `]` of the `SUPER_ADMIN` case (line 115) and `case 'TUTOR':` (line 116):

```ts
      case 'ADMIN':
        return [
          { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
          {
            name: 'User',
            icon: Users,
            subItems: [
              { name: 'Siswa', href: '/admin/students', icon: GraduationCap },
              { name: 'Tutor', href: '/admin/tutors', icon: Users },
              { name: 'Wali Murid / Parent', href: '/admin/parents', icon: UsersRound },
            ],
          },
          {
            name: 'Schedule',
            icon: Calendar,
            subItems: [
              { name: 'Kelas', href: '/admin/classes', icon: BookOpen },
              { name: 'Jadwal', href: '/admin/schedules', icon: Calendar },
              { name: 'Timetable', href: '/admin/timetable', icon: Grid3x3 },
            ],
          },
          {
            name: 'Billing',
            icon: CreditCard,
            subItems: [
              { name: 'Tagihan', href: '/admin/billing', icon: CreditCard },
              { name: 'Paket Harga', href: '/admin/pricing', icon: Tag },
            ],
          },
          { name: 'Laporan', href: '/admin/reports', icon: FileText },
          {
            name: 'Kurikulum',
            icon: Trophy,
            subItems: [
              { name: 'Master Program', href: '/admin/programs', icon: BookOpen },
              { name: 'Milestone', href: '/admin/milestones', icon: BookMarked },
              { name: 'Progress Siswa', href: '/admin/milestones/progress', icon: TrendingUp },
              { name: 'Raport', href: '/admin/milestones/reports', icon: Scroll },
            ],
          },
        ]
```

- [ ] **Step 3: Add the ADMIN badge color**

In `getRoleBadge()`, insert before the `default:` line:

```ts
      case 'ADMIN':
        return 'bg-gradient-to-r from-sky-500 to-blue-500 text-white'
```

- [ ] **Step 4: Add the ADMIN label**

In `getRoleLabel()`, insert before the `default:` line:

```ts
      case 'ADMIN':
        return 'Admin'
```

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev`, log in as `staff@mellyna.id` / `staffadmin123` (seeded in Task 2).
Expected: sidebar shows exactly Dashboard, User, Schedule, Billing (Tagihan + Paket Harga only — no Laporan Keuangan), Laporan, Kurikulum. Role badge reads "Admin".

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/sidebar.tsx
git commit -m "feat: add ADMIN sidebar menu, badge, and label"
```

---

## Task 6: Deny-guard the pages ADMIN must not reach

These four pages currently have **no** role check at all — they are reachable purely because `middleware.ts` used to block everyone except `SUPER_ADMIN` from `/admin/*`. After Task 3, `ADMIN` can reach `/admin/*`, so each of these needs its own guard now, matching the existing pattern already used at `app/(dashboard)/admin/tutor-monitoring/page.tsx:10`.

**Files:**
- Modify: `app/(dashboard)/admin/analytics/page.tsx`
- Modify: `app/(dashboard)/admin/settings/page.tsx`
- Modify: `app/(dashboard)/admin/announcements/page.tsx`
- Modify: `app/(dashboard)/admin/financial-report/page.tsx`

- [ ] **Step 1: Guard `app/(dashboard)/admin/analytics/page.tsx`**

Change:

```ts
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'
import AnalyticsClient from './AnalyticsClient'

export default async function AdminAnalyticsPage() {
  const [attendanceStudents, tutorUsers, studentProgress] = await Promise.all([
```

to:

```ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'
import AnalyticsClient from './AnalyticsClient'

export default async function AdminAnalyticsPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/admin')

  const [attendanceStudents, tutorUsers, studentProgress] = await Promise.all([
```

- [ ] **Step 2: Guard `app/(dashboard)/admin/settings/page.tsx`**

Change:

```ts
import { getSessionStatus } from '@/lib/waha'
import { prisma } from '@/lib/db'
import SettingsClient from './SettingsClient'

export default async function AdminSettingsPage() {
  const wahaStatus = await getSessionStatus()
```

to:

```ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSessionStatus } from '@/lib/waha'
import { prisma } from '@/lib/db'
import SettingsClient from './SettingsClient'

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/admin')

  const wahaStatus = await getSessionStatus()
```

- [ ] **Step 3: Guard `app/(dashboard)/admin/announcements/page.tsx`**

Change:

```ts
import { prisma } from '@/lib/db'
import AnnouncementsClient from './AnnouncementsClient'

export default async function AdminAnnouncementsPage() {
  const rawAnnouncements = await prisma.announcement.findMany({
```

to:

```ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import AnnouncementsClient from './AnnouncementsClient'

export default async function AdminAnnouncementsPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/admin')

  const rawAnnouncements = await prisma.announcement.findMany({
```

- [ ] **Step 4: Guard `app/(dashboard)/admin/financial-report/page.tsx`**

`app/(dashboard)/admin/financial-report/page.tsx` currently starts:

```ts
import { prisma } from '@/lib/db'
import FinancialReportClient from './FinancialReportClient'

export default async function FinancialReportPage() {
  const now = new Date()
```

Change to:

```ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import FinancialReportClient from './FinancialReportClient'

export default async function FinancialReportPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/admin')

  const now = new Date()
```

- [ ] **Step 5: Verify by browser as ADMIN**

Logged in as `staff@mellyna.id`, navigate directly to `/admin/analytics`, `/admin/settings`, `/admin/announcements`, `/admin/financial-report`.
Expected: each redirects back to `/admin` instead of rendering.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/admin/analytics/page.tsx" "app/(dashboard)/admin/settings/page.tsx" "app/(dashboard)/admin/announcements/page.tsx" "app/(dashboard)/admin/financial-report/page.tsx"
git commit -m "feat: block ADMIN role from analytics, settings, announcements, and financial-report pages"
```

---

## Task 7: Widen the Kurikulum page guards to allow ADMIN

**Files:**
- Modify: `app/(dashboard)/admin/milestones/page.tsx:12`
- Modify: `app/(dashboard)/admin/milestones/progress/page.tsx:12`
- Modify: `app/(dashboard)/admin/milestones/reports/page.tsx:11`

- [ ] **Step 1: Widen `milestones/page.tsx`**

Change:

```ts
  if (role !== 'SUPER_ADMIN') redirect('/admin')
```

to:

```ts
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') redirect('/admin')
```

- [ ] **Step 2: Widen `milestones/progress/page.tsx`**

Same change as Step 1, at line 12.

- [ ] **Step 3: Widen `milestones/reports/page.tsx`**

Same change as Step 1, at line 11.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/admin/milestones/page.tsx" "app/(dashboard)/admin/milestones/progress/page.tsx" "app/(dashboard)/admin/milestones/reports/page.tsx"
git commit -m "feat: allow ADMIN role into Kurikulum pages"
```

---

## Task 8: Widen User-domain APIs (Siswa / Tutor / Parent management)

Same one-line change repeated across each check: add `&& role !== 'ADMIN'` (or `&& (session.user as any).role !== 'ADMIN'` where the file doesn't extract a `role` variable) to the negative check, so both `SUPER_ADMIN` and `ADMIN` pass.

**Files:**
- Modify: `app/api/students/route.ts:56`
- Modify: `app/api/students/[id]/route.ts:37,66`
- Modify: `app/api/students/[id]/status/route.ts:12`
- Modify: `app/api/tutors/route.ts:12`
- Modify: `app/api/users/route.ts:20,38`
- Modify: `app/api/users/[id]/route.ts:18,35,84`
- Modify: `app/api/admin/parents/route.ts:14`
- Modify: `app/api/admin/users/[id]/suspend/route.ts:12`

- [ ] **Step 1: `students/route.ts:56`**

```ts
  if (role !== 'SUPER_ADMIN' && role !== 'TUTOR') {
```
→
```ts
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'TUTOR') {
```

- [ ] **Step 2: `students/[id]/route.ts:37`** (same TUTOR-inclusive pattern as Step 1)

```ts
  if (role !== 'SUPER_ADMIN' && role !== 'TUTOR') {
```
→
```ts
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'TUTOR') {
```

- [ ] **Step 3: `students/[id]/route.ts:66`**

```ts
  if (role !== 'SUPER_ADMIN') {
```
→
```ts
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
```

- [ ] **Step 4: `students/[id]/status/route.ts:12`**

```ts
  if ((session.user as any).role !== 'SUPER_ADMIN') {
```
→
```ts
  if ((session.user as any).role !== 'SUPER_ADMIN' && (session.user as any).role !== 'ADMIN') {
```

- [ ] **Step 5: `tutors/route.ts:12`**

```ts
  if (role !== 'SUPER_ADMIN') {
```
→
```ts
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
```

- [ ] **Step 6: `users/route.ts:20`** (GET)

```ts
  if ((session.user as any).role !== 'SUPER_ADMIN') {
```
→
```ts
  if ((session.user as any).role !== 'SUPER_ADMIN' && (session.user as any).role !== 'ADMIN') {
```

- [ ] **Step 7: `users/route.ts:38`** (POST) — same replacement as Step 6.

- [ ] **Step 8: `users/[id]/route.ts:18`** (GET) — same replacement as Step 6.

- [ ] **Step 9: `users/[id]/route.ts:35`** (PUT) — same replacement as Step 6.

- [ ] **Step 10: `users/[id]/route.ts:84`** (DELETE) — same replacement as Step 6.

Note: leave line 96 (`if (targetUser.role === 'SUPER_ADMIN') return ... 'Tidak dapat menghapus Super Admin.'`) untouched — it protects the SUPER_ADMIN target account regardless of who the actor is, which is still correct.

- [ ] **Step 11: `admin/parents/route.ts:14`**

```ts
    const role = (session.user as any).role
    if (role !== 'SUPER_ADMIN') {
```
→
```ts
    const role = (session.user as any).role
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
```

- [ ] **Step 12: `admin/users/[id]/suspend/route.ts:12`**

```ts
  if ((session.user as any).role !== 'SUPER_ADMIN') {
```
→
```ts
  if ((session.user as any).role !== 'SUPER_ADMIN' && (session.user as any).role !== 'ADMIN') {
```

Leave line 20-21 (`if (user.role === 'SUPER_ADMIN') return ... 'Cannot suspend admin account'`) untouched — same reasoning as Step 10.

- [ ] **Step 13: Verify**

Run: `npm run build` (type-checks all routes touched).
Expected: no TypeScript errors.

- [ ] **Step 14: Commit**

```bash
git add app/api/students app/api/tutors/route.ts app/api/users app/api/admin/parents app/api/admin/users
git commit -m "feat: allow ADMIN role to manage students, tutors, parents, and user accounts"
```

---

## Task 9: Widen Schedule-domain APIs (Kelas / Jadwal / Timetable)

**Files:**
- Modify: `app/api/classes/route.ts:65`
- Modify: `app/api/classes/[id]/route.ts:48,101`
- Modify: `app/api/schedules/route.ts:76`
- Modify: `app/api/schedules/[id]/route.ts:51,86,103`
- Modify: `app/api/schedules/[id]/publish/route.ts:13`
- Modify: `app/api/enrollments/route.ts:17`
- Modify: `app/api/enrollments/[id]/route.ts:12`
- Modify: `app/api/admin/timetable/route.ts:8`
- Modify: `app/api/admin/timetable/generate/route.ts:52`

- [ ] **Step 1: `classes/route.ts:65`**

```ts
  if (role !== 'SUPER_ADMIN') {
```
→
```ts
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
```

- [ ] **Step 2: `classes/[id]/route.ts:48`** — same replacement as Step 1.

- [ ] **Step 3: `classes/[id]/route.ts:101`** — same replacement as Step 1.

- [ ] **Step 4: `schedules/route.ts:76`** — same replacement as Step 1.

- [ ] **Step 5: `schedules/[id]/route.ts:51`**

```ts
  if (role !== 'SUPER_ADMIN' && role !== 'TUTOR') {
```
→
```ts
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'TUTOR') {
```

- [ ] **Step 6: `schedules/[id]/route.ts:86`** — widen the "who gets the full update" ternary so ADMIN behaves like SUPER_ADMIN (can change date/status), not like a restricted TUTOR:

```ts
  const updateData =
    role === 'SUPER_ADMIN'
      ? { ...rest, ...(date ? { date: new Date(date) } : {}) }
      : { topic: rest.topic, location: rest.location }
```
→
```ts
  const updateData =
    role === 'SUPER_ADMIN' || role === 'ADMIN'
      ? { ...rest, ...(date ? { date: new Date(date) } : {}) }
      : { topic: rest.topic, location: rest.location }
```

- [ ] **Step 7: `schedules/[id]/route.ts:103`** (DELETE)

```ts
  if (role !== 'SUPER_ADMIN') {
```
→
```ts
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
```

- [ ] **Step 8: `schedules/[id]/publish/route.ts:13`** — same replacement as Step 1.

- [ ] **Step 9: `enrollments/route.ts:17`** — same replacement as Step 1.

- [ ] **Step 10: `enrollments/[id]/route.ts:12`**

```ts
  if ((session.user as any).role !== 'SUPER_ADMIN') {
```
→
```ts
  if ((session.user as any).role !== 'SUPER_ADMIN' && (session.user as any).role !== 'ADMIN') {
```

- [ ] **Step 11: `admin/timetable/route.ts:8`**

```ts
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
```
→
```ts
  if (!session || ((session.user as any).role !== 'SUPER_ADMIN' && (session.user as any).role !== 'ADMIN')) {
```

- [ ] **Step 12: `admin/timetable/generate/route.ts:52`** — same replacement as Step 11.

- [ ] **Step 13: Verify**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 14: Commit**

```bash
git add app/api/classes app/api/schedules app/api/enrollments app/api/admin/timetable
git commit -m "feat: allow ADMIN role to manage classes, schedules, enrollments, and timetable"
```

---

## Task 10: Widen Billing-domain APIs (Tagihan / Paket Harga) — NOT financial-report

**Files:**
- Modify: `app/api/invoices/route.ts:75`
- Modify: `app/api/invoices/[id]/route.ts:33,58`
- Modify: `app/api/invoices/[id]/pdf/route.ts:12`
- Modify: `app/api/invoices/[id]/send-wa/route.ts:14`
- Modify: `app/api/invoices/bulk/route.ts:17`
- Modify: `app/api/payments/manual/route.ts:18`
- Modify: `app/api/pricing/route.ts:22`
- Modify: `app/api/admin/billing/remind/route.ts:11`
- Modify: `app/api/admin/contact-parent/route.ts:16`

`app/api/admin/financial-report/summary/route.ts` is deliberately **excluded** — it must stay `SUPER_ADMIN`-only (see Task 14 for the regression test).

- [ ] **Step 1: `invoices/route.ts:75`**

```ts
  if (role !== 'SUPER_ADMIN') {
```
→
```ts
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
```

- [ ] **Step 2: `invoices/[id]/route.ts:33`** — same replacement as Step 1.

- [ ] **Step 3: `invoices/[id]/route.ts:58`** — same replacement as Step 1.

- [ ] **Step 4: `invoices/[id]/pdf/route.ts:12`** — same replacement as Step 1.

- [ ] **Step 5: `invoices/[id]/send-wa/route.ts:14`** — same replacement as Step 1.

- [ ] **Step 6: `invoices/bulk/route.ts:17`**

```ts
  if ((session.user as any).role !== 'SUPER_ADMIN') {
```
→
```ts
  if ((session.user as any).role !== 'SUPER_ADMIN' && (session.user as any).role !== 'ADMIN') {
```

- [ ] **Step 7: `payments/manual/route.ts:18`** — same replacement as Step 1.

- [ ] **Step 8: `pricing/route.ts:22`** — same replacement as Step 1.

- [ ] **Step 9: `admin/billing/remind/route.ts:11`** — same replacement as Step 6.

- [ ] **Step 10: `admin/contact-parent/route.ts:16`** — same replacement as Step 6.

- [ ] **Step 11: Verify**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 12: Commit**

```bash
git add app/api/invoices app/api/payments app/api/pricing app/api/admin/billing app/api/admin/contact-parent
git commit -m "feat: allow ADMIN role to manage invoices, payments, and pricing"
```

---

## Task 11: Widen Kurikulum-domain APIs (Master Program / Milestone / Progress / Raport)

**Files:**
- Modify: `app/api/milestones/route.ts:35`
- Modify: `app/api/milestones/[id]/route.ts:20,43`
- Modify: `app/api/milestone-reports/route.ts:60,82`
- Modify: `app/api/milestone-reports/[id]/route.ts:44`
- Modify: `app/api/program-enrollments/route.ts:49`
- Modify: `app/api/program-enrollments/[id]/route.ts:41`
- Modify: `app/api/program-enrollments/[id]/upgrade/route.ts:17`
- Modify: `app/api/student-milestones/route.ts:56`

- [ ] **Step 1: `milestones/route.ts:35`**

```ts
  if (role !== 'SUPER_ADMIN') {
```
→
```ts
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
```

- [ ] **Step 2: `milestones/[id]/route.ts:20`** — same replacement as Step 1.

- [ ] **Step 3: `milestones/[id]/route.ts:43`** — same replacement as Step 1.

- [ ] **Step 4: `milestone-reports/route.ts:60`** — same replacement as Step 1.

- [ ] **Step 5: `milestone-reports/route.ts:82`** — same replacement as Step 1.

- [ ] **Step 6: `milestone-reports/[id]/route.ts:44`** — same replacement as Step 1.

- [ ] **Step 7: `program-enrollments/route.ts:49`** — same replacement as Step 1.

- [ ] **Step 8: `program-enrollments/[id]/route.ts:41`** — same replacement as Step 1.

- [ ] **Step 9: `program-enrollments/[id]/upgrade/route.ts:17`** — same replacement as Step 1.

- [ ] **Step 10: `student-milestones/route.ts:56`** — same replacement as Step 1.

- [ ] **Step 11: Verify**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 12: Commit**

```bash
git add app/api/milestones app/api/milestone-reports app/api/program-enrollments app/api/student-milestones
git commit -m "feat: allow ADMIN role to manage curriculum, milestones, and milestone reports"
```

---

## Task 12: Widen Laporan-domain APIs (per-student learning report)

**Files:**
- Modify: `app/api/reports/route.ts:38,77`
- Modify: `app/api/reports/[id]/route.ts:36`
- Modify: `app/api/schedules/[id]/reports/route.ts:16`
- Modify: `app/api/admin/reports/list/route.ts:9`
- Modify: `app/api/media/upload/route.ts:16`
- Modify: `app/api/media/[id]/route.ts:17`

- [ ] **Step 1: `reports/route.ts:38`** (GET — the `SUPER_ADMIN` branch of the role `if/else if` chain)

```ts
  } else if (role === 'SUPER_ADMIN') {
    if (studentId) where = { studentId }
```
→
```ts
  } else if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
    if (studentId) where = { studentId }
```

- [ ] **Step 2: `reports/route.ts:77`** (POST)

```ts
  if (role !== 'SUPER_ADMIN' && role !== 'TUTOR') {
```
→
```ts
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'TUTOR') {
```

- [ ] **Step 3: `reports/[id]/route.ts:36`** (PUT)

```ts
  if (role !== 'SUPER_ADMIN' && role !== 'TUTOR') {
```
→
```ts
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'TUTOR') {
```

- [ ] **Step 4: `schedules/[id]/reports/route.ts:16`**

```ts
  if (role !== 'TUTOR' && role !== 'SUPER_ADMIN') {
```
→
```ts
  if (role !== 'TUTOR' && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
```

Leave line 28 (`if (role === 'TUTOR' && schedule.class.tutorId !== userId)`) untouched — it only fires for `TUTOR`, so `ADMIN` already bypasses the per-class ownership check the same way `SUPER_ADMIN` does.

- [ ] **Step 5: `admin/reports/list/route.ts:9`**

```ts
  if ((session.user as any).role !== 'SUPER_ADMIN') {
```
→
```ts
  if ((session.user as any).role !== 'SUPER_ADMIN' && (session.user as any).role !== 'ADMIN') {
```

- [ ] **Step 6: `media/upload/route.ts:16`**

```ts
  if (role !== 'SUPER_ADMIN' && role !== 'TUTOR') {
```
→
```ts
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'TUTOR') {
```

- [ ] **Step 7: `media/[id]/route.ts:17`** — same replacement as Step 6.

- [ ] **Step 8: Verify**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add app/api/reports app/api/schedules/[id]/reports app/api/admin/reports/list app/api/media
git commit -m "feat: allow ADMIN role to read and write per-student learning reports"
```

---

## Task 13: Regression tests — the financial-report boundary must hold

This is the one security-critical boundary in this whole change: everything else widens access (loud failure if wrong — a 403 where 200 was expected, caught immediately in manual testing), but a mistake here would silently leak financial data to a role explicitly meant not to see it. Write the failing test first.

**Files:**
- Test: `__tests__/api/admin/financial-report-summary.test.ts` (new)
- Test: `__tests__/api/tutors.test.ts` (new)

- [ ] **Step 1: Write the failing regression test for the financial-report boundary**

Create `__tests__/api/admin/financial-report-summary.test.ts`:

```ts
import { GET } from '@/app/api/admin/financial-report/summary/route'
import { getServerSession } from 'next-auth'

jest.mock('next-auth')
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: { invoice: { findMany: jest.fn() } },
}))

describe('GET /api/admin/financial-report/summary', () => {
  it('returns 403 for ADMIN role (financial report stays SUPER_ADMIN-only)', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } })
    const req = new Request('http://localhost/api/admin/financial-report/summary')
    const res = await GET(req as any)
    expect(res.status).toBe(403)
  })

  it('returns 403 for unauthenticated requests', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const req = new Request('http://localhost/api/admin/financial-report/summary')
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run it and confirm it currently passes (this boundary is untouched by this plan, so it should already pass — confirming the test itself is correct before moving on)**

Run: `npx jest __tests__/api/admin/financial-report-summary.test.ts`
Expected: PASS, 2/2 — `app/api/admin/financial-report/summary/route.ts` was deliberately left unmodified in Task 10, so this test validates the existing (correct) behavior and will now guard it against future regressions.

- [ ] **Step 3: Write the regression test proving ADMIN was actually opened up**

Create `__tests__/api/tutors.test.ts`:

```ts
import { GET } from '@/app/api/tutors/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

jest.mock('next-auth')
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: { user: { findMany: jest.fn() } },
}))

describe('GET /api/tutors', () => {
  it('returns 401 for unauthenticated requests', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const req = new Request('http://localhost/api/tutors')
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })

  it('returns 403 for PARENT role', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'PARENT' } })
    const req = new Request('http://localhost/api/tutors')
    const res = await GET(req as any)
    expect(res.status).toBe(403)
  })

  it('returns 200 for ADMIN role', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } })
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([])
    const req = new Request('http://localhost/api/tutors')
    const res = await GET(req as any)
    expect(res.status).toBe(200)
  })

  it('returns 200 for SUPER_ADMIN role', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([])
    const req = new Request('http://localhost/api/tutors')
    const res = await GET(req as any)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 4: Run it — the ADMIN case should fail before Task 8, pass after**

Run: `npx jest __tests__/api/tutors.test.ts`
Expected: all 4 tests PASS (Task 8 already widened `tutors/route.ts:12` by this point in the plan). If run before Task 8's edit, the `ADMIN` case would FAIL with `expected 200, received 403` — that was the point of writing it as a regression guard.

- [ ] **Step 5: Commit**

```bash
git add __tests__/api/admin/financial-report-summary.test.ts __tests__/api/tutors.test.ts
git commit -m "test: guard the financial-report ADMIN boundary and the tutors-list ADMIN access"
```

---

## Task 14: Hide income figures on the dashboard for ADMIN

**Files:**
- Modify: `app/(dashboard)/admin/page.tsx:7-10,198-223`
- Modify: `app/(dashboard)/admin/DashboardClient.tsx:52-60,94-138,174-220`

- [ ] **Step 1: Pass the role down from the server page**

In `app/(dashboard)/admin/page.tsx`, change:

```ts
export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
```

to:

```ts
export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any).role as 'SUPER_ADMIN' | 'ADMIN'
```

and change the final `return`:

```ts
  return (
    <DashboardClient
      stats={{
```

to:

```ts
  return (
    <DashboardClient
      role={role}
      stats={{
```

- [ ] **Step 2: Accept the new prop in `DashboardClient`**

In `app/(dashboard)/admin/DashboardClient.tsx`, change the `Props` type:

```ts
type Props = {
  stats: Stats
```

to:

```ts
type Props = {
  role: 'SUPER_ADMIN' | 'ADMIN'
  stats: Stats
```

and change the function signature:

```ts
export default function DashboardClient({
  stats,
```

to:

```ts
export default function DashboardClient({
  role,
  stats,
```

- [ ] **Step 3: Filter out the income stat card for ADMIN**

Change:

```ts
    {
      label: 'Pendapatan Bulan Ini',
      value: formatRupiah(stats.revenueThisMonth),
      icon: TrendingUp,
      bg: 'bg-green-50',
      text: 'text-green-600',
    },
    {
      label: 'Kehadiran Bulan Ini',
      value: stats.attendanceRateThisMonth !== null ? `${stats.attendanceRateThisMonth}%` : '—',
      icon: Activity,
      bg: 'bg-sky-50',
      text: 'text-sky-600',
    },
  ]
```

to:

```ts
    {
      label: 'Pendapatan Bulan Ini',
      value: formatRupiah(stats.revenueThisMonth),
      icon: TrendingUp,
      bg: 'bg-green-50',
      text: 'text-green-600',
    },
    {
      label: 'Kehadiran Bulan Ini',
      value: stats.attendanceRateThisMonth !== null ? `${stats.attendanceRateThisMonth}%` : '—',
      icon: Activity,
      bg: 'bg-sky-50',
      text: 'text-sky-600',
    },
  ].filter((s) => role !== 'ADMIN' || s.label !== 'Pendapatan Bulan Ini')
```

- [ ] **Step 4: Hide the revenue-by-month chart for ADMIN**

Change:

```tsx
      {/* Charts Row 1: Revenue + Invoice Status Donut */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6">
          <h2 className="font-bold text-slate-800 mb-4">📈 Pendapatan 6 Bulan Terakhir</h2>
```

to:

```tsx
      {/* Charts Row 1: Revenue + Invoice Status Donut */}
      <div className={role === 'ADMIN' ? 'grid gap-6' : 'grid gap-6 lg:grid-cols-2'}>
        {role !== 'ADMIN' && (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6">
          <h2 className="font-bold text-slate-800 mb-4">📈 Pendapatan 6 Bulan Terakhir</h2>
```

and immediately after the closing of that revenue-chart `<div>` (right before the `<div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6">` that starts the "💰 Status Tagihan (Semua)" panel), add the matching closing:

```tsx
        </div>
        )}

        <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6">
          <h2 className="font-bold text-slate-800 mb-4">💰 Status Tagihan (Semua)</h2>
```

(The rest of that second panel and the closing `</div>` of the row stay exactly as they are today.)

- [ ] **Step 5: Verify in the browser**

Logged in as `staff@mellyna.id` (ADMIN), open `/admin`.
Expected: 5 stat cards (no "Pendapatan Bulan Ini"), no "Pendapatan 6 Bulan Terakhir" bar chart, "Status Tagihan (Semua)" pie chart still shows full-width. Logged in as `SUPER_ADMIN`, `/admin` looks exactly as before (6 cards, both charts side by side).

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/admin/page.tsx" "app/(dashboard)/admin/DashboardClient.tsx"
git commit -m "feat: hide dashboard income figures for the ADMIN role"
```

---

## Task 15: Extract the report-input form into a shared component

**Files:**
- Create: `components/reports/ReportInputClient.tsx`
- Modify: `app/(dashboard)/tutor/reports/[scheduleId]/page.tsx`

- [ ] **Step 1: Create the shared component**

Create `components/reports/ReportInputClient.tsx` with the exact current contents of `app/(dashboard)/tutor/reports/[scheduleId]/page.tsx` (all 371 lines — the `useParams()`-based `scheduleId` read, the fetch/save/upload/delete handlers, and the JSX), with only the export renamed:

```tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Save, Upload, Trash2 } from 'lucide-react'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { StarRating } from '@/components/ui/star-rating'

interface Student {
  id: string
  name: string
  grade: string | null
}

interface MediaItem {
  id: string
  url: string
  type: 'PHOTO' | 'VIDEO'
  filename: string
}

interface ReportEntry {
  studentId: string
  content: string
  score: number | null
  reportId: string | null
  uploading: boolean
  media: MediaItem[]
}

export default function ReportInputClient() {
  const params = useParams()
  const router = useRouter()
  const confirm = useConfirm()
  const scheduleId = params.scheduleId as string

  const [schedule, setSchedule] = useState<any>(null)
  const [entries, setEntries] = useState<ReportEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successIds, setSuccessIds] = useState<Set<string>>(new Set())
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [schedRes, reportsRes] = await Promise.all([
          fetch(`/api/schedules/${scheduleId}`),
          fetch(`/api/reports?scheduleId=${scheduleId}`),
        ])
        const schedData = await schedRes.json()
        const reportsData = await reportsRes.json()
        setSchedule(schedData)

        const existingReports: Record<string, any> = {}
        reportsData.forEach((r: any) => { existingReports[r.studentId] = r })

        const students: Student[] = (schedData.participants ?? []).map((p: any) => p.student)

        setEntries(students.map((s) => ({
          studentId: s.id,
          content: existingReports[s.id]?.content || '',
          score: existingReports[s.id]?.score ?? null,
          reportId: existingReports[s.id]?.id || null,
          uploading: false,
          media: existingReports[s.id]?.media || [],
        })))
      } catch {
        setError('Gagal memuat data laporan.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [scheduleId])

  const handleSave = async (studentId: string) => {
    setSaving(studentId)
    setError(null)
    const entry = entries.find((e) => e.studentId === studentId)
    if (!entry) return
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          scheduleId,
          content: entry.content,
          score: entry.score ?? undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEntries((prev) =>
        prev.map((e) => e.studentId === studentId ? { ...e, reportId: data.id } : e)
      )
      setSuccessIds((prev) => new Set(prev).add(studentId))
      setTimeout(() => setSuccessIds((prev) => {
        const s = new Set(prev); s.delete(studentId); return s
      }), 3000)
    } catch {
      setError('Gagal menyimpan laporan untuk siswa ini.')
    } finally {
      setSaving(null)
    }
  }

  const handleUpload = async (studentId: string, file: File) => {
    const entry = entries.find((e) => e.studentId === studentId)
    if (!entry?.reportId) {
      setError('Simpan laporan terlebih dahulu sebelum upload media.')
      return
    }
    setEntries((prev) => prev.map((e) => e.studentId === studentId ? { ...e, uploading: true } : e))
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('reportId', entry.reportId)
      const res = await fetch('/api/media/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const newMedia: MediaItem = await res.json()
      setEntries((prev) =>
        prev.map((e) =>
          e.studentId === studentId
            ? { ...e, media: [...e.media, newMedia] }
            : e
        )
      )
    } catch {
      setError('Gagal upload media.')
    } finally {
      setEntries((prev) => prev.map((e) => e.studentId === studentId ? { ...e, uploading: false } : e))
    }
  }

  const handleDeleteMedia = useCallback(async (studentId: string, mediaId: string) => {
    const ok = await confirm({
      title: 'Hapus Media',
      message: 'Hapus media ini secara permanen?',
      variant: 'danger',
      confirmLabel: 'Hapus Media',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/media/${mediaId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setEntries((prev) =>
        prev.map((e) =>
          e.studentId === studentId
            ? { ...e, media: e.media.filter((m) => m.id !== mediaId) }
            : e
        )
      )
    } catch {
      setError('Gagal menghapus media.')
    }
  }, [confirm])

  if (loading) {
    return (
      <div className="p-10 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
      </div>
    )
  }

  const students: Student[] = (schedule?.participants ?? []).map((p: any) => p.student)

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium mb-2 cursor-pointer"
        >
          ← Kembali
        </button>
        <h1 className="text-2xl font-extrabold text-slate-800">📝 Laporan Belajar</h1>
        {schedule && (
          <p className="text-sm text-slate-500 mt-1">
            {schedule.class?.name} •{' '}
            {new Date(schedule.date).toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">
          ⚠️ {error}
        </div>
      )}

      {students.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
          <p className="text-3xl">👥</p>
          <p className="mt-2 text-sm">Belum ada peserta terdaftar di sesi ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {students.map((student) => {
            const entry = entries.find((e) => e.studentId === student.id)
            const isSaved = successIds.has(student.id)
            return (
              <div
                key={student.id}
                className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">{student.name}</h3>
                    <p className="text-xs text-slate-400">{student.grade || '-'}</p>
                  </div>
                  {isSaved && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-1 rounded-lg">
                      ✅ Disimpan
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Catatan Belajar *
                    </label>
                    <textarea
                      rows={3}
                      value={entry?.content || ''}
                      onChange={(e) =>
                        setEntries((prev) =>
                          prev.map((en) =>
                            en.studentId === student.id ? { ...en, content: e.target.value } : en
                          )
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                      placeholder="Catatan perkembangan belajar siswa sesi ini..."
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
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
                    <div className="flex-1 flex items-end gap-3 flex-wrap">
                      <button
                        onClick={() => handleSave(student.id)}
                        disabled={saving === student.id}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {saving === student.id ? 'Menyimpan...' : 'Simpan Laporan'}
                      </button>
                      <button
                        onClick={() => fileRefs.current[student.id]?.click()}
                        disabled={!entry?.reportId || entry?.uploading}
                        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
                        title={!entry?.reportId ? 'Simpan laporan terlebih dahulu' : 'Upload foto/video'}
                      >
                        <Upload className="h-4 w-4" />
                        {entry?.uploading ? 'Mengupload...' : 'Upload Media'}
                      </button>
                      <input
                        ref={(el) => { fileRefs.current[student.id] = el }}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleUpload(student.id, file)
                          e.target.value = ''
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 w-full">
                      Upload min. 2 video laporan (1 per program). Video akan dikompres otomatis.
                    </p>
                  </div>

                  {entry?.media && entry.media.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs font-semibold text-slate-500">
                          Media Terupload ({entry.media.length}):
                        </p>
                        {(() => {
                          const videoCount = entry.media.filter((m) => m.type === 'VIDEO').length
                          return videoCount < 2 ? (
                            <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-lg">
                              📹 {videoCount}/2 video
                            </span>
                          ) : (
                            <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-lg">
                              📹 {videoCount} video ✓
                            </span>
                          )
                        })()}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {entry.media.map((m) => (
                          <div key={m.id} className="relative group">
                            {m.type === 'PHOTO' ? (
                              <a href={m.url} target="_blank" rel="noopener noreferrer">
                                <div className="h-20 w-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                                  <img
                                    src={m.url}
                                    alt={m.filename}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              </a>
                            ) : (
                              <div className="space-y-1">
                                <video
                                  src={m.url}
                                  controls
                                  preload="metadata"
                                  className="h-20 w-36 rounded-xl border border-slate-200 bg-slate-100 object-cover"
                                  title={m.filename}
                                />
                                <a
                                  href={m.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[10px] text-indigo-600 hover:underline font-medium"
                                >
                                  🔗 Lihat Video
                                </a>
                              </div>
                            )}
                            <button
                              onClick={() => handleDeleteMedia(student.id, m.id)}
                              className="absolute -top-2 -right-2 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm cursor-pointer"
                              title="Hapus media"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Replace the tutor page with a thin wrapper**

Replace the entire contents of `app/(dashboard)/tutor/reports/[scheduleId]/page.tsx` with:

```tsx
import ReportInputClient from '@/components/reports/ReportInputClient'

export default function TutorReportInputPage() {
  return <ReportInputClient />
}
```

- [ ] **Step 3: Verify the tutor flow still works**

Run: `npm run dev`, log in as a tutor, open a published schedule's report form from the tutor dashboard.
Expected: identical behavior to before the extraction — same form, save, and upload flows.

- [ ] **Step 4: Run the existing test suites that touch this page**

Run: `npx jest __tests__/pages`
Expected: PASS (no test in this repo currently imports the tutor report page directly by path, per the plans referencing it only through browser-navigation instructions — if a test fails on the changed import, update its import path to `@/components/reports/ReportInputClient`).

- [ ] **Step 5: Commit**

```bash
git add components/reports/ReportInputClient.tsx "app/(dashboard)/tutor/reports/[scheduleId]/page.tsx"
git commit -m "refactor: extract report input form into a shared component"
```

---

## Task 16: Admin report-input page and entry point

**Files:**
- Create: `app/(dashboard)/admin/reports/[scheduleId]/page.tsx`
- Modify: `app/(dashboard)/admin/schedules/SchedulesClient.tsx:1-4,270-289`

- [ ] **Step 1: Create the admin report-input page**

Create `app/(dashboard)/admin/reports/[scheduleId]/page.tsx`:

```tsx
import ReportInputClient from '@/components/reports/ReportInputClient'

export default function AdminReportInputPage() {
  return <ReportInputClient />
}
```

- [ ] **Step 2: Import `Link` and `FileText` in `SchedulesClient.tsx`**

Change:

```ts
import { useState, useCallback, useMemo } from 'react'
import { Plus, Send, CalendarPlus, X, Info, Trash2 } from 'lucide-react'
```

to:

```ts
import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Send, CalendarPlus, X, Info, Trash2, FileText } from 'lucide-react'
```

- [ ] **Step 3: Add the "Isi Laporan" link to the actions column**

Change the `actions` column cell (currently):

```tsx
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const s = row.original
        if (s.status !== 'DRAFT' && s.status !== 'PUBLISHED') return null
        return (
          <button
            onClick={() => handlePublish(s.id)}
            disabled={publishing === s.id}
            className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Send className="h-3 w-3" />
            {publishing === s.id ? 'Mengirim...' : s.status === 'DRAFT' ? 'Terbitkan + WA' : 'Kirim Ulang WA'}
          </button>
        )
      },
    },
```

to:

```tsx
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const s = row.original
        return (
          <div className="flex items-center gap-2">
            {(s.status === 'PUBLISHED' || s.status === 'COMPLETED') && (
              <Link
                href={`/admin/reports/${s.id}`}
                className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                <FileText className="h-3 w-3" />
                Isi Laporan
              </Link>
            )}
            {(s.status === 'DRAFT' || s.status === 'PUBLISHED') && (
              <button
                onClick={() => handlePublish(s.id)}
                disabled={publishing === s.id}
                className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Send className="h-3 w-3" />
                {publishing === s.id ? 'Mengirim...' : s.status === 'DRAFT' ? 'Terbitkan + WA' : 'Kirim Ulang WA'}
              </button>
            )}
          </div>
        )
      },
    },
```

- [ ] **Step 4: Verify in the browser as ADMIN**

Logged in as `staff@mellyna.id`, open `/admin/schedules`, find a PUBLISHED or COMPLETED schedule, click "Isi Laporan".
Expected: navigates to `/admin/reports/<id>`, shows the same per-student report form tutors use, save/upload works, and the report becomes visible afterward on `/admin/reports` (the existing list view) and on the parent's side.

- [ ] **Step 5: Confirm SUPER_ADMIN and TUTOR are unaffected**

Log in as `SUPER_ADMIN`: `/admin/schedules` shows the same new "Isi Laporan" button (harmless — SUPER_ADMIN already had full access via `/api/reports`). Log in as a tutor: `/tutor/reports/[scheduleId]` is untouched by this task.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/admin/reports/[scheduleId]/page.tsx" "app/(dashboard)/admin/schedules/SchedulesClient.tsx"
git commit -m "feat: let ADMIN and SUPER_ADMIN input per-student reports from the schedules table"
```

---

## Task 17: Full manual verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx jest`
Expected: all tests pass, including the two new ones from Task 13.

- [ ] **Step 2: Type-check and build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Walk the ADMIN account through every menu item**

Log in as `staff@mellyna.id` / `staffadmin123`. For each sidebar item, confirm it loads and matches the requested scope:
- Dashboard: loads, no income card, no revenue chart, has invoice-status pie and today's-schedule/tagihan-attention panels.
- User → Siswa / Tutor / Parent: each list loads, create/edit/delete works.
- Schedule → Kelas / Jadwal / Timetable: each loads, create/edit/publish/delete works, "Isi Laporan" button appears on published/completed rows.
- Billing → Tagihan / Paket Harga: both load, CRUD works. "Laporan Keuangan" is **not** in the Billing submenu.
- Laporan: loads existing `ReportsClient` list view.
- Kurikulum → Master Program / Milestone / Progress Siswa / Raport: all four load and are editable.

- [ ] **Step 4: Confirm the deny-list holds via direct URL**

Still logged in as ADMIN, manually navigate to each of: `/admin/financial-report`, `/admin/analytics`, `/admin/tutor-monitoring`, `/admin/settings`, `/admin/announcements`.
Expected: every one redirects back to `/admin` — none render.

- [ ] **Step 5: Confirm SUPER_ADMIN is unaffected**

Log in as `admin@mellyna.id` (existing Super Admin fixture). Confirm the sidebar still shows the full original menu (Dashboard with Analitik/Monitoring Tutor, all of Billing including Laporan Keuangan, Pengumuman, Pengaturan) and every page still loads.

- [ ] **Step 6: Confirm TUTOR and PARENT are unaffected**

Log in as a tutor and as a parent fixture account; confirm their sidebars and page access are unchanged from before this plan.

- [ ] **Step 7: Report to user**

Summarize: Prisma `Role` enum now includes `ADMIN`; middleware/root-redirect/sidebar/dashboard updated; ~45 API route files and 7 page files widened or newly guarded to implement the ADMIN scope; report-input form extracted into `components/reports/ReportInputClient.tsx` and reused by a new `/admin/reports/[scheduleId]` page; two new regression tests added under `__tests__/api/`.
