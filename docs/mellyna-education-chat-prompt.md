# Prompt untuk Chat Mellyna Education

Paste teks di bawah ini ke chat Claude di project mellyna-education.

---

## PROMPT (copy dari sini sampai END PROMPT)

---

Saya sedang mengerjakan project **Mellyna Education** — platform web bimbingan belajar (bimbel) anak.

**Project directory:** `/Users/weka/project/mellyna-education`
**GitHub:** https://github.com/WekaF/mellyna-education.git

## Yang sudah selesai (Task 1 & 2 — Project Setup)

Project sudah di-bootstrap dan di-push ke GitHub dengan struktur berikut yang sudah ada:

```
mellyna-education/
├── lib/
│   ├── auth.ts          # NextAuth credentials + JWT role (SUPER_ADMIN, TUTOR, PARENT)
│   ├── db.ts            # Prisma singleton
│   ├── env.ts           # Zod env validation
│   ├── midtrans.ts      # Midtrans Snap client
│   ├── n8n.ts           # n8n webhook trigger
│   ├── rate-limit.ts    # IP rate limiter
│   ├── storage.ts       # MinIO upload
│   ├── utils.ts         # cn() + formatRupiah() + formatPhoneForWA()
│   └── waha.ts          # WAHA WhatsApp HTTP API client
├── prisma/
│   ├── schema.prisma    # Full schema (semua model sudah ada)
│   └── seed.ts          # Seed data (admin, tutor, parent, student, class)
├── types/next-auth.d.ts # Session type augmentation
├── middleware.ts         # Route protection by role
├── next.config.ts        # Security headers + standalone output
├── docker-compose.yml    # Local: postgres + minio + waha + n8n
├── docker-compose.prod.yml # Prod: Sumopod deployment
├── Dockerfile            # Multi-stage build
├── .github/workflows/ci.yml     # CI: lint, tsc, jest, prisma
├── .github/workflows/deploy.yml # CD: GHCR + SSH deploy ke Sumopod
├── .github/dependabot.yml
├── app/layout.tsx        # Root layout + Midtrans Snap script
├── app/providers.tsx     # SessionProvider
└── app/page.tsx          # Redirect by role
```

**Prisma schema sudah include:** User, Student, Class, Enrollment, Schedule, Attendance, LearningReport, Media, Announcement, Invoice, Payment, + NextAuth models (Account, Session, VerificationToken).

