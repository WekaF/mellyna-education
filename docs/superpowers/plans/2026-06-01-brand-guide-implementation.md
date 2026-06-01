# Mellyna Brand Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Mellyna brand identity (colors, fonts, logos, component styles) consistently across the Next.js app — from global CSS tokens through Navbar, Sidebar, and Dashboard UI.

**Architecture:** Brand tokens are already defined in `public/brand/mellyna-brand-tokens.css`. The plan wires them into Tailwind v4's `@theme` block (so `bg-me-primary`, `text-me-yellow`, etc. become valid utilities), loads Fredoka One + Nunito via `next/font/google`, and rebrand the two highest-visibility surfaces (Navbar + Sidebar) with actual logo images and brand colors. Dashboard gets `.me-card` / `.me-badge-*` utility classes for consistent stat cards.

**Tech Stack:** Next.js 15, Tailwind v4 (PostCSS), `next/font/google`, CSS custom properties (`--me-*` prefix)

---

## File Map

| File | Change |
|------|--------|
| `app/globals.css` | Add brand token @import, extend `@theme inline` with `--color-me-*` + `--font-heading/body` + `--radius-brand` + `--shadow-brand`, add `.dark` brand overrides, add `.me-card` / `.me-badge-*` utilities |
| `app/layout.tsx` | Load Fredoka One + Nunito via `next/font/google`, apply as CSS variables on `<html>`, update `viewport.themeColor` to `#1A56DB`, update favicon to brand SVG |
| `public/manifest.json` | Update `theme_color` → `#1A56DB`, `background_color` → `#F7FAFF` |
| `components/marketing/Navbar.tsx` | Replace gradient icon + indigo palette with brand logo image + `me-primary` colors |
| `components/dashboard/sidebar.tsx` | Replace "M" letter icon with brand icon image, update active state from `blue-600/indigo` to `me-primary` |

---

## Task 1: Brand Token CSS Foundation

Wire brand tokens into Tailwind v4 and load brand fonts.

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

---

- [ ] **Step 1: Import brand tokens at top of globals.css**

Open `app/globals.css`. Add the import right after the Tailwind import (line 1):

```css
@import "tailwindcss";
@import "../public/brand/mellyna-brand-tokens.css";
```

- [ ] **Step 2: Register brand colors + fonts + radii as Tailwind utilities**

Replace the existing `@theme inline` block (lines 25-30) with this expanded version:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);

  /* Brand colors → Tailwind utilities: bg-me-primary, text-me-yellow, etc. */
  --color-me-primary:       #1A56DB;
  --color-me-primary-dark:  #0C1A5C;
  --color-me-primary-light: #2B6EF5;
  --color-me-yellow:        #FFE566;
  --color-me-orange:        #FF8C00;
  --color-me-coral:         #FF6B6B;
  --color-me-green:         #4FD1A5;
  --color-me-bg:            #F7FAFF;
  --color-me-surface:       #EEF4FF;
  --color-me-border:        #D6E4FF;
  --color-me-text:          #0C1A5C;
  --color-me-muted:         #6A7FB8;

  /* Fonts → font-sans, font-heading, font-body utilities */
  --font-sans:    var(--font-outfit, 'Outfit', sans-serif);
  --font-heading: var(--font-heading-var, 'Fredoka One', 'Arial Rounded MT Bold', sans-serif);
  --font-body:    var(--font-body-var, 'Nunito', 'Segoe UI', sans-serif);

  /* Border radius → rounded-brand, rounded-brand-lg */
  --radius-brand:    16px;
  --radius-brand-lg: 24px;

  /* Shadows → shadow-brand, shadow-brand-lg */
  --shadow-brand:    0 4px 16px rgba(26,86,219,0.12);
  --shadow-brand-lg: 0 8px 32px rgba(26,86,219,0.16);
}
```

- [ ] **Step 3: Add .dark brand token overrides**

After the existing `.dark { ... }` block, add:

```css
.dark {
  --me-bg:           #060E2E;
  --me-surface:      #0C1A5C;
  --me-border:       #1A3080;
  --me-border-light: #142460;
  --me-text-primary: #FFFFFF;
  --me-text-body:    #C4D4F0;
  --me-text-muted:   #6A8CC0;
}
```

- [ ] **Step 4: Add Fredoka One + Nunito in layout.tsx**

Open `app/layout.tsx`. Replace the import and font declarations at the top:

```tsx
import type { Metadata, Viewport } from 'next'
import { Outfit, Fredoka_One, Nunito } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Providers } from './providers'
import { PwaInstallPrompt } from '@/components/pwa-install-prompt'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })
const fredoka = Fredoka_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-heading-var',
})
const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-body-var',
  weight: ['400', '700', '900'],
})
```

- [ ] **Step 5: Apply font variables on `<html>` element**

In the `RootLayout` return, change the `<html>` and `<body>` tags:

```tsx
<html
  lang="id"
  className={`${outfit.variable} ${fredoka.variable} ${nunito.variable}`}
  suppressHydrationWarning
