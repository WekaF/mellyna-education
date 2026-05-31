# Login Improvement & Reset Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the login page with the Mellyna brand logo, password show/hide toggle, and a full forgot/reset-password flow using token-based email verification.

**Architecture:** Add a `PasswordResetToken` model to Prisma, generate a short-lived token on forgot-password request, email a reset link via nodemailer SMTP, and validate the token on the reset-password page. Login page UI is updated in-place — no new state-management needed.

**Tech Stack:** Next.js 14 App Router, NextAuth v4, Prisma + PostgreSQL, bcryptjs, nodemailer, Tailwind CSS v4 with `me-primary` brand tokens, `next/image` for SVG logos.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `app/(auth)/login/page.tsx` | Replace emoji with logo, add password toggle, add forgot-password link, update button to `bg-me-primary` |
| Create | `app/(auth)/forgot-password/page.tsx` | Email input form → POST `/api/auth/forgot-password` |
| Create | `app/(auth)/reset-password/page.tsx` | New password form → POST `/api/auth/reset-password` (reads `?token=` from URL) |
| Create | `app/api/auth/forgot-password/route.ts` | Generate `PasswordResetToken`, send email |
| Create | `app/api/auth/reset-password/route.ts` | Validate token, hash new password, update user, delete token |
| Create | `lib/email.ts` | Nodemailer transporter + sendPasswordResetEmail helper |
| Modify | `prisma/schema.prisma` | Add `PasswordResetToken` model |

---

## Task 1: Add PasswordResetToken to Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Auto-generate: `prisma/migrations/...`

- [ ] **Step 1: Add model to schema**

Open `prisma/schema.prisma`. After the `VerificationToken` model (line ~240), add:

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expires   DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Also add the relation field to the `User` model (inside `model User { ... }`), after the `sessions` field:

```prisma
  passwordResetTokens PasswordResetToken[]
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_password_reset_token
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client (v...)` with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add PasswordResetToken model to schema"
```

---

## Task 2: Install nodemailer and Create Email Utility

**Files:**
- Create: `lib/email.ts`

- [ ] **Step 1: Install nodemailer**

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

Expected: `added N packages` with no errors.

- [ ] **Step 2: Add SMTP env vars to `.env`**

Add these lines to your `.env` file (do NOT commit `.env`):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Mellyna Education <noreply@mellyna.id>"
NEXTAUTH_URL=http://localhost:3000
```

> **Note:** For Gmail, use an App Password (Google Account → Security → 2-Step Verification → App passwords). For production, use the actual domain in `NEXTAUTH_URL`.

- [ ] **Step 3: Create `lib/email.ts`**

```typescript
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Reset Kata Sandi - Mellyna Education',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f8fafc; border-radius: 12px;">
        <img src="${process.env.NEXTAUTH_URL}/icons/mellyna-logo-primary.svg" alt="Mellyna Education" width="160" style="margin-bottom: 24px;" />
        <h2 style="color: #1A56DB; margin-bottom: 8px;">Reset Kata Sandi</h2>
        <p style="color: #475569; margin-bottom: 24px;">Hai <strong>${name}</strong>, kami menerima permintaan untuk mereset kata sandi akun Mellyna Education kamu.</p>
        <a href="${resetUrl}" style="display: inline-block; background: #1A56DB; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 24px;">
          Reset Kata Sandi
        </a>
        <p style="color: #94a3b8; font-size: 13px;">Link ini berlaku selama <strong>1 jam</strong>. Jika kamu tidak meminta reset kata sandi, abaikan email ini.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #cbd5e1; font-size: 12px;">© ${new Date().getFullYear()} Mellyna Education. All rights reserved.</p>
      </div>
    `,
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/email.ts package.json package-lock.json
git commit -m "feat: add email utility with nodemailer SMTP transport"
```

---

## Task 3: Create Forgot-Password API Route

**Files:**
- Create: `app/api/auth/forgot-password/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email tidak valid.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  // Always return success to prevent email enumeration
  if (!user) {
    return NextResponse.json({ message: 'Jika email terdaftar, link reset akan dikirim.' })
  }

  // Delete any existing tokens for this user
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })

  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.passwordResetToken.create({
    data: { token, userId: user.id, expires },
  })

  await sendPasswordResetEmail(user.email, user.name, token)

  return NextResponse.json({ message: 'Jika email terdaftar, link reset akan dikirim.' })
}
```

- [ ] **Step 2: Verify route resolves at correct path**

Start dev server (`npm run dev`) and test with curl:

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "nonexistent@test.com"}'
```

