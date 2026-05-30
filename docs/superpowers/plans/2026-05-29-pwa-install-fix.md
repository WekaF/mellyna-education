# PWA Install Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix PWA so Chrome on Android shows the "Install" button for mellyna-education.my.id.

**Architecture:** Fix manifest.json (missing `id`, `screenshots`, `display_override`), fix CSP headers to not break service worker, add custom install prompt component so users can manually trigger install, and clean up gitignore for PWA artifacts.

**Tech Stack:** Next.js 14 App Router, @ducanh2912/next-pwa, Workbox, TypeScript, Tailwind CSS

---

## Root Cause Analysis

After inspecting the codebase, the following issues prevent PWA installation on mobile:

| Issue | Location | Severity |
|-------|----------|----------|
| `manifest.json` missing `id` field | `public/manifest.json` | High — Chrome 93+ uses this for PWA identity |
| `manifest.json` missing `screenshots` | `public/manifest.json` | High — Chrome 96+ won't auto-trigger install prompt without screenshots |
| `manifest.json` missing `display_override` | `public/manifest.json` | Medium — better browser compatibility |
| `connect-src 'self'` in CSP | `next.config.ts` | Medium — service worker routes external fonts through `StaleWhileRevalidate` but CSP may block cross-origin fetch from SW context |
| No custom install prompt | (missing) | High — browser auto-prompt has high dismissal backoff; users miss "Add to Home Screen" in menu |
| `fallback-*.js` and `swe-worker-*.js` not in `.gitignore` | `.gitignore` | Low — stale committed artifacts accumulate but don't break Docker builds |

---

## File Structure

| File | Action | What changes |
|------|--------|------|
| `public/manifest.json` | Modify | Add `id`, `screenshots`, `display_override`, `prefer_related_applications` |
| `public/screenshots/` | Create | Add 2 screenshot images (narrow + wide) for install prompt |
| `next.config.ts` | Modify | Add `https://fonts.gstatic.com` and `https://fonts.googleapis.com` to `connect-src` |
| `components/pwa-install-prompt.tsx` | Create | Client component with `beforeinstallprompt` handler + "Install App" button |
| `app/layout.tsx` | Modify | Import and render `PwaInstallPrompt` component |
| `.gitignore` | Modify | Add patterns for `fallback-*.js`, `swe-worker-*.js` |

---

## Task 1: Fix manifest.json

**Files:**
- Modify: `public/manifest.json`

- [ ] **Step 1: Update manifest with required fields**

Replace the entire `public/manifest.json` with:

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
  "background_color": "#0f172a",
  "theme_color": "#6366f1",
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
    { "src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "screenshots": [
    {
      "src": "/screenshots/screenshot-narrow.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Dashboard Mellyna Education"
    },
    {
      "src": "/screenshots/screenshot-wide.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Dashboard Mellyna Education"
    }
  ]
}
```

- [ ] **Step 2: Create screenshots folder**

```bash
mkdir -p public/screenshots
```

- [ ] **Step 3: Take screenshots for PWA manifest**

Take two screenshots of the app:
1. **Mobile (narrow):** Open https://mellyna-education.my.id on Chrome mobile, take a screenshot of the dashboard at 390×844. Save as `public/screenshots/screenshot-narrow.png`.
2. **Desktop (wide):** Open https://mellyna-education.my.id on Chrome desktop at 1280×720 window size, take a screenshot of the dashboard. Save as `public/screenshots/screenshot-wide.png`.

> **Shortcut:** You can generate placeholder screenshots with any image editor (390×844 and 1280×720 PNGs with the app color `#0f172a` background and the app logo) — Chrome will accept them. Real screenshots improve the install dialog UI.

- [ ] **Step 4: Commit**

```bash
git add public/manifest.json public/screenshots/
git commit -m "fix(pwa): add id, screenshots, display_override to manifest"
```

---

## Task 2: Fix CSP to allow service worker external fetch

**Files:**
- Modify: `next.config.ts:11-22`

The service worker registers Workbox routes for Google Fonts (`https://fonts.gstatic.com`, `https://fonts.googleapis.com`). With `connect-src 'self'`, the service worker's own fetch to these origins may be blocked by the CSP applied to `/sw.js` response headers.

- [ ] **Step 1: Update connect-src in Content-Security-Policy**

In `next.config.ts`, change the `connect-src` line from:

```ts
"connect-src 'self'",
```

To:

```ts
"connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
```

The full updated `securityHeaders` block in `next.config.ts` should look like:

```ts
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://app.sandbox.midtrans.com https://app.midtrans.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: http://localhost:9000 https:",
      "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
      "font-src 'self' https://fonts.gstatic.com",
      "media-src 'self' http://localhost:9000 https:",
      "frame-src https://app.sandbox.midtrans.com https://app.midtrans.com",
      "worker-src 'self'",
    ].join('; '),
  },
]
```

Note: Also added `style-src https://fonts.googleapis.com` and `font-src 'self' https://fonts.gstatic.com` since Outfit font is loaded from Google Fonts and was missing from CSP.

- [ ] **Step 2: Verify the CSP change doesn't break auth or other features**