>
  <body className="antialiased" suppressHydrationWarning>
```

Also update `globals.css` body rule to use the CSS variable:

```css
body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-outfit, 'Outfit', sans-serif);
  -webkit-font-smoothing: antialiased;
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

- [ ] **Step 6: Verify build passes**

```bash
rtk tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
rtk git add app/globals.css app/layout.tsx
rtk git commit -m "feat: wire brand tokens + Fredoka One/Nunito into Tailwind v4 theme"
```

---

## Task 2: PWA & Metadata Brand Update

Update theme colors in viewport metadata and PWA manifest.

**Files:**
- Modify: `app/layout.tsx`
- Modify: `public/manifest.json`

---

- [ ] **Step 1: Update viewport themeColor and favicon icons**

In `app/layout.tsx`, update `viewport` and `metadata`:

```tsx
export const viewport: Viewport = {
  themeColor: '#1A56DB',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  title: 'Mellyna Education',
  description: 'Platform Bimbingan Belajar Mellyna Education',
  manifest: '/manifest.json',
  applicationName: 'Mellyna Education',
  keywords: ['bimbel', 'bimbingan belajar', 'mellyna', 'pendidikan'],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mellyna',
    startupImage: '/icons/mellyna-icon-512.png',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
    icon: [
      { url: '/icons/mellyna-icon-192.svg', type: 'image/svg+xml' },
      { url: '/icons/mellyna-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/mellyna-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
}
```

- [ ] **Step 2: Update manifest.json brand colors**

Open `public/manifest.json`. Change only `theme_color` and `background_color`:

```json
{
  "id": "/",
  "name": "Mellyna Education",
  "short_name": "Mellyna",
  "description": "Platform Bimbingan Belajar Mellyna Education",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "display_override": ["window-controls-overlay", "standalone", "browser"],
  "background_color": "#F7FAFF",
  "theme_color": "#1A56DB",
  "orientation": "portrait",
  "prefer_related_applications": false,
  "categories": ["education"],
  "icons": [
    { "src": "/icons/icon-48.png", "sizes": "48x48", "type": "image/png" },
    { "src": "/icons/icon-72.png", "sizes": "72x72", "type": "image/png" },
    { "src": "/icons/icon-96.png", "sizes": "96x96", "type": "image/png" },
    { "src": "/icons/icon-128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-144.png", "sizes": "144x144", "type": "image/png" },
    { "src": "/icons/icon-152.png", "sizes": "152x152", "type": "image/png" },
    { "src": "/icons/icon-180.png", "sizes": "180x180", "type": "image/png" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/mellyna-icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/mellyna-icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "screenshots": [
    {
      "src": "/screenshots/screenshot-narrow.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Dashboard - Mobile"
    },
    {
      "src": "/screenshots/screenshot-wide.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Dashboard - Desktop"
    }
  ]
}
```

- [ ] **Step 3: Verify build**

