# PWA Installable (Android & iOS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app fully installable as a PWA on Android and iOS by adding a service worker, proper icons, and platform-specific meta tags.

**Architecture:** Use `@ducanh2912/next-pwa` to add a service worker via Workbox. Icons generated from a source image using `sharp`. iOS support via `apple-touch-icon` and Apple-specific meta tags in `layout.tsx`.

**Tech Stack:** Next.js 15 App Router, `@ducanh2912/next-pwa`, `sharp` (icon generation), Workbox (SW runtime)

---

## Current Gaps

| Requirement | Status |
|---|---|
| `manifest.json` | ✓ Exists |
| Manifest linked in `<head>` | ✓ Via `metadata.manifest` |
| `/icons/icon-192.png` | ✗ Missing |
| `/icons/icon-512.png` | ✗ Missing |
| Service Worker | ✗ Not installed |
| `apple-touch-icon` | ✗ Missing |
| iOS `<meta>` tags | ✗ Missing |
| CSP `worker-src` | ✗ Missing |

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `public/icons/icon-48.png` ... `icon-512.png` | Create | PWA icons all sizes |
| `public/icons/icon-maskable-192.png` | Create | Android adaptive icon |
| `public/icons/icon-maskable-512.png` | Create | Android adaptive icon |
| `public/icons/apple-touch-icon.png` | Create | iOS home screen icon (180×180) |
| `public/manifest.json` | Modify | Add all icon sizes + maskable |
| `next.config.ts` | Modify | Wrap with `withPWA`, add `worker-src` to CSP |
| `app/layout.tsx` | Modify | Add iOS meta tags + `apple-touch-icon` link |
| `scripts/generate-icons.mjs` | Create | One-time icon generation script |

---

## Task 1: Provide Source Logo Image

**Files:**
- Create: `public/icons/source-logo.png` (or `.svg`)

> **STOP:** The developer must provide a high-resolution source image (≥512×512px) before continuing. Place it at `public/icons/source-logo.png`. If no logo exists yet, use a placeholder solid-color square.

- [ ] **Step 1: Place source image**

Copy your app logo (≥512×512px) to:
```
public/icons/source-logo.png
```
If no logo, create a temporary placeholder:
```bash
# Creates a 512x512 indigo square as placeholder
node -e "
const { createCanvas } = require('canvas');
// OR just use any 512x512 PNG you have
"
```
> If you don't have `canvas`, just copy any 512×512 PNG and rename it `source-logo.png`. The real logo can replace it later.

---

## Task 2: Generate All Icon Sizes

**Files:**
- Create: `scripts/generate-icons.mjs`
- Create: `public/icons/icon-48.png`, `icon-72.png`, `icon-96.png`, `icon-128.png`, `icon-144.png`, `icon-152.png`, `icon-180.png`, `icon-192.png`, `icon-384.png`, `icon-512.png`
- Create: `public/icons/icon-maskable-192.png`, `icon-maskable-512.png`
- Create: `public/icons/apple-touch-icon.png`

- [ ] **Step 1: Install sharp (dev dependency)**

```bash
npm install --save-dev sharp
```

- [ ] **Step 2: Create icon generation script**

Create `scripts/generate-icons.mjs`:
```js
import sharp from 'sharp';
import { mkdirSync } from 'fs';

const SRC = 'public/icons/source-logo.png';
const OUT = 'public/icons';

mkdirSync(OUT, { recursive: true });

const sizes = [48, 72, 96, 128, 144, 152, 180, 192, 384, 512];

for (const size of sizes) {
  await sharp(SRC)
    .resize(size, size)
    .png()
    .toFile(`${OUT}/icon-${size}.png`);
  console.log(`✓ icon-${size}.png`);
}

// apple-touch-icon = 180x180
await sharp(SRC).resize(180, 180).png().toFile(`${OUT}/apple-touch-icon.png`);
console.log('✓ apple-touch-icon.png');

// Maskable icons: add safe-zone padding (10% each side = 80% inner)
for (const size of [192, 512]) {
  const inner = Math.round(size * 0.8);
  const pad = Math.round(size * 0.1);
  await sharp(SRC)
    .resize(inner, inner)
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 99, g: 102, b: 241, alpha: 1 }, // indigo-500 = #6366f1
    })
    .png()
    .toFile(`${OUT}/icon-maskable-${size}.png`);
  console.log(`✓ icon-maskable-${size}.png`);
}

console.log('\nAll icons generated.');
```

- [ ] **Step 3: Run script**

```bash
node scripts/generate-icons.mjs
```

Expected output:
```
✓ icon-48.png
✓ icon-72.png
...
✓ icon-512.png
✓ apple-touch-icon.png
✓ icon-maskable-192.png
✓ icon-maskable-512.png

All icons generated.
```

Verify files exist:
```bash
ls public/icons/
```
Expected: 12+ PNG files including `apple-touch-icon.png`, `icon-maskable-192.png`, `icon-maskable-512.png`.