**Enums:** Role (SUPER_ADMIN, TUTOR, PARENT), ScheduleStatus (DRAFT, PUBLISHED, COMPLETED, CANCELLED), AttendanceStatus (PRESENT, ABSENT, SICK, PERMISSION), MediaType (PHOTO, VIDEO), InvoiceStatus (PENDING, PAID, OVERDUE, CANCELLED), PaymentStatus (PENDING, SUCCESS, FAILED, EXPIRED).

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **UI:** Tailwind CSS v4 + Radix UI primitives (shadcn/ui pattern)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js v4 (credentials, JWT strategy)
- **Payment:** Midtrans Snap
- **WhatsApp:** WAHA self-hosted (https://waha.devlike.pro/) via Docker — `sendWhatsApp()` helper sudah ada di `lib/waha.ts`
- **Automation:** n8n self-hosted Docker — trigger di `lib/n8n.ts`
- **Storage:** MinIO self-hosted (S3-compatible) — `uploadFile()` sudah ada di `lib/storage.ts`
- **Deployment:** Docker Compose → Sumopod

## Seed Credentials (setelah `npm run db:seed`)

| Role | Email | Password |
|---|---|---|
| Super Admin | admin@mellyna.id | admin123 |
| Tutor | tutor@mellyna.id | tutor123 |
| Parent | parent@mellyna.id | parent123 |

## Dependencies yang sudah terinstall

```
next-auth, @next-auth/prisma-adapter, @prisma/client, bcryptjs,
midtrans-client, minio, zod, react-hook-form, @hookform/resolvers,
date-fns, lucide-react, clsx, tailwind-merge, class-variance-authority,
@radix-ui/react-slot, @radix-ui/react-label, @radix-ui/react-select,
@radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-tabs,
@radix-ui/react-avatar, @radix-ui/react-toast, @radix-ui/react-checkbox
```

## Yang perlu diimplementasikan

Implementasikan task-task berikut secara berurutan (Task 3 sampai 18). Setiap task commit setelah selesai.

---

### Task 3: Authentication Pages & API

Buat file-file berikut:

**`app/api/auth/[...nextauth]/route.ts`:**
```typescript
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

**`app/(auth)/login/page.tsx`** — Halaman login dengan form email + password menggunakan NextAuth `signIn('credentials')`. Setelah login, redirect ke `/admin`, `/tutor`, atau `/parent` sesuai role. Tampilan: card di tengah, logo "🎓 Mellyna Education", error message jika gagal, loading state saat submit. Gunakan Tailwind CSS murni (tanpa shadcn component yang belum dibuat).

**`app/(auth)/layout.tsx`:**
```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>
}
```

Commit: `feat: add NextAuth API route and login page`

---

### Task 4: Dashboard Layout & Sidebar

**`app/(dashboard)/layout.tsx`** — Layout dengan sidebar kiri + main content area. Protected (cek session, redirect ke /login jika tidak ada session).

**`components/dashboard/sidebar.tsx`** — Sidebar navigasi dengan:
- Header: "🎓 Mellyna Education" + nama user
- Links berbeda per role:
  - SUPER_ADMIN: Dashboard, Siswa, Tutor, Kelas, Jadwal, Tagihan, Pengumuman
  - TUTOR: Dashboard, Jadwal
  - PARENT: Dashboard, Perkembangan, Jadwal, Tagihan
- Tombol Keluar (signOut)
- Active link highlight

Commit: `feat: add dashboard layout and role-based sidebar`

---

### Task 5: Students & Classes API

**`app/api/students/route.ts`** — GET (list, filter by parent jika role=PARENT) + POST (admin/tutor only). Validasi dengan Zod.

**`app/api/students/[id]/route.ts`** — GET + PUT + DELETE (DELETE hanya SUPER_ADMIN).

**`app/api/classes/route.ts`** — GET (filter by tutorId jika role=TUTOR) + POST (SUPER_ADMIN only).

**`app/api/classes/[id]/route.ts`** — GET + PUT + DELETE.

**`app/api/enrollments/route.ts`** — POST untuk enroll siswa ke kelas (SUPER_ADMIN only). Body: `{ studentId, classId }`.

Semua route: cek session, return 401 jika tidak ada session.

Commit: `feat: add students, classes, enrollments API`

---

### Task 6: Schedule API + Publish Trigger

**`app/api/schedules/route.ts`** — GET (filter by classId, filter by role) + POST.

**`app/api/schedules/[id]/route.ts`** — GET + PUT + DELETE.

**`app/api/schedules/[id]/publish/route.ts`** — POST: update status ke PUBLISHED, set publishedAt, fire-and-forget ke n8n (`triggerSchedulePublished(id)` dari `lib/n8n.ts`).

**`app/api/internal/schedule-notify/[id]/route.ts`** — GET endpoint untuk n8n:
- Proteksi dengan header `x-internal-secret` vs `process.env.N8N_WEBHOOK_SECRET`
- Return: `{ scheduleId, recipients: [{ studentName, parentName, parentPhone, topic, date, startTime, endTime, className }] }`
- Data dari: schedule → class → enrollments → student → parent

Commit: `feat: add schedule API with publish trigger and n8n notify endpoint`

---

### Task 7: Attendance API

**`app/api/attendance/route.ts`:**
- GET: list attendance by `?scheduleId=` atau `?studentId=`
- POST: batch upsert. Body: `{ scheduleId, entries: [{ studentId, status, notes }] }`. Gunakan `prisma.attendance.upsert` dengan `@@unique([studentId, scheduleId])`.

Commit: `feat: add attendance batch API`

---

### Task 8: Learning Reports API

**`app/api/reports/route.ts`:**
- GET: filter by studentId/scheduleId, filter by role (tutor hanya lihat miliknya, parent hanya lihat anak-anaknya)
- POST: upsert report per studentId+scheduleId

**`app/api/reports/[id]/route.ts`** — GET + PUT.

Commit: `feat: add learning reports API`

---

### Task 9: Media Upload API (MinIO)

**`app/api/media/upload/route.ts`:**
- POST: terima FormData (`file`, `reportId`)
- Validasi: max 50MB, hanya image/* dan video/*
- Upload via `uploadFile()` dari `lib/storage.ts`
- Simpan ke `prisma.media.create()`
- Return: media object dengan URL

Commit: `feat: add media upload to MinIO`

---

### Task 10: Invoice & Billing API

**`app/api/invoices/route.ts`:**
- GET: SUPER_ADMIN lihat semua, PARENT hanya lihat invoice anak-anaknya
- POST: SUPER_ADMIN only. Body: `{ studentId, amount, description, dueDate }`

**`app/api/invoices/[id]/route.ts`** — GET + PUT (update status) + DELETE.

Commit: `feat: add invoice CRUD API`

---

### Task 11: Midtrans Payment Integration

**`app/api/payments/create/route.ts`:**
- POST: terima `{ invoiceId }`
- Fetch invoice + student + parent dari DB
- Buat Midtrans Snap transaction dengan `snap.createTransaction()`
- Simpan payment ke DB dengan snapToken dan snapUrl
- Update invoice.midtransId
- Return: `{ token, redirectUrl, paymentId }`

**`app/api/webhooks/midtrans/route.ts`:**
- POST: verifikasi signature SHA-512 (`orderId + statusCode + grossAmount + serverKey`)
- Jika `transaction_status` = 'settlement' atau 'capture': update invoice ke PAID, payment ke SUCCESS
- Jika 'cancel'/'deny'/'expire': update payment ke FAILED

Commit: `feat: add Midtrans Snap payment and webhook`

---

### Task 12: WAHA Webhook Endpoint

**`app/api/webhooks/waha/route.ts`:**
- POST: verifikasi `X-Api-Key` header vs `process.env.WAHA_API_KEY`
- Handle event `session.status`: log status perubahan
- Return 200

Commit: `feat: add WAHA webhook handler`

---

### Task 13: Announcements API

**`app/api/announcements/route.ts`:**
- GET: published=true (semua user), atau semua jika SUPER_ADMIN
- POST: SUPER_ADMIN only. Body: `{ title, content, published? }`

**`app/api/announcements/[id]/route.ts`** — GET + PUT + DELETE.

Commit: `feat: add announcements API`

---

### Task 14: Admin Dashboard Pages

**`app/(dashboard)/admin/page.tsx`** — Overview dengan stats cards: total siswa, total kelas, jadwal hari ini, tagihan pending. Fetch server-side dengan Prisma.

**`app/(dashboard)/admin/students/page.tsx`** — Tabel daftar siswa + tombol tambah + tombol edit. Client component, fetch dari `/api/students`.

**`app/(dashboard)/admin/classes/page.tsx`** — Tabel kelas dengan tutor + jumlah siswa + tombol kelola.

**`app/(dashboard)/admin/schedules/page.tsx`** — Daftar jadwal dengan status badge. Tombol "Terbitkan + WA" untuk jadwal DRAFT (call `POST /api/schedules/[id]/publish`).

**`app/(dashboard)/admin/billing/page.tsx`** — Daftar invoice dengan status, jumlah, tombol buat invoice baru.

**`app/(dashboard)/admin/announcements/page.tsx`** — List pengumuman + form buat baru + toggle published.

Commit: `feat: add admin dashboard pages`

---

### Task 15: Tutor Dashboard Pages

**`app/(dashboard)/tutor/page.tsx`** — Jadwal mendatang tutor. Link ke halaman absensi dan laporan per jadwal.

**`app/(dashboard)/tutor/attendance/[scheduleId]/page.tsx`** — Form absensi batch:
- Fetch siswa di kelas (via `/api/attendance?scheduleId=`)
- Dropdown per siswa: Hadir / Alpha / Sakit / Izin
- Tombol "Simpan Absensi" → POST `/api/attendance`

**`app/(dashboard)/tutor/reports/[scheduleId]/page.tsx`** — Form laporan per siswa:
- Textarea catatan belajar
- Input nilai 0-100
- Tombol upload foto/video (POST ke `/api/media/upload` setelah save report)
- Simpan via POST `/api/reports`

Commit: `feat: add tutor dashboard with attendance and reports`

---

### Task 16: Parent Dashboard Pages

**`app/(dashboard)/parent/page.tsx`** — Kartu per anak: nama, kelas, jumlah laporan, absensi, tagihan pending.

**`app/(dashboard)/parent/progress/page.tsx`** — Laporan belajar anak (bisa filter per anak via `?studentId=`). Tampilkan: tanggal, materi, nilai, catatan tutor, foto/video.

**`app/(dashboard)/parent/schedule/page.tsx`** — Jadwal kelas anak yang sudah PUBLISHED.

**`app/(dashboard)/parent/billing/page.tsx`** — Daftar tagihan + tombol "Bayar Sekarang" yang trigger Midtrans Snap popup (`window.snap.pay(token, {...})`).

Commit: `feat: add parent dashboard with progress, schedule, billing`

---

### Task 17: Prisma Migration & Seed Setup

Jalankan di terminal:
```bash
cd /Users/weka/project/mellyna-education
docker compose up -d postgres
npx prisma migrate dev --name init
npm run db:seed
```

Verifikasi seed berhasil, lalu:
```bash
npm run dev
```

Test login di `http://localhost:3000/login` dengan masing-masing role.

Commit: `feat: verify full app flow works end-to-end`

---

### Task 18: Styling Polish

Pastikan semua halaman:
- Responsive (mobile-friendly)
- Consistent: warna indigo/slate, font Inter
- Sidebar collapse di mobile
- Loading states di setiap fetch
- Error states dengan pesan yang jelas dalam Bahasa Indonesia
- Empty states (jika data kosong)

Commit: `style: polish UI consistency and responsiveness`

---

## Penting

- **JANGAN** commit `.env.local` atau file secrets apapun
- Setiap route API harus cek `getServerSession(authOptions)` dan return 401 jika tidak ada session
- Gunakan Zod untuk validasi semua request body
- Format phone WA: `628xxx@c.us` — gunakan `formatPhoneForWA()` dari `lib/utils.ts` lalu tambahkan `@c.us`
- `sendWhatsApp(phone, message)` sudah ada di `lib/waha.ts` — bisa digunakan langsung jika perlu kirim WA dari Next.js (tapi flow utama via n8n)
- Untuk Midtrans Snap popup di frontend: `window.snap.pay(token, { onSuccess, onError, onClose })`

---

END PROMPT