Expected: `{"message":"Jika email terdaftar, link reset akan dikirim."}`

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/forgot-password/route.ts
git commit -m "feat: add forgot-password API route with token generation"
```

---

## Task 4: Create Reset-Password API Route

**Files:**
- Create: `app/api/auth/reset-password/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()

  if (!token || !password || typeof token !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Kata sandi minimal 8 karakter.' }, { status: 400 })
  }

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } })

  if (!resetToken || resetToken.expires < new Date()) {
    return NextResponse.json(
      { error: 'Link reset tidak valid atau sudah kedaluwarsa.' },
      { status: 400 }
    )
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  await prisma.user.update({
    where: { id: resetToken.userId },
    data: { password: hashedPassword },
  })

  await prisma.passwordResetToken.delete({ where: { token } })

  return NextResponse.json({ message: 'Kata sandi berhasil diubah.' })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/auth/reset-password/route.ts
git commit -m "feat: add reset-password API route with token validation"
```

---

## Task 5: Update Login Page

**Files:**
- Modify: `app/(auth)/login/page.tsx`

Replace the entire file content:

- [ ] **Step 1: Rewrite login page**

```typescript
'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (res?.error) {
        setError('Email atau password salah. Silakan coba lagi.')
        setIsLoading(false)
      } else {
        router.replace('/')
        router.refresh()
      }
    } catch (err) {
      console.error(err)
      setError('Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.')
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-radial from-slate-50 to-indigo-50/60 dark:from-[#151f32] dark:to-[#0f172a] p-4 sm:p-6 lg:p-8 transition-colors duration-300">
      <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#1e293b]/60 dark:backdrop-blur-md p-8 shadow-xl transition-all duration-300 hover:shadow-2xl border border-slate-100 dark:border-slate-800/40 text-slate-800 dark:text-white">

        {/* Header/Logo Section */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1A56DB]/5 dark:bg-[#1A56DB]/10 shadow-sm border border-[#1A56DB]/10 dark:border-[#1A56DB]/20">
              <Image
                src="/icons/mellyna-icon-192.svg"
                alt="Mellyna Education"
                width={48}
                height={48}
                priority
              />
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
            Mellyna Education
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Platform Bimbingan Belajar Anak Terpercaya
          </p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="mt-6 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/10">
            <span className="text-base font-semibold">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Alamat Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              disabled={isLoading}
              className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/35 px-4 py-3 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all focus:border-[#1A56DB] dark:focus:border-[#2B6EF5] focus:bg-white dark:focus:bg-[#151f32]/50 focus:ring-2 focus:ring-[#1A56DB]/10 disabled:opacity-50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Kata Sandi
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[#1A56DB] hover:text-[#2B6EF5] dark:text-[#2B6EF5] dark:hover:text-[#1A56DB] font-medium transition-colors"
              >
                Lupa password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/35 px-4 py-3 pr-12 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all focus:border-[#1A56DB] dark:focus:border-[#2B6EF5] focus:bg-white dark:focus:bg-[#151f32]/50 focus:ring-2 focus:ring-[#1A56DB]/10 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={isLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:pointer-events-none"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="relative flex w-full justify-center rounded-xl bg-[#1A56DB] px-4 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#0C1A5C] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:ring-offset-2 disabled:bg-[#1A56DB]/50 cursor-pointer active:scale-95 disabled:pointer-events-none"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 animate-spin text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Memproses...</span>
              </div>
            ) : (
              <span>Masuk</span>
            )}
          </button>
        </form>

        {/* Footer Info */}
        <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          &copy; {new Date().getFullYear()} Mellyna Education. All rights reserved.
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify page loads in browser**

Open `http://localhost:3000/login`. Check:
- Mellyna owl icon shows in the rounded container
- Password field has eye toggle button on the right
- "Lupa password?" link appears above the password field on the right
- Login button is brand blue (#1A56DB), not indigo
- Eye button toggles `type="password"` ↔ `type="text"`

- [ ] **Step 3: Commit**

```bash
git add app/(auth)/login/page.tsx
git commit -m "feat: update login page with Mellyna icon, password toggle, and forgot-password link"
```

---

## Task 6: Create Forgot-Password Page

**Files:**
- Create: `app/(auth)/forgot-password/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setMessage(null)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus('error')
        setMessage(data.error ?? 'Terjadi kesalahan. Coba lagi.')
      } else {
        setStatus('success')
        setMessage(data.message)
      }
    } catch {
      setStatus('error')
      setMessage('Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-radial from-slate-50 to-indigo-50/60 dark:from-[#151f32] dark:to-[#0f172a] p-4 sm:p-6 lg:p-8 transition-colors duration-300">
      <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#1e293b]/60 dark:backdrop-blur-md p-8 shadow-xl transition-all duration-300 hover:shadow-2xl border border-slate-100 dark:border-slate-800/40 text-slate-800 dark:text-white">

        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1A56DB]/5 dark:bg-[#1A56DB]/10 shadow-sm border border-[#1A56DB]/10 dark:border-[#1A56DB]/20">
              <Image
                src="/icons/mellyna-icon-192.svg"
                alt="Mellyna Education"
                width={48}
                height={48}
                priority
              />
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
            Lupa Kata Sandi?
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Masukkan email kamu dan kami akan mengirim link untuk reset kata sandi.
          </p>
        </div>

        {/* Success State */}
        {status === 'success' ? (
          <div className="mt-6">
            <div className="flex flex-col items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-6 text-center border border-emerald-100 dark:border-emerald-500/10">
              <span className="text-3xl">📧</span>
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{message}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Periksa folder spam jika email tidak masuk dalam beberapa menit.
              </p>
            </div>
            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="text-sm text-[#1A56DB] hover:text-[#2B6EF5] dark:text-[#2B6EF5] font-medium transition-colors"
              >
                ← Kembali ke halaman login
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Error Alert */}
            {status === 'error' && message && (
              <div className="mt-6 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/10">
                <span className="text-base font-semibold">⚠️</span>
                <span>{message}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Alamat Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  disabled={status === 'loading'}
                  className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/35 px-4 py-3 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all focus:border-[#1A56DB] dark:focus:border-[#2B6EF5] focus:bg-white dark:focus:bg-[#151f32]/50 focus:ring-2 focus:ring-[#1A56DB]/10 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="relative flex w-full justify-center rounded-xl bg-[#1A56DB] px-4 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#0C1A5C] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:ring-offset-2 disabled:bg-[#1A56DB]/50 cursor-pointer active:scale-95 disabled:pointer-events-none"
              >
                {status === 'loading' ? (
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Mengirim...</span>
                  </div>
                ) : (
                  <span>Kirim Link Reset</span>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="text-sm text-[#1A56DB] hover:text-[#2B6EF5] dark:text-[#2B6EF5] font-medium transition-colors"
              >
                ← Kembali ke halaman login
              </Link>
            </div>
          </>
        )}

        <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          &copy; {new Date().getFullYear()} Mellyna Education. All rights reserved.
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify page in browser**

Open `http://localhost:3000/forgot-password`. Check:
- Mellyna icon shows
- Email form renders
- After submit with a registered email: success state shows (green box + 📧)
- "Kembali ke halaman login" link works

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/forgot-password/page.tsx"
git commit -m "feat: add forgot-password page"
```

---

## Task 7: Create Reset-Password Page

**Files:**
- Create: `app/(auth)/reset-password/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
'use client'

import React, { useState, Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  if (!token) {
    return (
      <div className="mt-6 flex flex-col items-center gap-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 p-6 text-center border border-rose-100 dark:border-rose-500/10">
        <span className="text-3xl">⚠️</span>
        <p className="text-sm text-rose-600 dark:text-rose-400 font-medium">
          Link reset tidak valid. Silakan minta link baru.
        </p>
        <Link
          href="/forgot-password"
          className="text-sm text-[#1A56DB] hover:text-[#2B6EF5] font-medium transition-colors"
        >
          Kirim ulang link reset
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (password !== confirm) {
      setStatus('error')
      setMessage('Konfirmasi kata sandi tidak cocok.')
      return
    }

    if (password.length < 8) {
      setStatus('error')
      setMessage('Kata sandi minimal 8 karakter.')
      return
    }

    setStatus('loading')

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus('error')
        setMessage(data.error ?? 'Terjadi kesalahan. Coba lagi.')
      } else {
        setStatus('success')
        setMessage(data.message)
        setTimeout(() => router.push('/login'), 2500)
      }
    } catch {
      setStatus('error')
      setMessage('Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.')
    }
  }

  return (
    <>
      {status === 'success' ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-6 text-center border border-emerald-100 dark:border-emerald-500/10">
          <span className="text-3xl">✅</span>
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{message}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mengarahkan ke halaman login...
          </p>
        </div>
      ) : (
        <>
          {status === 'error' && message && (
            <div className="mt-6 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/10">
              <span className="text-base font-semibold">⚠️</span>
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Kata Sandi Baru
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  disabled={status === 'loading'}
                  className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/35 px-4 py-3 pr-12 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all focus:border-[#1A56DB] dark:focus:border-[#2B6EF5] focus:bg-white dark:focus:bg-[#151f32]/50 focus:ring-2 focus:ring-[#1A56DB]/10 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={status === 'loading'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:pointer-events-none"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Konfirmasi Kata Sandi
              </label>
              <div className="relative">
                <input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  disabled={status === 'loading'}
                  className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/35 px-4 py-3 pr-12 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all focus:border-[#1A56DB] dark:focus:border-[#2B6EF5] focus:bg-white dark:focus:bg-[#151f32]/50 focus:ring-2 focus:ring-[#1A56DB]/10 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  disabled={status === 'loading'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:pointer-events-none"
                  aria-label={showConfirm ? 'Sembunyikan konfirmasi' : 'Tampilkan konfirmasi'}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="relative flex w-full justify-center rounded-xl bg-[#1A56DB] px-4 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#0C1A5C] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:ring-offset-2 disabled:bg-[#1A56DB]/50 cursor-pointer active:scale-95 disabled:pointer-events-none"
            >
              {status === 'loading' ? (
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Memproses...</span>
                </div>
              ) : (
                <span>Ubah Kata Sandi</span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm text-[#1A56DB] hover:text-[#2B6EF5] dark:text-[#2B6EF5] font-medium transition-colors"
            >
              ← Kembali ke halaman login
            </Link>
          </div>
        </>
      )}
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-radial from-slate-50 to-indigo-50/60 dark:from-[#151f32] dark:to-[#0f172a] p-4 sm:p-6 lg:p-8 transition-colors duration-300">
      <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#1e293b]/60 dark:backdrop-blur-md p-8 shadow-xl transition-all duration-300 hover:shadow-2xl border border-slate-100 dark:border-slate-800/40 text-slate-800 dark:text-white">

        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1A56DB]/5 dark:bg-[#1A56DB]/10 shadow-sm border border-[#1A56DB]/10 dark:border-[#1A56DB]/20">
              <Image
                src="/icons/mellyna-icon-192.svg"
                alt="Mellyna Education"
                width={48}
                height={48}
                priority
              />
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
            Buat Kata Sandi Baru
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Masukkan kata sandi baru untuk akun kamu.
          </p>
        </div>

        <Suspense fallback={<div className="mt-6 text-center text-slate-400">Memuat...</div>}>
          <ResetPasswordForm />
        </Suspense>

        <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          &copy; {new Date().getFullYear()} Mellyna Education. All rights reserved.
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify page in browser**

Get a valid reset token from the DB after triggering forgot-password:
```sql
SELECT token FROM "PasswordResetToken" LIMIT 1;
```

Open `http://localhost:3000/reset-password?token=<that-token>`. Check:
- Both password fields show with eye toggles
- Mismatched passwords show error
- Valid submission shows success + redirects to `/login` after 2.5s
- Missing/invalid `?token` shows the "link tidak valid" error state

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/reset-password/page.tsx"
git commit -m "feat: add reset-password page with token validation and password toggle"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Mellyna icon on login page → Task 5
- [x] Password show/hide toggle on login → Task 5
- [x] "Lupa password?" link on login → Task 5
- [x] Forgot-password page → Task 6
- [x] Reset-password page → Task 7
- [x] Forgot-password API (generate token, send email) → Task 3
- [x] Reset-password API (validate token, update password) → Task 4
- [x] Brand button color updated to `#1A56DB` → Task 5, 6, 7

**Type consistency:**
- `PasswordResetToken` model fields: `id`, `token`, `userId`, `expires`, `createdAt` — consistent across schema (Task 1), forgot-password route (Task 3), and reset-password route (Task 4).
- `sendPasswordResetEmail(email: string, name: string, token: string)` — defined in Task 2, called in Task 3.

**No placeholders:** All tasks contain complete code.
