# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a public-facing landing page at `/` that shows when users are not authenticated, with modern design, smooth scroll animations, and full pricing information — then redirects authenticated users to their role-based dashboard.

**Architecture:** Modify `app/page.tsx` to render `<LandingPage />` for unauthenticated visitors and redirect to dashboard for authenticated users. Landing page is composed of focused section components under `components/marketing/`. Pricing data is extracted to `lib/constants/pricing.ts` as a single source of truth shared between the admin pricing editor and the landing page.

**Tech Stack:** Next.js 15 App Router, React 19, Framer Motion (new install), Tailwind CSS v4, Lucide React, Outfit font (already set in globals.css).

**Key constraint:** `globals.css` has `.dark main .bg-white { ... !important }` overrides scoped to dashboard. Landing page wrapper must be `<div>` not `<main>` to avoid those overrides leaking into the public page.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `lib/constants/pricing.ts` | Shared pricing data types + defaults |
| Modify | `app/(dashboard)/admin/pricing/page.tsx` | Import defaults from shared constants |
| Create | `components/marketing/Navbar.tsx` | Sticky nav, transparent→solid on scroll |
| Create | `components/marketing/HeroSection.tsx` | Full-screen hero with floating elements |
| Create | `components/marketing/StatsSection.tsx` | 4 stat counters |
| Create | `components/marketing/ProgramsSection.tsx` | 6 program cards grid |
| Create | `components/marketing/HowItWorksSection.tsx` | 3-step process |
| Create | `components/marketing/PricingSection.tsx` | SPP tiers + admin fees from shared constants |
| Create | `components/marketing/CTASection.tsx` | Final CTA section |
| Create | `components/marketing/Footer.tsx` | Footer with links + contact |
| Create | `components/marketing/LandingPage.tsx` | Orchestrator — imports all sections |
| Modify | `app/page.tsx` | Show LandingPage or redirect |
| Modify | `app/globals.css` | Add `scroll-behavior: smooth` |

---

## Task 1: Install framer-motion

**Files:**
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Install dependency**

```bash
pnpm add framer-motion
```

Expected output: `+ framer-motion X.X.X` in the install summary.

- [ ] **Step 2: Verify**

```bash
pnpm list framer-motion
```

Expected: version listed under dependencies.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add framer-motion for landing page animations"
```

---

## Task 2: Extract shared pricing constants

**Files:**
- Create: `lib/constants/pricing.ts`
- Modify: `app/(dashboard)/admin/pricing/page.tsx:7-104`

- [ ] **Step 1: Create shared pricing types and defaults**

Create `lib/constants/pricing.ts`:

```typescript
export interface SppTier {
  name: string
  price: number
  period: string
  desc: string
  badge: string | null
  features: string[]
}

export interface AdminFee {
  name: string
  price: number
  period: string
  desc: string
  features: string[]
}

export const defaultSppTiers: SppTier[] = [
  {
    name: 'Tingkat 1',
    price: 150000,
    period: '/bulan',
    desc: 'Untuk pemula dan level dasar materi bimbingan.',
    badge: 'Terpopuler',
    features: [
      'Bimbingan materi dasar terpadu',
      '8-12 sesi bimbingan interaktif per bulan',
      'Laporan progres belajar bulanan',
      'Notifikasi kehadiran & laporan via WhatsApp',
      'Konsultasi berkala orang tua & tutor',
    ],
  },
  {
    name: 'Tingkat 2',
    price: 160000,
    period: '/bulan',
    desc: 'Untuk level pemantapan bimbingan tingkat menengah.',
    badge: null,
    features: [
      'Bimbingan pemantapan tingkat lanjut',
      '8-12 sesi bimbingan interaktif per bulan',
      'Laporan progres belajar bulanan lengkap',
      'Notifikasi kehadiran & laporan via WhatsApp',
      'Konsultasi berkala orang tua & tutor',
    ],
  },
  {
    name: 'Tingkat 3',
    price: 170000,
    period: '/bulan',
    desc: 'Untuk level mahir dan bimbingan akselerasi 1.',
    badge: null,
    features: [
      'Bimbingan akselerasi tingkat tinggi',
      '8-12 sesi bimbingan intensif per bulan',
      'Laporan progres belajar bulanan mendalam',
      'Notifikasi kehadiran & laporan via WhatsApp',
      'Konsultasi berkala orang tua & tutor',
    ],
  },
  {
    name: 'Tingkat 4',
    price: 180000,
    period: '/bulan',
    desc: 'Level bimbingan tingkat tertinggi & modul akselerasi 2.',
    badge: 'Termaju',
    features: [
      'Bimbingan tingkat tertinggi / advance',
      '8-12 sesi bimbingan intensif per bulan',
      'Laporan progres belajar bulanan mendalam',
      'Notifikasi kehadiran & laporan via WhatsApp',
      'Konsultasi berkala orang tua & tutor',
      'Ujian kompetensi kelulusan tingkat gratis',
    ],
  },
]