```bash
rtk tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
rtk git add app/layout.tsx public/manifest.json
rtk git commit -m "feat: update PWA theme_color and favicon to Mellyna brand blue #1A56DB"
```

---

## Task 3: Navbar Brand Identity

Replace the generic indigo gradient logo and button with the actual Mellyna horizontal logo and brand-blue CTA.

**Files:**
- Modify: `components/marketing/Navbar.tsx`

---

- [ ] **Step 1: Replace Navbar with branded version**

Replace the entire content of `components/marketing/Navbar.tsx` with:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { label: 'Program', href: '#program' },
  { label: 'Cara Kerja', href: '#cara-kerja' },
  { label: 'Harga', href: '#harga' },
  { label: 'Lokasi', href: '#lokasi' },
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
          ? 'bg-white/90 backdrop-blur-md shadow-lg border-b-2 border-me-yellow'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center group">
            {scrolled ? (
              <Image
                src="/icons/mellyna-logo-horizontal-compact.svg"
                alt="Mellyna Education"
                width={160}
                height={40}
                className="h-10 w-auto"
                priority
              />
            ) : (
              <Image
                src="/icons/mellyna-logo-dark.svg"
                alt="Mellyna Education"
                width={160}
                height={40}
                className="h-10 w-auto"
                priority
              />
            )}
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`text-sm font-semibold transition-colors duration-200 hover:text-me-primary ${
                  scrolled ? 'text-me-text' : 'text-white/80'
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
                  ? 'text-me-text hover:bg-me-surface'
                  : 'text-white hover:bg-white/10'
              }`}
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

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`md:hidden p-2 rounded-lg transition-colors ${
              scrolled ? 'text-me-text hover:bg-me-surface' : 'text-white hover:bg-white/10'
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
            className="md:hidden overflow-hidden bg-white border-b-2 border-me-yellow shadow-brand"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 text-sm font-semibold text-me-text hover:text-me-primary hover:bg-me-surface rounded-xl transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-3 border-t border-me-border mt-2">
                <Link
                  href="/login"
                  className="block w-full text-center px-5 py-3 text-sm font-bold text-white bg-me-primary rounded-xl shadow-brand"
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

- [ ] **Step 2: Verify build**

```bash
rtk tsc --noEmit
```

Expected: 0 errors. `next/image` is already a project dependency.

- [ ] **Step 3: Commit**

```bash
rtk git add components/marketing/Navbar.tsx
rtk git commit -m "feat: rebrand Navbar with Mellyna logo and brand-blue palette"
```

---

## Task 4: Sidebar Brand Identity

Replace the generic "M" letter icon with the Mellyna owl icon and align active-state colors to brand blue.

**Files:**
- Modify: `components/dashboard/sidebar.tsx`

---

- [ ] **Step 1: Add Image import at top of sidebar.tsx**

Add `Image` to the imports (after the existing `Link` import):

```tsx
import Image from 'next/image'
```

- [ ] **Step 2: Replace "M" letter brand header with logo**

Find the brand header block (around line 201-210):

```tsx
{/* Brand Header / Company Switcher style */}
<div className="relative z-10 flex items-center gap-3 pb-6 border-b border-slate-200 dark:border-slate-800/60 mb-6">
  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-2xl shadow-lg shadow-blue-500/20 text-white font-bold transform transition-transform hover:rotate-6">
    M
  </div>
  <div>
    <h1 className="font-extrabold text-[15px] leading-tight tracking-wide text-slate-800 dark:text-white uppercase">
      Mellyna Ed.
    </h1>
    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold tracking-wider uppercase mt-0.5">Academic System</p>
  </div>