- [ ] **Step 4: Commit icons**

```bash
git add public/icons/
git commit -m "feat: add PWA icons (all sizes + maskable + apple-touch-icon)"
```

---

## Task 3: Update manifest.json

**Files:**
- Modify: `public/manifest.json`

- [ ] **Step 1: Replace manifest.json**

Replace `public/manifest.json` with:
```json
{
  "name": "Mellyna Education",
  "short_name": "Mellyna",
  "description": "Platform Bimbingan Belajar Mellyna Education",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#6366f1",
  "orientation": "portrait",
  "categories": ["education"],
  "icons": [
    { "src": "/icons/icon-48.png", "sizes": "48x48", "type": "image/png" },
    { "src": "/icons/icon-72.png", "sizes": "72x72", "type": "image/png" },
    { "src": "/icons/icon-96.png", "sizes": "96x96", "type": "image/png" },
    { "src": "/icons/icon-128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-144.png", "sizes": "144x144", "type": "image/png" },
    { "src": "/icons/icon-152.png", "sizes": "152x152", "type": "image/png" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add public/manifest.json
git commit -m "feat: update manifest.json with full icon set and maskable icons"
```

---

## Task 4: Install and Configure next-pwa

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Install @ducanh2912/next-pwa**

```bash
npm install @ducanh2912/next-pwa
npm install --save-dev webpack
```

> `webpack` is a peer dep required when using App Router with next-pwa.

- [ ] **Step 2: Update next.config.ts**

Replace the entire `next.config.ts`:
```ts
import type { NextConfig } from 'next'
import withPWA from '@ducanh2912/next-pwa'

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
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: http://localhost:9000 https:",
      "connect-src 'self'",
      "media-src 'self' http://localhost:9000 https:",
      "frame-src https://app.sandbox.midtrans.com https://app.midtrans.com",
      "worker-src 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000' },
      { protocol: 'https', hostname: process.env.MINIO_ENDPOINT || 'localhost' },
    ],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline',
  },
})(nextConfig)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts package.json package-lock.json
git commit -m "feat: add next-pwa service worker with offline support"
```

---

## Task 5: Add Offline Fallback Page

**Files:**
- Create: `app/offline/page.tsx`

- [ ] **Step 1: Create offline page**

Create `app/offline/page.tsx`:
```tsx
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-white">
      <h1 className="text-2xl font-bold">Tidak ada koneksi internet</h1>
      <p className="text-slate-400">Periksa koneksi Anda dan coba lagi.</p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-700"
      >
        Coba Lagi
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/offline/page.tsx
git commit -m "feat: add offline fallback page for PWA"
```

---

## Task 6: Add iOS Meta Tags to layout.tsx

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update layout.tsx**

Replace the `metadata` export and add `<head>` tags:
```tsx
import type { Metadata, Viewport } from 'next'
import { Outfit } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Providers } from './providers'

const outfit = Outfit({ subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
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

> `appleWebApp.capable: true` = `apple-mobile-web-app-capable` meta tag. This enables standalone mode on iOS when added to home screen. `statusBarStyle: 'black-translucent'` = dark status bar overlay.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add iOS PWA meta tags and apple-touch-icon to layout"
```

---

## Task 7: Build and Verify PWA

- [ ] **Step 1: Production build**

```bash
npm run build
```

Expected: build succeeds. You should see output like:
```
✓ Compiled successfully
Route (app) ...
```

After build, verify service worker generated:
```bash
ls public/sw.js public/workbox-*.js
```
Expected: both files exist.

- [ ] **Step 2: Start production server**

```bash
npm run start
```

- [ ] **Step 3: Test in Chrome DevTools**

Open `http://localhost:3000` in Chrome:
1. Open DevTools → **Application** → **Manifest** — should show all icons, no errors
2. DevTools → **Application** → **Service Workers** — should show SW registered and active
3. DevTools → **Lighthouse** → run PWA audit — score should be green

- [ ] **Step 4: Test Android install**

On Android Chrome, open the URL → three-dot menu should show **"Add to Home screen"** or an install banner appears.

- [ ] **Step 5: Test iOS install**

On iOS Safari, open the URL → tap **Share** → **Add to Home Screen**. App should open in standalone mode (no browser chrome).

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: complete PWA setup - installable on Android and iOS"
```

---

## Self-Review

**Spec coverage:**
- ✓ Service worker via next-pwa
- ✓ Icons 192 + 512 (standard + maskable)
- ✓ apple-touch-icon 180×180
- ✓ `apple-mobile-web-app-capable` via `appleWebApp.capable`
- ✓ `theme-color` via `viewport` export
- ✓ CSP `worker-src 'self'` added
- ✓ Offline fallback page
- ✓ manifest.json updated with full icon set

**Known iOS limitations:**
- iOS does NOT show an automatic install banner — user must manually tap Share → Add to Home Screen
- Push notifications via PWA not supported on iOS < 16.4
- iOS PWA has no background sync