export const defaultAdminFees: AdminFee[] = [
  {
    name: 'Paket Registrasi Baru',
    price: 400000,
    period: 'sekali bayar',
    desc: 'Paket pendaftaran lengkap bagi siswa baru yang baru bergabung.',
    features: [
      'Sudah TERMASUK SPP bulan pertama (Diskon subsidi Rp135.000)',
      'Sudah TERMASUK buku modul bimbingan awal',
      'Sudah TERMASUK tas & atribut bimbel Mellyna Education',
      'Biaya administrasi pendaftaran siswa',
    ],
  },
  {
    name: 'Kenaikan Tingkat',
    price: 120000,
    period: 'per naik level',
    desc: 'Biaya kenaikan jenjang tingkat belajar di bimbel.',
    features: [
      'Buku modul tingkat baru lengkap',
      'Biaya ujian sertifikasi kenaikan tingkat',
      'Sertifikat kelulusan level resmi',
      'Pembaruan media & alat peraga bimbingan',
    ],
  },
]
```

- [ ] **Step 2: Update admin pricing page to use shared constants**

In `app/(dashboard)/admin/pricing/page.tsx`, replace the local `monthlyTiers` and `adminFees` declarations (lines 7–104) with imports + style-extended versions.

Replace lines 7–104 (the two `const` declarations) with:

```typescript
import { defaultSppTiers, defaultAdminFees } from '@/lib/constants/pricing'
import { UserPlus, Award, BookOpen } from 'lucide-react'

const tierVisuals = [
  {
    color: 'border-emerald-200 hover:border-emerald-400 dark:border-emerald-900/40 dark:hover:border-emerald-500/50',
    iconColor: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400',
  },
  {
    color: 'border-indigo-200 hover:border-indigo-400 dark:border-indigo-900/40 dark:hover:border-indigo-500/50',
    iconColor: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400',
  },
  {
    color: 'border-violet-200 hover:border-violet-400 dark:border-violet-900/40 dark:hover:border-violet-500/50',
    iconColor: 'bg-violet-50 text-violet-600 dark:bg-violet-950/20 dark:text-violet-400',
  },
  {
    color: 'border-amber-200 hover:border-amber-400 dark:border-amber-900/40 dark:hover:border-amber-500/50',
    iconColor: 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400',
  },
]

const feeVisuals = [
  {
    icon: UserPlus,
    color: 'border-indigo-200 bg-indigo-50/20 dark:border-indigo-900/40 dark:bg-indigo-950/10',
  },
  {
    icon: Award,
    color: 'border-amber-200 bg-amber-50/20 dark:border-amber-900/40 dark:bg-amber-950/10',
  },
]