</div>
```

Replace with:

```tsx
{/* Brand Header */}
<div className="relative z-10 flex items-center gap-3 pb-6 border-b border-slate-200 dark:border-slate-800/60 mb-6">
  <Image
    src="/icons/mellyna-icon-192.svg"
    alt="Mellyna"
    width={44}
    height={44}
    className="h-11 w-11 rounded-xl"
  />
  <div>
    <h1 className="font-heading font-bold text-[15px] leading-tight tracking-wide text-me-primary-dark dark:text-white uppercase">
      Mellyna Ed.
    </h1>
    <p className="text-[10px] text-me-muted dark:text-slate-400 font-semibold tracking-wider uppercase mt-0.5">Academic System</p>
  </div>
</div>
```

- [ ] **Step 3: Replace mobile header "M" letter with logo**

Find the mobile top header block (around line 333-338):

```tsx
<div className="flex items-center gap-3">
  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-lg shadow-md text-white font-bold">
    M
  </div>
  <span className="font-bold tracking-tight text-sm uppercase">Mellyna Education</span>
</div>
```

Replace with:

```tsx
<div className="flex items-center gap-3">
  <Image
    src="/icons/mellyna-icon-192.svg"
    alt="Mellyna"
    width={32}
    height={32}
    className="h-8 w-8 rounded-lg"
  />
  <span className="font-heading font-bold tracking-tight text-sm uppercase text-me-primary-dark dark:text-white">Mellyna Education</span>
</div>
```

- [ ] **Step 4: Update active nav state from blue-600/indigo to me-primary**

In the `SidebarContent` nav section, find all occurrences of `border-blue-500`, `bg-blue-50`, `text-blue-600`, `bg-blue-600`, `text-blue-400` in the nav link className strings and replace:

| Find | Replace |
|------|---------|
| `border-blue-500` | `border-[#1A56DB]` |
| `bg-blue-50/40` | `bg-[#EEF4FF]/40` |
| `bg-blue-50` | `bg-me-surface` |
| `text-blue-600 dark:text-white` (active subItem) | `text-me-primary dark:text-white` |
| `text-blue-600 dark:text-blue-400` (icon active) | `text-me-primary dark:text-[#5B8AF5]` |
| `bg-blue-600/15` | `bg-[#1A56DB]/15` |
| `bg-blue-600/20` | `bg-[#1A56DB]/20` |

The exact lines to update are in the `subItems` and direct `link.href` rendering branches of the nav map. Here is the full updated nav for the **sub-item active state** (find this exact className on `<Link>` inside `subItems.map`):

```tsx
className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl text-[11px] font-semibold tracking-wide uppercase transition-all duration-200 cursor-pointer ${
  subActive
    ? 'bg-me-surface dark:bg-[#1A56DB]/15 text-me-primary dark:text-white font-bold shadow-xs'
    : 'text-slate-550 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/40 dark:hover:bg-slate-800/15'
}`}
```

Sub-icon active:
```tsx
className={`h-3.5 w-3.5 transition-colors ${subActive ? 'text-me-primary dark:text-[#5B8AF5]' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white'}`}
```

Group button active:
```tsx
className={`group flex w-full items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide uppercase transition-all duration-200 cursor-pointer text-left border-l-4 ${
  groupActive
    ? 'bg-[#EEF4FF]/40 dark:bg-[#1A56DB]/5 border-[#1A56DB] text-me-primary dark:text-[#5B8AF5] font-bold'
    : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/30'
}`}
```

Direct link active:
```tsx
className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide uppercase transition-all duration-200 cursor-pointer ${
  active
    ? 'bg-me-surface dark:bg-[#1A56DB]/20 border-l-4 border-[#1A56DB] text-me-primary dark:text-white font-bold shadow-xs'
    : 'text-slate-500 dark:text-slate-400 border-l-4 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/30'
}`}
```

- [ ] **Step 5: Verify build**

```bash
rtk tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
rtk git add components/dashboard/sidebar.tsx
rtk git commit -m "feat: rebrand Sidebar with Mellyna owl icon and me-primary active states"
```

---

## Task 5: Dashboard Brand Utility Classes

Add `.me-card`, `.me-badge-lunas`, `.me-badge-pending`, `.me-badge-belum` utility classes to globals.css so dashboard stat cards and payment status badges use consistent brand styles.