Run locally in production mode:
```bash
npm run build && npm start
```
Open http://localhost:3000, check browser console for CSP violations. There should be none.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "fix(pwa): add google fonts to CSP connect-src and font-src"
```

---

## Task 3: Add custom PWA install prompt component

**Files:**
- Create: `components/pwa-install-prompt.tsx`
- Modify: `app/layout.tsx`

Browser auto-prompts have backoff logic (dismissed once = silent for 3 months). A custom "Install App" button lets users install at any time.

- [ ] **Step 1: Create the install prompt component**

Create `components/pwa-install-prompt.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setIsInstalled(true))

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
  }

  if (isInstalled || isDismissed || !deferredPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-xl bg-indigo-600 p-4 shadow-lg md:left-auto md:right-4 md:w-80">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Install Mellyna Education</p>
          <p className="mt-0.5 text-xs text-indigo-200">
            Pasang aplikasi untuk akses lebih cepat tanpa buka browser.
          </p>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="text-indigo-300 hover:text-white"
          aria-label="Tutup"
        >
          ✕
        </button>
      </div>
      <button
        onClick={handleInstall}
        className="mt-3 w-full rounded-lg bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
      >
        Install Aplikasi
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Add PwaInstallPrompt to root layout**

In `app/layout.tsx`, import and render the component after `<Providers>`:

```tsx
import type { Metadata, Viewport } from 'next'
import { Outfit } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Providers } from './providers'
import { PwaInstallPrompt } from '@/components/pwa-install-prompt'

const outfit = Outfit({ subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor: '#6366f1',
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
    startupImage: '/icons/icon-512.png',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${outfit.className} antialiased`} suppressHydrationWarning>
        <Providers>{children}</Providers>
        <PwaInstallPrompt />
        {process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY && (
          <Script
            src={
              process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'
                ? 'https://app.midtrans.com/snap/snap.js'
                : 'https://app.sandbox.midtrans.com/snap/snap.js'
            }
            data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
npm run build
```

Expected: Build succeeds with no TS errors related to the new component.

- [ ] **Step 4: Commit**

```bash
git add components/pwa-install-prompt.tsx app/layout.tsx
git commit -m "feat(pwa): add custom install prompt component"
```

---

## Task 4: Fix .gitignore for PWA artifacts

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add missing PWA artifact patterns to .gitignore**

In `.gitignore`, the current PWA section is:

```gitignore
# pwa (generated at build time)
/public/sw.js
/public/workbox-*.js
/public/worker-*.js
/public/sw.js.map
/public/workbox-*.js.map
```

Add the missing patterns:

```gitignore
# pwa (generated at build time)
/public/sw.js
/public/sw.js.map
/public/workbox-*.js
/public/workbox-*.js.map
/public/worker-*.js
/public/worker-*.js.map
/public/fallback-*.js
/public/fallback-*.js.map
/public/swe-worker-*.js
/public/swe-worker-*.js.map
```

- [ ] **Step 2: Remove already-committed stale artifacts from git tracking**

```bash
git rm --cached public/fallback-ce627215c0e4a9af.js public/swe-worker-5c72df51bb1f6ee0.js 2>/dev/null || true
```

> **Note:** This only removes them from git tracking. The files remain on disk for local dev. Docker builds regenerate them from `npm run build`.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore(pwa): gitignore all generated pwa artifacts"
```

---

## Task 5: Verify PWA installability

- [ ] **Step 1: Deploy the changes**

Push to main and let the server rebuild the Docker image:
```bash
git push origin main
```
Then SSH into the server and rebuild:
```bash
docker compose pull && docker compose up -d --build app
```

- [ ] **Step 2: Check Chrome DevTools PWA audit**

On desktop Chrome, open https://mellyna-education.my.id:
1. Open DevTools (F12)
2. Go to **Application** tab → **Manifest** section
3. Verify: No manifest errors, all required fields present
4. Go to **Application** → **Service Workers**
5. Verify: `sw.js` is registered as "Activated and running"

- [ ] **Step 3: Run Lighthouse PWA audit**

In Chrome DevTools → **Lighthouse** tab:
1. Select "Mobile" device
2. Check "Progressive Web App"
3. Click "Analyze page load"

Expected: PWA score = 100% with "Installable" criteria all passing.

- [ ] **Step 4: Test install on Android phone**

1. Open https://mellyna-education.my.id in Chrome on Android
2. Wait ~10 seconds for the custom install prompt (bottom banner) to appear
3. Tap "Install Aplikasi"
4. Verify: App installs to home screen with correct icon and name "Mellyna Education"
5. Open installed app → verify it opens in standalone mode (no browser chrome)

- [ ] **Step 5: Test iOS Safari install**

1. Open https://mellyna-education.my.id in Safari on iPhone
2. Tap the Share button → "Add to Home Screen"
3. Verify: App icon appears with name "Mellyna"

---

## Self-Review

**Spec coverage check:**
- ✅ manifest `id` field → Task 1
- ✅ manifest `screenshots` → Task 1
- ✅ manifest `display_override` → Task 1
- ✅ CSP blocks SW external fetch → Task 2
- ✅ No custom install UI → Task 3
- ✅ Stale gitignored artifacts → Task 4
- ✅ Verification steps → Task 5

**Placeholder scan:** None found — all steps have exact code.

**Type consistency:** `BeforeInstallPromptEvent` defined in component, used only within same file. `PwaInstallPrompt` import path uses `@/components/pwa-install-prompt` consistent with Next.js project aliases.