const monthlyTiers = defaultSppTiers.map((tier, i) => ({ ...tier, ...tierVisuals[i] }))
const adminFees = defaultAdminFees.map((fee, i) => ({ ...fee, ...feeVisuals[i] }))
```

Also remove `UserPlus, Award` from the existing import at line 4 (they're moved to the new import block above). Keep the rest of the file unchanged.

- [ ] **Step 3: Verify admin pricing page still works**

```bash
rtk tsc --noEmit
```

Expected: 0 errors related to pricing page.

- [ ] **Step 4: Commit**

```bash
git add lib/constants/pricing.ts app/(dashboard)/admin/pricing/page.tsx
git commit -m "refactor: extract pricing defaults to shared constants"
```

---

## Task 3: Create Navbar

**Files:**
- Create: `components/marketing/Navbar.tsx`

- [ ] **Step 1: Create Navbar component**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { BookOpen, Menu, X } from 'lucide-react'

const navLinks = [
  { label: 'Program', href: '#program' },
  { label: 'Cara Kerja', href: '#cara-kerja' },
  { label: 'Harga', href: '#harga' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-md shadow-lg border-b border-slate-200/60'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md group-hover:shadow-indigo-400/40 transition-shadow">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <span className={`font-black text-base tracking-tight transition-colors duration-300 ${scrolled ? 'text-slate-900' : 'text-white'}`}>
              Mellyna <span className={scrolled ? 'text-indigo-600' : 'text-indigo-300'}>Education</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`text-sm font-semibold transition-colors duration-200 hover:text-indigo-500 ${
                  scrolled ? 'text-slate-600' : 'text-white/80'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 ${
                scrolled
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              Masuk
            </Link>
            <Link
              href="/login"
              className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-200"
            >
              Portal Orang Tua
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`md:hidden p-2 rounded-lg transition-colors ${
              scrolled ? 'text-slate-700 hover:bg-slate-100' : 'text-white hover:bg-white/10'
            }`}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden bg-white border-b border-slate-100 shadow-lg"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 text-sm font-semibold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-3 border-t border-slate-100 mt-2">
                <Link
                  href="/login"
                  className="block w-full text-center px-5 py-3 text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl"
                  onClick={() => setMobileOpen(false)}
                >
                  Masuk ke Portal
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
```

---

## Task 4: Create HeroSection

**Files:**
- Create: `components/marketing/HeroSection.tsx`

- [ ] **Step 1: Create HeroSection component**

```tsx
'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Star, Users, Trophy, Sparkles } from 'lucide-react'

const floatingCards = [
  { icon: Star, text: '4.9/5 Rating Orang Tua', color: 'text-yellow-400', pos: 'top-32 left-8 lg:left-24', delay: 0 },
  { icon: Users, text: '500+ Siswa Aktif', color: 'text-emerald-400', pos: 'bottom-40 right-8 lg:right-24', delay: 1 },
  { icon: Trophy, text: 'Bimbel Terpercaya', color: 'text-amber-400', pos: 'top-48 right-12 lg:right-40 hidden lg:flex', delay: 2 },
]

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Floating cards */}
      {floatingCards.map((card, i) => (
        <motion.div
          key={card.text}
          className={`absolute hidden md:flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 text-white text-xs font-bold shadow-xl ${card.pos}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: [0, -10, 0] }}
          transition={{
            opacity: { delay: 0.8 + i * 0.2, duration: 0.5 },
            y: { delay: card.delay, duration: 3 + i * 0.5, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <card.icon className={`h-4 w-4 ${card.color}`} fill="currentColor" />
          <span>{card.text}</span>
        </motion.div>
      ))}

      {/* Main content */}
      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto pt-20">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-bold mb-6 backdrop-blur-sm"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Mellyna Education — Bimbingan Belajar Modern
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[1.1] mb-6"
        >
          Wujudkan{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Prestasi Terbaik
          </span>
          <br />
          Anak Anda
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Platform bimbingan belajar dengan program SEMPOA, English, Calistung, dan banyak lagi.
          Laporan progres real-time langsung ke WhatsApp orang tua.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/login"
            className="group flex items-center gap-2 px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1 transition-all duration-300"
          >
            Mulai Sekarang
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="#harga"
            className="flex items-center gap-2 px-8 py-4 text-base font-bold text-white border border-white/20 rounded-2xl hover:bg-white/10 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1"
          >
            Lihat Paket Harga
          </a>
        </motion.div>

        {/* Social proof row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-6 text-slate-400 text-sm"
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {['bg-indigo-400', 'bg-purple-400', 'bg-pink-400', 'bg-amber-400'].map((color, i) => (
                <div
                  key={i}
                  className={`w-7 h-7 rounded-full ${color} border-2 border-slate-900 flex items-center justify-center text-[9px] font-black text-white`}
                >
                  {['A', 'B', 'C', '+'][i]}
                </div>
              ))}
            </div>
            <span>500+ keluarga bergabung</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-slate-600 hidden sm:block" />
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
            ))}
            <span className="ml-1">4.9 / 5.0</span>
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-500 text-xs"
      >
        <span>Gulir ke bawah</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-5 h-8 rounded-full border-2 border-slate-600 flex items-start justify-center pt-1.5"
        >
          <div className="w-1 h-2 rounded-full bg-slate-500" />
        </motion.div>
      </motion.div>
    </section>
  )
}
```

---

## Task 5: Create StatsSection

**Files:**
- Create: `components/marketing/StatsSection.tsx`

- [ ] **Step 1: Create StatsSection component**

```tsx
'use client'

import { motion } from 'framer-motion'
import { Users, BookOpen, Award, Clock } from 'lucide-react'

const stats = [
  { value: '500+', label: 'Siswa Aktif', icon: Users, bg: 'bg-indigo-50', color: 'text-indigo-600' },
  { value: '20+', label: 'Tutor Berpengalaman', icon: Award, bg: 'bg-emerald-50', color: 'text-emerald-600' },
  { value: '6', label: 'Program Unggulan', icon: BookOpen, bg: 'bg-purple-50', color: 'text-purple-600' },
  { value: '5+', label: 'Tahun Berdiri', icon: Clock, bg: 'bg-amber-50', color: 'text-amber-600' },
]

export default function StatsSection() {
  return (
    <section className="py-16 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="text-center"
            >
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${stat.bg} mb-4`}>
                <stat.icon className={`h-7 w-7 ${stat.color}`} />
              </div>
              <div className="text-3xl font-black text-slate-900 mb-1">{stat.value}</div>
              <div className="text-sm text-slate-500 font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

---

## Task 6: Create ProgramsSection

**Files:**
- Create: `components/marketing/ProgramsSection.tsx`

- [ ] **Step 1: Create ProgramsSection component**

```tsx
'use client'

import { motion } from 'framer-motion'
import { Calculator, BookOpen, Globe, Star, Zap, GraduationCap } from 'lucide-react'

const programs = [
  {
    name: 'SEMPOA',
    desc: 'Berhitung cepat mental aritmetika dengan teknik sempoa. Melatih daya konsentrasi dan kecepatan berpikir anak.',
    icon: Calculator,
    gradient: 'from-indigo-500 to-blue-600',
    shadowColor: 'shadow-indigo-500/25',
    tag: 'Unggulan',
  },
  {
    name: 'Calistung',
    desc: 'Membaca, menulis, dan berhitung untuk anak usia dini. Fondasi kuat untuk jenjang pendidikan selanjutnya.',
    icon: BookOpen,
    gradient: 'from-emerald-500 to-teal-600',
    shadowColor: 'shadow-emerald-500/25',
    tag: null,
  },
  {
    name: 'English For Kids (EFK)',
    desc: 'Program bahasa Inggris interaktif untuk anak. Berbicara, menulis, dan memahami dengan cara menyenangkan.',
    icon: Globe,
    gradient: 'from-purple-500 to-violet-600',
    shadowColor: 'shadow-purple-500/25',
    tag: 'Populer',
  },
  {
    name: 'English Young Learner',
    desc: 'Kurikulum English terstruktur untuk siswa lanjut dengan fokus pada grammar dan percakapan aktif.',
    icon: Star,
    gradient: 'from-amber-500 to-orange-600',
    shadowColor: 'shadow-amber-500/25',
    tag: null,
  },
  {
    name: 'AHE (Aritmatika)',
    desc: 'Aritmatika hitung ekspres untuk meningkatkan kemampuan berhitung dengan cepat dan akurat.',
    icon: Zap,
    gradient: 'from-pink-500 to-rose-600',
    shadowColor: 'shadow-pink-500/25',
    tag: null,
  },
  {
    name: 'English Everyday',
    desc: 'Bahasa Inggris untuk kehidupan sehari-hari. Praktis, komunikatif, dan langsung bisa diterapkan.',
    icon: GraduationCap,
    gradient: 'from-cyan-500 to-sky-600',
    shadowColor: 'shadow-cyan-500/25',
    tag: null,
  },
]

export default function ProgramsSection() {
  return (
    <section id="program" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold mb-4">
            Program Unggulan
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
            Program Bimbingan Pilihan
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Berbagai program bimbingan dirancang untuk mendukung setiap tahap perkembangan belajar anak,
            dipandu tutor berpengalaman bersertifikat.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map((program, index) => (
            <motion.div
              key={program.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.5 }}
              whileHover={{ y: -6 }}
              className="group bg-white rounded-3xl p-6 border border-slate-100 hover:border-indigo-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-default"
            >
              <div className="flex items-start justify-between mb-5">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${program.gradient} flex items-center justify-center shadow-lg ${program.shadowColor}`}>
                  <program.icon className="h-6 w-6 text-white" />
                </div>
                {program.tag && (
                  <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold border border-indigo-100">
                    {program.tag}
                  </span>
                )}
              </div>
              <h3 className="font-black text-lg text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
                {program.name}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">{program.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

---

## Task 7: Create HowItWorksSection

**Files:**
- Create: `components/marketing/HowItWorksSection.tsx`

- [ ] **Step 1: Create HowItWorksSection component**

```tsx
'use client'

import { motion } from 'framer-motion'
import { ClipboardList, BookOpen, TrendingUp } from 'lucide-react'

const steps = [
  {
    number: '01',
    title: 'Daftar & Konsultasi',
    desc: 'Hubungi kami untuk konsultasi gratis. Kami akan membantu memilih program yang paling sesuai untuk anak Anda.',
    icon: ClipboardList,
    gradient: 'from-indigo-500 to-blue-600',
    shadow: 'shadow-indigo-500/25',
  },
  {
    number: '02',
    title: 'Mulai Belajar',
    desc: 'Anak Anda bergabung dengan kelas pilihan, didampingi tutor berpengalaman dengan metode belajar yang menyenangkan.',
    icon: BookOpen,
    gradient: 'from-emerald-500 to-teal-600',
    shadow: 'shadow-emerald-500/25',
  },
  {
    number: '03',
    title: 'Pantau Progres',
    desc: 'Dapatkan laporan perkembangan belajar berkala langsung di WhatsApp. Pantau kemajuan anak Anda kapan saja.',
    icon: TrendingUp,
    gradient: 'from-purple-500 to-violet-600',
    shadow: 'shadow-purple-500/25',
  },
]

export default function HowItWorksSection() {
  return (
    <section id="cara-kerja" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 border border-purple-100 text-purple-600 text-xs font-bold mb-4">
            Cara Kerja
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
            Mudah Bergabung dalam 3 Langkah
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Proses pendaftaran sederhana dan cepat untuk memulai perjalanan belajar anak Anda bersama Mellyna Education.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          {/* Connector line on desktop */}
          <div className="hidden md:block absolute top-10 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-gradient-to-r from-indigo-200 via-emerald-200 to-purple-200" />

          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.5 }}
              className="relative text-center"
            >
              <div className="flex flex-col items-center">
                <div className="relative mb-6 z-10">
                  <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-xl ${step.shadow}`}>
                    <step.icon className="h-9 w-9 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border-2 border-slate-100 shadow-sm flex items-center justify-center text-[10px] font-black text-slate-500">
                    {step.number}
                  </span>
                </div>
                <h3 className="font-black text-xl text-slate-900 mb-3">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

---

## Task 8: Create PricingSection

**Files:**
- Create: `components/marketing/PricingSection.tsx`

- [ ] **Step 1: Create PricingSection component**

```tsx
'use client'

import { motion } from 'framer-motion'
import { Check, Star, UserPlus, Award } from 'lucide-react'
import { defaultSppTiers, defaultAdminFees } from '@/lib/constants/pricing'
import { formatRupiah } from '@/lib/utils'

const tierStyles = [
  { gradient: 'from-emerald-500 to-teal-600', ring: 'ring-2 ring-emerald-200', badgeBg: 'from-emerald-500 to-teal-600', cta: 'from-emerald-500 to-teal-600' },
  { gradient: 'from-indigo-500 to-blue-600', ring: '', badgeBg: '', cta: 'from-indigo-500 to-blue-600' },
  { gradient: 'from-violet-500 to-purple-600', ring: '', badgeBg: '', cta: 'from-violet-500 to-purple-600' },
  { gradient: 'from-amber-500 to-orange-600', ring: 'ring-2 ring-amber-200', badgeBg: 'from-amber-500 to-orange-600', cta: 'from-amber-500 to-orange-600' },
]

const feeIcons = [UserPlus, Award]
const feeBgs = [
  'bg-indigo-50 border-indigo-100',
  'bg-amber-50 border-amber-100',
]
const feeIconBgs = [
  'from-indigo-500 to-blue-600',
  'from-amber-500 to-orange-600',
]

export default function PricingSection() {
  return (
    <section id="harga" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold mb-4">
            Paket Harga
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
            Harga Transparan, Tanpa Biaya Tersembunyi
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Pilih tingkat bimbingan yang sesuai dengan kebutuhan dan perkembangan anak Anda.
          </p>
        </motion.div>

        {/* SPP label */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-8"
        >
          SPP Bulanan
        </motion.p>

        {/* SPP Tier cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
          {defaultSppTiers.map((tier, index) => {
            const styles = tierStyles[index]
            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{ y: -6, scale: 1.02 }}
                className={`relative bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-300 ${styles.ring}`}
              >
                {tier.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r ${styles.badgeBg} text-white text-[10px] font-black uppercase tracking-wide shadow-md whitespace-nowrap`}>
                    {tier.badge}
                  </div>
                )}

                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${styles.gradient} flex items-center justify-center shadow-md mb-4`}>
                  <Star className="h-5 w-5 text-white fill-white" />
                </div>

                <h3 className="font-black text-base text-slate-900 mb-1">{tier.name}</h3>
                <p className="text-xs text-slate-500 mb-4 min-h-[32px] leading-relaxed">{tier.desc}</p>

                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-2xl font-black text-slate-900">{formatRupiah(tier.price)}</span>
                  <span className="text-xs text-slate-400 font-medium">{tier.period}</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-slate-600">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="#contact"
                  className={`block w-full text-center py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r ${styles.cta} text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`}
                >
                  Daftar Sekarang
                </a>
              </motion.div>
            )
          })}
        </div>

        {/* Admin fees label */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-8"
        >
          Biaya Pendaftaran & Kenaikan Tingkat
        </motion.p>

        {/* Admin fee cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {defaultAdminFees.map((fee, index) => {
            const Icon = feeIcons[index]
            return (
              <motion.div
                key={fee.name}
                initial={{ opacity: 0, x: index === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + index * 0.1, duration: 0.5 }}
                className={`bg-white rounded-3xl p-7 border shadow-sm hover:shadow-lg transition-all duration-300 ${feeBgs[index]}`}
              >
                <div className="flex items-start gap-4 mb-5">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${feeIconBgs[index]} flex items-center justify-center shadow-md shrink-0`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-black text-lg text-slate-900">{fee.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{fee.desc}</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 mb-5 border-b border-slate-100 pb-5">
                  <span className="text-3xl font-black text-slate-900">{formatRupiah(fee.price)}</span>
                  <span className="text-xs text-slate-400 font-medium">/ {fee.period}</span>
                </div>
                <ul className="space-y-2">
                  {fee.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span className={f.includes('TERMASUK') ? 'font-bold text-slate-800' : ''}>{f}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

---

## Task 9: Create CTASection

**Files:**
- Create: `components/marketing/CTASection.tsx`

- [ ] **Step 1: Create CTASection component**

```tsx
'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, MessageCircle } from 'lucide-react'

export default function CTASection() {
  return (
    <section id="contact" className="py-24 bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-bold mb-6">
            Siap Bergabung?
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight">
            Bergabunglah dengan{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              500+ Keluarga
            </span>{' '}
            Mellyna Education
          </h2>
          <p className="text-slate-300 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            Mulai perjalanan belajar anak Anda hari ini. Konsultasi pertama gratis, tanpa komitmen.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="group flex items-center gap-2 px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1 transition-all duration-300"
            >
              Masuk ke Portal
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#program"
              className="flex items-center gap-2 px-8 py-4 text-base font-bold text-white border border-white/20 rounded-2xl hover:bg-white/10 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1"
            >
              <MessageCircle className="h-5 w-5 text-emerald-400" />
              Lihat Program Kami
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
```

---

## Task 10: Create Footer

**Files:**
- Create: `components/marketing/Footer.tsx`

- [ ] **Step 1: Create Footer component**

```tsx
import Link from 'next/link'
import { BookOpen, MapPin, Phone, Mail } from 'lucide-react'

const programs = ['SEMPOA', 'Calistung', 'English For Kids', 'AHE', 'English Everyday']

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md group-hover:shadow-indigo-500/30 transition-shadow">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <span className="font-black text-lg text-white">
                Mellyna <span className="text-indigo-400">Education</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed max-w-sm">
              Bimbingan belajar terpercaya untuk mendampingi anak meraih prestasi terbaik
              dengan program unggulan dan tutor berpengalaman bersertifikat.
            </p>
          </div>

          {/* Programs */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4">Program</h4>
            <ul className="space-y-2.5 text-sm">
              {programs.map((p) => (
                <li key={p}>
                  <a href="#program" className="hover:text-white transition-colors duration-200">
                    {p}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4">Kontak</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-indigo-400" />
                <span>Mellyna Education, Indonesia</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-emerald-400" />
                <span>Hubungi via WhatsApp</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-blue-400" />
                <span>info@mellyna.id</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs">© {new Date().getFullYear()} Mellyna Education. Hak cipta dilindungi.</p>
          <div className="flex items-center gap-6 text-xs">
            <a href="#" className="hover:text-white transition-colors">Kebijakan Privasi</a>
            <a href="#" className="hover:text-white transition-colors">Syarat & Ketentuan</a>
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors font-bold">
              Portal Login →
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
```

---

## Task 11: Create LandingPage orchestrator

**Files:**
- Create: `components/marketing/LandingPage.tsx`

- [ ] **Step 1: Create LandingPage component**

Note: Use `<div>` not `<main>` — globals.css has `.dark main` scoped overrides that would interfere with landing page light sections.

```tsx
import Navbar from './Navbar'
import HeroSection from './HeroSection'
import StatsSection from './StatsSection'
import ProgramsSection from './ProgramsSection'
import HowItWorksSection from './HowItWorksSection'
import PricingSection from './PricingSection'
import CTASection from './CTASection'
import Footer from './Footer'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <StatsSection />
      <ProgramsSection />
      <HowItWorksSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  )
}
```

---

## Task 12: Add smooth scroll + modify app/page.tsx

**Files:**
- Modify: `app/globals.css`
- Modify: `app/page.tsx`

- [ ] **Step 1: Add smooth scroll to globals.css**

Add after the `@import "tailwindcss";` line:

```css
html {
  scroll-behavior: smooth;
}
```

- [ ] **Step 2: Modify app/page.tsx**

Replace the entire contents of `app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import LandingPage from '@/components/marketing/LandingPage'

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (!session) return <LandingPage />

  const role = (session.user as any).role
  if (role === 'SUPER_ADMIN') redirect('/admin')
  if (role === 'TUTOR') redirect('/tutor')
  redirect('/parent')
}
```

- [ ] **Step 3: Type-check**

```bash
rtk tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/globals.css components/marketing/
git commit -m "feat: add public landing page with pricing, programs, and smooth animations"
```

---

## Task 13: Visual verification

**Files:** None (testing only)

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Check these scenarios in browser**

Open `http://localhost:3000` in an incognito window (no session).

Verify:
1. Landing page renders — hero, stats, programs, how-it-works, pricing, CTA, footer
2. Navbar starts transparent over hero; becomes white+shadow after scrolling ~30px
3. Hero headline and CTAs animate in on load (fade-up)
4. Program cards, stats, pricing sections animate when scrolled into view
5. Smooth scroll when clicking nav links (#program, #harga, #cara-kerja)
6. Mobile menu works: tap hamburger → menu opens; tap link → closes
7. "Masuk" and "Portal Orang Tua" links navigate to `/login`
8. "Daftar Sekarang" on pricing cards navigates to `#contact`

- [ ] **Step 3: Verify authenticated redirect still works**

Log in as admin, navigate to `/`. Confirm redirect to `/admin`.

- [ ] **Step 4: Verify admin pricing page unchanged**

Navigate to `/admin/pricing`. Confirm all 4 SPP tiers and 2 admin fee cards display correctly with the same data as before. Edit a tier price, save — confirm localStorage persistence still works.

---

## Self-Review

**Spec coverage check:**
- ✅ Landing page at `/` for unauthenticated users
- ✅ Routing: authenticated → role dashboard, unauthenticated → landing page
- ✅ Pricing displayed (SPP tiers + admin fees from shared constants)
- ✅ Modern design (gradient hero, glassmorphism float cards, smooth card hovers)
- ✅ Smooth animations (Framer Motion `whileInView`, spring transitions, floating elements)
- ✅ Mobile responsive (hamburger menu, grid → single column on sm)
- ✅ Navbar UX (transparent → solid on scroll)
- ✅ Dark mode globals.css conflict avoided (`<div>` wrapper not `<main>`)

**Placeholder scan:** No TBD/TODO. All code is complete.

**Type consistency:**
- `defaultSppTiers` (type `SppTier[]`) used in both `PricingSection` and admin page
- `defaultAdminFees` (type `AdminFee[]`) used in both
- `formatRupiah` imported from `@/lib/utils` — exists at `lib/utils.ts`
- All Framer Motion `motion.div` props use valid `initial/animate/whileInView` patterns