**Files:**
- Modify: `app/globals.css`

---

- [ ] **Step 1: Add brand utility classes at end of globals.css**

Append the following after the existing `.animate-slide-in` block:

```css
/* ── Mellyna Brand Component Utilities ── */

.me-card {
  background: #ffffff;
  border: 1px solid var(--me-border);
  border-top: 4px solid var(--me-primary);
  border-radius: var(--me-radius-lg);
  padding: 20px 24px;
  box-shadow: var(--me-shadow-md);
  transition: box-shadow var(--me-transition);
}

.me-card:hover {
  box-shadow: var(--me-shadow-lg);
}

.dark .me-card {
  background: rgba(30, 41, 59, 0.45);
  border-color: rgba(26, 86, 219, 0.2);
}

.me-card-label {
  font-size: 12px;
  color: var(--me-text-muted);
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.me-card-value {
  font-size: 36px;
  font-weight: 900;
  color: var(--me-text-primary);
  margin: 4px 0;
  font-family: var(--me-font-heading);
}

.dark .me-card-label { color: #6A8CC0; }
.dark .me-card-value { color: #ffffff; }

/* Payment status badges */
.me-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: var(--me-radius-full);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.me-badge-lunas {
  background: var(--me-success-bg);
  color: var(--me-success-text);
}

.me-badge-pending {
  background: var(--me-warning-bg);
  color: var(--me-warning-text);
}

.me-badge-belum {
  background: var(--me-danger-bg);
  color: var(--me-danger-text);
}

.dark .me-badge-lunas  { background: rgba(79,209,165,0.15); color: #4FD1A5; }
.dark .me-badge-pending { background: rgba(255,140,0,0.15);  color: #FFB347; }
.dark .me-badge-belum  { background: rgba(255,107,107,0.15); color: #FF6B6B; }
```

- [ ] **Step 2: Verify build**

```bash
rtk next build
```

Expected: Build succeeds, no CSS parse errors. Route sizes shown.

- [ ] **Step 3: Commit**

```bash
rtk git add app/globals.css
rtk git commit -m "feat: add me-card and me-badge brand utility classes for dashboard"
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|-------------|------|
| CSS custom properties `--me-*` available everywhere | Task 1 — @import brand tokens |
| Tailwind utilities `bg-me-primary`, `text-me-yellow` etc. | Task 1 — @theme inline block |
| Fredoka One + Nunito fonts loaded | Task 1 — next/font/google |
| `font-heading`, `font-body` Tailwind utilities | Task 1 — @theme font vars |
| `border-radius: 16px` via `rounded-brand` | Task 1 — @theme radius |
| `shadow-brand` Tailwind utility | Task 1 — @theme shadow |
| `<html>` dark mode `.dark` brand overrides | Task 1 — .dark block |
| PWA theme_color → #1A56DB | Task 2 |
| Favicon → brand SVG icon | Task 2 |
| Header/Navbar — brand logo, yellow bottom border, me-primary CTA | Task 3 |
| Sidebar — owl icon, me-primary active state | Task 4 |
| Dashboard stat card `.me-card` style | Task 5 |
| Status badge `.me-badge-lunas/pending/belum` | Task 5 |

### No Placeholders Scan

All code blocks are complete. No TBD, no "similar to Task N", no abstract steps.

### Type Consistency

- `Image` from `next/image` used in both Navbar (Task 3) and Sidebar (Task 4) — consistent
- `font-heading`, `font-body` registered in `@theme` (Task 1) match class usage in Sidebar (Task 4) — consistent
- `me-primary`, `me-surface`, `me-text`, `me-muted`, `me-border`, `me-yellow` registered in `@theme` (Task 1) match usage in Navbar (Task 3) and Sidebar (Task 4) — consistent
- `shadow-brand` registered in `@theme` (Task 1) used in Navbar (Task 3) — consistent

---

*Mellyna Brand Guide Implementation Plan — 2026-06-01*
