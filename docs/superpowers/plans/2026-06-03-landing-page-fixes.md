# Landing Page Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync admin pricing to landing page, add phone contact info, and merge two login buttons into one.

**Architecture:** Three independent UI fixes — (1) make PricingSection a client component that reads localStorage (same keys the admin page writes), falling back to constants; (2) add phone number +62 857-3100-8212 as a WhatsApp link in LocationSection and Footer; (3) remove the redundant "Portal Orang Tua" button from Navbar, keeping only "Masuk".

**Tech Stack:** Next.js 14 App Router, React client components, Tailwind CSS, localStorage for pricing persistence.

---

## Root Cause: Why Pricing Doesn't Show

`PricingSection.tsx` imports `defaultSppTiers` and `defaultAdminFees` directly from `@/lib/constants/pricing` at build time. The admin pricing page (`/admin/pricing`) saves edits to `localStorage` keys `mellyna_spp_tiers` and `mellyna_admin_fees` — but nothing ever reads those keys in the landing page. The fix is to make `PricingSection` a client component that reads from localStorage on mount, falling back to the defaults.

---

## Task 1: Fix PricingSection to Read Admin-Saved Pricing

**Files:**
- Modify: `components/marketing/PricingSection.tsx`

- [ ] **Step 1: Add useState/useEffect imports and pricing state**

Replace the top of the file:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, Star, UserPlus, Award } from 'lucide-react'
import { defaultSppTiers, defaultAdminFees, SppTier, AdminFee } from '@/lib/constants/pricing'
import { formatRupiah } from '@/lib/utils'
```

- [ ] **Step 2: Add state inside the component function**

Replace the function signature line:

```tsx
export default function PricingSection() {
  const [sppTiers, setSppTiers] = useState<SppTier[]>(defaultSppTiers)
  const [adminFees, setAdminFees] = useState<AdminFee[]>(defaultAdminFees)

  useEffect(() => {
    const savedSpp = localStorage.getItem('mellyna_spp_tiers')
    if (savedSpp) {
      try { setSppTiers(JSON.parse(savedSpp)) } catch {}
    }
    const savedFees = localStorage.getItem('mellyna_admin_fees')
    if (savedFees) {
      try { setAdminFees(JSON.parse(savedFees)) } catch {}
    }
  }, [])
```

- [ ] **Step 3: Replace defaultSppTiers with sppTiers in JSX**

In the JSX, line 60 currently reads `{defaultSppTiers.map(...)`. Change it to:

```tsx
{sppTiers.map((tier, index) => {
```

- [ ] **Step 4: Replace defaultAdminFees with adminFees in JSX**

Line 122 currently reads `{defaultAdminFees.map(...)`. Change it to:

```tsx
{adminFees.map((fee, index) => {
```

- [ ] **Step 5: Verify the constants file exports the interfaces**

Check that `lib/constants/pricing.ts` exports `SppTier` and `AdminFee` interfaces (they are defined there at lines 1-16). If they are not exported, add `export` keyword:

```ts
export interface SppTier {
  name: string
  price: number
  period: string
  desc: string
  badge?: string
  features: string[]
}

export interface AdminFee {
  name: string
  price: number
  period: string
  desc: string
  features: string[]
}
```

- [ ] **Step 6: Commit**

```bash
git add components/marketing/PricingSection.tsx lib/constants/pricing.ts
git commit -m "fix: sync landing page pricing with admin localStorage data"
```

---

## Task 2: Add Phone Number to LocationSection

**Files:**
- Modify: `components/marketing/LocationSection.tsx`

The "Konsultasi Gratis" card (lines 93–111) currently has no phone number — just a "Kunjungi Kami" button linking to Google Maps. Add the phone number and make it a WhatsApp link.

WhatsApp link format for `+62 857-3100-8212` → strip non-digits → `628573100212` → `https://wa.me/628573100212`

- [ ] **Step 1: Replace the contact card content**

Replace lines 92–111 (the entire contact gradient card):

```tsx
{/* Contact */}
<div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white">
  <div className="flex items-center gap-4 mb-3">
    <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
      <Phone className="h-5 w-5 text-white" />
    </div>
    <div>
      <h3 className="font-black">Konsultasi Gratis</h3>
      <p className="text-indigo-100 text-xs mt-0.5">Hubungi kami sekarang</p>
    </div>
  </div>
  <p className="text-white/90 text-sm font-semibold mb-3">+62 857-3100-8212</p>
  <a
    href="https://wa.me/628573100212"
    target="_blank"
    rel="noopener noreferrer"
    className="block w-full text-center py-2.5 rounded-xl bg-white text-indigo-600 text-sm font-bold hover:bg-indigo-50 transition-colors"
  >
    WhatsApp Kami
  </a>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/LocationSection.tsx
git commit -m "feat: add WhatsApp phone number to location section contact card"
```

---

## Task 3: Add Phone Number to Footer

**Files:**
- Modify: `components/marketing/Footer.tsx`

Footer line 65–67 currently shows "Hubungi via WhatsApp" with no number and no link. Make it a real WhatsApp link with the phone number.

- [ ] **Step 1: Replace the WhatsApp list item**

Replace lines 65–67:

```tsx
<li className="flex items-center gap-2.5">
  <Phone className="h-4 w-4 text-me-green" />
  <span>Hubungi via WhatsApp</span>
</li>
```

With:

```tsx
<li className="flex items-center gap-2.5">
  <Phone className="h-4 w-4 text-me-green" />
  <a
    href="https://wa.me/628573100212"
    target="_blank"
    rel="noopener noreferrer"
    className="hover:text-white transition-colors duration-200"
  >
    +62 857-3100-8212
  </a>
</li>
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/Footer.tsx
git commit -m "feat: add WhatsApp phone number link to footer contact section"
```

---

## Task 4: Merge Login Buttons in Navbar

**Files:**
- Modify: `components/marketing/Navbar.tsx`

Desktop CTA area (lines 74–92) has two buttons: "Masuk" (plain text link) and "Portal Orang Tua" (gradient button). Both go to `/login`. Keep only one "Masuk" button styled as the primary CTA. Mobile menu (lines 128–136) has "Masuk ke Portal" — keep as-is since it already has one button.

- [ ] **Step 1: Replace the desktop CTA section**

Replace lines 74–92:

```tsx
{/* Desktop CTA */}
<div className="hidden md:flex items-center gap-3">
  <Link
    href="/login"
    className="px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 text-white hover:bg-white/10"
  >
    Masuk
  </Link>
  <Link
    href="/login"
    className="px-5 py-2 text-sm font-bold text-white bg-me-primary rounded-xl shadow-brand hover:bg-me-primary-light hover:-translate-y-0.5 transition-all duration-200"
  >
    Portal Orang Tua
  </Link>
</div>
```

With:

```tsx
{/* Desktop CTA */}
<div className="hidden md:flex items-center">
  <Link
    href="/login"
    className="px-5 py-2 text-sm font-bold text-white bg-me-primary rounded-xl shadow-brand hover:bg-me-primary-light hover:-translate-y-0.5 transition-all duration-200"
  >
    Masuk
  </Link>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/Navbar.tsx
git commit -m "fix: merge duplicate login buttons into single Masuk button"
```

---

## Self-Review

| Requirement | Task | Status |
|---|---|---|
| Paket harga superadmin tampil di landing page | Task 1 | ✅ |
| Tambah info telp +62 857-3100-8212 di landing page | Task 2 (LocationSection) + Task 3 (Footer) | ✅ |
| Button masuk + masuk portal orang tua → satu tombol "Masuk" | Task 4 | ✅ |

No placeholders. No TBD. All code blocks complete.
