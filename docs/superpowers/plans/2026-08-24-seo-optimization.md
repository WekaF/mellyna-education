# SEO Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Mellyna Education public landing page fully crawlable and indexable, and target it at the requested local keywords (bimbel Pamekasan, bimbel Pakong, bimbel Madura, bimbel anak TK dan SD, bimbel SEMPOA, bimbel SEMPOA Kreatif Madura).

**Architecture:** This is a Next.js 15 App Router site where only `/` (the marketing landing page) is public — everything else (`/admin`, `/parent`, `/tutor`, `/api`, auth pages) sits behind NextAuth and must stay out of the index. SEO work therefore has two halves: (1) crawler infrastructure that currently doesn't exist at all — `app/robots.ts`, `app/sitemap.ts`, and a proper `metadata` object with Open Graph/Twitter/canonical/JSON-LD — and (2) keyword-bearing copy edits to the existing marketing components (`HeroSection`, `LocationSection`, `PartnersSection`, `Footer`) so the target phrases actually appear in rendered text, not just in `<meta keywords>` (which Google ignores for ranking anyway — it's the visible copy and structured data that matter).

**Tech Stack:** Next.js 15 App Router `MetadataRoute` APIs (`robots.ts`, `sitemap.ts`, `generateMetadata`/`metadata` export), JSON-LD via a plain `<script type="application/ld+json">`, existing Jest + `next/jest` test setup (`testEnvironment: 'node'`, `@/*` path alias).

**Confirmed facts (do not re-derive):**
- Production domain: `https://mellyna-education.my.id` (already used as the NEXTAUTH_URL fallback origin in `__tests__/lib/auth-redirect.test.ts`).
- Business location: Kecamatan Pakong, Kabupaten Pamekasan, Madura, Jawa Timur.
- Google Search Console verification: being done via DNS TXT record on the domain (domain-property method), **not** the HTML meta-tag method — no code change needed for it, so it is intentionally out of scope for this plan.
- Phone: `+6285731008212` (existing WhatsApp links). Email: `info@mellyna.id` (existing Footer). Maps link: `https://maps.app.goo.gl/ZFnnCMCh7yo27j9m7`.
- Current gaps found during audit: no `app/robots.ts`, no `app/sitemap.ts`, `metadata` in `app/layout.tsx` has no `metadataBase`/OpenGraph/Twitter/canonical, no JSON-LD structured data anywhere, and the visible copy never mentions Pamekasan/Pakong/Madura — `LocationSection` just says "Jawa Timur, Indonesia".

---

## File Structure

**Create:**
- `lib/seo.ts` — single source of truth for site URL, title, description, keyword list, OG image path, and business/address info. Everything else imports from here so there's exactly one place to update if the domain or address changes.
- `lib/__tests__/seo.test.ts` — asserts the constants have the right shape and contain every requested keyword.
- `app/robots.ts` — Next.js `MetadataRoute.Robots` special file, generates `/robots.txt`.
- `app/sitemap.ts` — Next.js `MetadataRoute.Sitemap` special file, generates `/sitemap.xml`.
- `__tests__/lib/seo-routes.test.ts` — asserts `robots()` blocks the authenticated app routes and `sitemap()` only lists the public homepage.
- `components/marketing/StructuredData.tsx` — server component rendering the `EducationalOrganization` JSON-LD block.

**Modify:**
- `app/layout.tsx:26-46` — replace the generic `metadata` object with one built from `lib/seo.ts` (metadataBase, title template, OpenGraph, Twitter, canonical), render `<StructuredData />`.
- `components/marketing/HeroSection.tsx:60-87` — badge and subtitle copy gets the target keywords worked in naturally.
- `components/marketing/LocationSection.tsx:24-52` — replace the vague "Jawa Timur, Indonesia" address with the real Pakong/Pamekasan location.
- `components/marketing/PartnersSection.tsx:9` — partner description mentions "Sempoa Kreatif Madura" explicitly.
- `components/marketing/Footer.tsx:30-33,53-64` — brand tagline gets keyword copy; contact block gets a visible NAP (name/address/phone) text line instead of only a maps link (Google local-SEO signals want visible address text, not just a link).

---

## Task 1: SEO constants module

**Files:**
- Create: `lib/seo.ts`
- Test: `lib/__tests__/seo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/__tests__/seo.test.ts
import { SITE_URL, SITE_KEYWORDS, BUSINESS_INFO } from '@/lib/seo'

describe('seo constants', () => {
  it('exposes an https production URL with no trailing slash', () => {
    expect(SITE_URL).toBe('https://mellyna-education.my.id')
    expect(SITE_URL.endsWith('/')).toBe(false)
  })

  it('includes every user-requested target keyword', () => {
    const required = [
      'bimbel pamekasan',
      'bimbel pakong',
      'bimbel madura',
      'bimbel anak tk',
      'bimbel anak sd',
      'bimbel sempoa',
      'bimbel sempoa kreatif madura',
    ]
    for (const kw of required) {
      expect(SITE_KEYWORDS).toContain(kw)
    }
  })

  it('sets the business location to Pakong, Pamekasan', () => {
    expect(BUSINESS_INFO.addressLocality).toBe('Pakong, Pamekasan')
    expect(BUSINESS_INFO.addressRegion).toBe('Jawa Timur')
    expect(BUSINESS_INFO.areaServed).toEqual(['Pamekasan', 'Pakong', 'Madura'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/__tests__/seo.test.ts`
Expected: FAIL with `Cannot find module '@/lib/seo'`

- [ ] **Step 3: Write the implementation**

```typescript
// lib/seo.ts
export const SITE_URL = 'https://mellyna-education.my.id'
export const SITE_NAME = 'Mellyna Education'

export const SITE_TITLE = 'Mellyna Education — Bimbel Pamekasan, Pakong & Madura'

export const SITE_DESCRIPTION =
  'Bimbel SEMPOA, Calistung, dan Bahasa Inggris untuk anak TK dan SD di Pamekasan, Pakong, ' +
  'dan Madura. Mitra resmi Sempoa Kreatif Madura dengan laporan progres real-time ke WhatsApp orang tua.'

export const SITE_KEYWORDS = [
  'bimbel pamekasan',
  'bimbel pakong',
  'bimbel madura',
  'bimbel anak tk',
  'bimbel anak sd',
  'bimbel sempoa',
  'bimbel sempoa kreatif madura',
  'les privat pamekasan',
  'bimbingan belajar pamekasan',
  'kursus calistung pamekasan',
]

// ponytail: square 512x512 icon reused as OG/Twitter image — swap for a proper
// 1200x630 banner if social-share previews need to look better than a logo crop.
export const SITE_OG_IMAGE = '/icons/mellyna-icon-512.png'

export const BUSINESS_INFO = {
  name: SITE_NAME,
  telephone: '+6285731008212',
  email: 'info@mellyna.id',
  addressLocality: 'Pakong, Pamekasan',
  addressRegion: 'Jawa Timur',
  addressCountry: 'ID',
  areaServed: ['Pamekasan', 'Pakong', 'Madura'],
  mapsUrl: 'https://maps.app.goo.gl/ZFnnCMCh7yo27j9m7',
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/__tests__/seo.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/seo.ts lib/__tests__/seo.test.ts
git commit -m "feat(seo): add central SEO constants module"
```

- [ ] **Step 6: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

## Task 2: robots.ts

**Files:**
- Create: `app/robots.ts`
- Test: `__tests__/lib/seo-routes.test.ts` (robots portion)

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/seo-routes.test.ts
import robots from '@/app/robots'

describe('robots.ts', () => {
  it('allows the public homepage and blocks authenticated app routes', () => {
    const result = robots()
    expect(result.rules).toMatchObject({ userAgent: '*', allow: '/' })
    const disallow = (result.rules as { disallow: string[] }).disallow
    expect(disallow).toEqual(
      expect.arrayContaining(['/admin', '/parent', '/tutor', '/api', '/login'])
    )
  })

  it('points to the production sitemap URL', () => {
    const result = robots()
    expect(result.sitemap).toBe('https://mellyna-education.my.id/sitemap.xml')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/seo-routes.test.ts`
Expected: FAIL with `Cannot find module '@/app/robots'`

- [ ] **Step 3: Write the implementation**

```typescript
// app/robots.ts
import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/parent',
        '/tutor',
        '/api',
        '/login',
        '/forgot-password',
        '/reset-password',
        '/offline',
        '/suspended',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/seo-routes.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/robots.ts __tests__/lib/seo-routes.test.ts
git commit -m "feat(seo): add robots.txt route blocking authenticated app paths"
```

- [ ] **Step 6: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

## Task 3: sitemap.ts

**Files:**
- Create: `app/sitemap.ts`
- Test: `__tests__/lib/seo-routes.test.ts` (sitemap portion, appended)

- [ ] **Step 1: Write the failing test**

Append to `__tests__/lib/seo-routes.test.ts`:

```typescript
import sitemap from '@/app/sitemap'

describe('sitemap.ts', () => {
  it('lists the homepage as the only indexable entry', () => {
    const result = sitemap()
    expect(result).toHaveLength(1)
    expect(result[0].url).toBe('https://mellyna-education.my.id')
    expect(result[0].priority).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/seo-routes.test.ts`
Expected: FAIL with `Cannot find module '@/app/sitemap'`

- [ ] **Step 3: Write the implementation**

```typescript
// app/sitemap.ts
import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/seo-routes.test.ts`
Expected: PASS (3 tests total — 2 from robots.ts, 1 from sitemap.ts)

- [ ] **Step 5: Commit**

```bash
git add app/sitemap.ts __tests__/lib/seo-routes.test.ts
git commit -m "feat(seo): add sitemap.xml route for the public homepage"
```

- [ ] **Step 6: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

## Task 4: Root layout metadata overhaul

**Files:**
- Modify: `app/layout.tsx:1-46`

No test — this is a declarative `Metadata` object with no branching logic; `__tests__` in this repo don't render components (no `@testing-library/react` dependency), and the values are already covered by Task 1's `lib/seo.ts` test. Verified visually in Task 7 via `curl`/browser view-source instead.

- [ ] **Step 1: Replace the imports and metadata export**

In `app/layout.tsx`, replace lines 1-46 with:

```typescript
import type { Metadata, Viewport } from 'next'
import { Outfit, Fredoka, Nunito } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Providers } from './providers'
import { PwaInstallPrompt } from '@/components/pwa-install-prompt'
import { StructuredData } from '@/components/marketing/StructuredData'
import {
  SITE_URL,
  SITE_NAME,
  SITE_TITLE,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_OG_IMAGE,
} from '@/lib/seo'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })
const fredoka = Fredoka({
  subsets: ['latin'],
  variable: '--font-heading-var',
})
const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-body-var',
  weight: ['400', '700', '900'],
})

export const viewport: Viewport = {
  themeColor: '#1A56DB',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  manifest: '/manifest.json',
  applicationName: SITE_NAME,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: SITE_OG_IMAGE, width: 512, height: 512, alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
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

- [ ] **Step 2: Render `StructuredData` in the body**

In `app/layout.tsx`, find:

```typescript
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <PwaInstallPrompt />
```

Replace with:

```typescript
      <body className="font-sans antialiased" suppressHydrationWarning>
        <StructuredData />
        <Providers>{children}</Providers>
        <PwaInstallPrompt />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (this will fail on the `@/components/marketing/StructuredData` import until Task 5 creates the file — do Task 5 first if executing out of order, or run this check after Task 5 instead).

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(seo): wire root layout metadata to lib/seo.ts (OG, Twitter, canonical)"
```

- [ ] **Step 5: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

## Task 5: JSON-LD structured data

**Files:**
- Create: `components/marketing/StructuredData.tsx`

No test — pure declarative JSX with no branches, and no render-testing setup exists in this repo (confirmed: no `@testing-library/react` in `package.json`, all existing `__tests__` cover plain functions under `testEnvironment: 'node'`). Verified visually in Task 7 by inspecting the rendered `<script>` tag.

- [ ] **Step 1: Write the component**

```typescript
// components/marketing/StructuredData.tsx
import { SITE_URL, SITE_DESCRIPTION, BUSINESS_INFO } from '@/lib/seo'

export function StructuredData() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: BUSINESS_INFO.name,
    url: SITE_URL,
    logo: `${SITE_URL}/icons/mellyna-icon-512.png`,
    description: SITE_DESCRIPTION,
    telephone: BUSINESS_INFO.telephone,
    email: BUSINESS_INFO.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: BUSINESS_INFO.addressLocality,
      addressRegion: BUSINESS_INFO.addressRegion,
      addressCountry: BUSINESS_INFO.addressCountry,
    },
    areaServed: BUSINESS_INFO.areaServed,
    hasMap: BUSINESS_INFO.mapsUrl,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (this also resolves Task 4 Step 3's pending import).

- [ ] **Step 3: Commit**

```bash
git add components/marketing/StructuredData.tsx
git commit -m "feat(seo): add EducationalOrganization JSON-LD structured data"
```

- [ ] **Step 4: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

## Task 6: Keyword-rich content updates

**Files:**
- Modify: `components/marketing/HeroSection.tsx:57-87`
- Modify: `components/marketing/LocationSection.tsx:19-29,48-52`
- Modify: `components/marketing/PartnersSection.tsx:9`
- Modify: `components/marketing/Footer.tsx:30-33,53-64`

No test — content-only string edits inside existing JSX, no logic. Verified visually in Task 7 by running the dev server and reading the rendered page.

- [ ] **Step 1: Update `HeroSection.tsx` badge and subtitle**

In `components/marketing/HeroSection.tsx`, find:

```typescript
          <Sparkles className="h-3.5 w-3.5" />
          Mellyna Education — Bimbingan Belajar Modern
        </motion.div>
```

Replace with:

```typescript
          <Sparkles className="h-3.5 w-3.5" />
          Mellyna Education — Bimbel Pamekasan, Pakong & Madura
        </motion.div>
```

Then find:

```typescript
          Platform bimbingan belajar dengan program SEMPOA, English, Calistung, dan banyak lagi.
          Laporan progres real-time langsung ke WhatsApp orang tua.
```

Replace with:

```typescript
          Bimbel SEMPOA, Calistung, dan Bahasa Inggris untuk anak TK dan SD di Pamekasan, Pakong,
          dan Madura. Laporan progres real-time langsung ke WhatsApp orang tua.
```

- [ ] **Step 2: Update `LocationSection.tsx` intro and address**

In `components/marketing/LocationSection.tsx`, find:

```typescript
          <p className="text-slate-500 max-w-xl mx-auto leading-relaxed">
            Kunjungi kantor Mellyna Education atau hubungi kami untuk informasi lebih lanjut.
          </p>
```

Replace with:

```typescript
          <p className="text-slate-500 max-w-xl mx-auto leading-relaxed">
            Kunjungi kantor bimbel kami di Pakong, Pamekasan atau hubungi kami untuk informasi lebih lanjut.
          </p>
```

Then find:

```typescript
                  <p className="text-sm text-slate-500 leading-relaxed mb-3">
                    Mellyna Education<br />
                    Jawa Timur, Indonesia
                  </p>
```

Replace with:

```typescript
                  <p className="text-sm text-slate-500 leading-relaxed mb-3">
                    Mellyna Education<br />
                    Kecamatan Pakong, Kabupaten Pamekasan<br />
                    Madura, Jawa Timur
                  </p>
```

- [ ] **Step 3: Update `PartnersSection.tsx` description**

In `components/marketing/PartnersSection.tsx`, find:

```typescript
    description: 'Mitra resmi program Mental Aritmetika & SEMPOA',
```

Replace with:

```typescript
    description: 'Mitra resmi Sempoa Kreatif Madura untuk program Mental Aritmetika & SEMPOA',
```

- [ ] **Step 4: Update `Footer.tsx` tagline and add visible NAP text**

In `components/marketing/Footer.tsx`, find:

```typescript
            <p className="text-sm leading-relaxed max-w-sm">
              Bimbingan belajar terpercaya untuk mendampingi anak meraih prestasi terbaik
              dengan program unggulan dan tutor berpengalaman bersertifikat.
            </p>
```

Replace with:

```typescript
            <p className="text-sm leading-relaxed max-w-sm">
              Bimbel SEMPOA, Calistung, dan Bahasa Inggris terpercaya di Pamekasan, Pakong, dan
              Madura — mendampingi anak TK dan SD meraih prestasi terbaik bersama tutor
              berpengalaman bersertifikat.
            </p>
```

Then find:

```typescript
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-me-yellow" />
                <a
                  href="https://maps.app.goo.gl/ZFnnCMCh7yo27j9m7"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors duration-200 leading-snug"
                >
                  Lihat Lokasi di Google Maps
                </a>
              </li>
```

Replace with:

```typescript
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-me-yellow" />
                <span className="leading-snug">
                  Pakong, Pamekasan, Madura
                  <br />
                  <a
                    href="https://maps.app.goo.gl/ZFnnCMCh7yo27j9m7"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors duration-200"
                  >
                    Lihat di Google Maps
                  </a>
                </span>
              </li>
```

- [ ] **Step 5: Commit**

```bash
git add components/marketing/HeroSection.tsx components/marketing/LocationSection.tsx components/marketing/PartnersSection.tsx components/marketing/Footer.tsx
git commit -m "feat(seo): work target keywords and real Pakong/Pamekasan address into landing copy"
```

- [ ] **Step 6: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

## Task 7: Verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all suites pass, including the 3 new tests in `lib/__tests__/seo.test.ts` and 3 in `__tests__/lib/seo-routes.test.ts`.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Build and confirm the SEO routes generate**

Run: `npm run build`
Expected: build succeeds; the route list printed by Next includes `○ /robots.txt` and `○ /sitemap.xml`.

- [ ] **Step 4: Manually inspect the generated output**

Run: `npm start` (in a separate terminal, after the build), then:

```bash
curl -s http://localhost:3000/robots.txt
curl -s http://localhost:3000/sitemap.xml
curl -s http://localhost:3000/ | grep -o '<title>[^<]*</title>'
curl -s http://localhost:3000/ | grep -o 'application/ld+json'
```

Expected:
- `robots.txt` shows `Allow: /`, the `Disallow:` list from Task 2, and `Sitemap: https://mellyna-education.my.id/sitemap.xml`.
- `sitemap.xml` shows one `<url>` entry for `https://mellyna-education.my.id`.
- The title tag reads `Mellyna Education — Bimbel Pamekasan, Pakong & Madura`.
- The `application/ld+json` script tag is present.

Stop the `npm start` process afterward.

- [ ] **Step 5: Report ke user**

Lapor hasil verifikasi: command apa yang dijalankan, hasil test/build/curl, dan konfirmasi robots.txt + sitemap.xml + metadata + JSON-LD sudah aktif di homepage.

---

## Out of scope (explicitly, so nobody re-adds it later)

- **Google Search Console HTML meta-tag verification** — user is verifying domain ownership via DNS TXT record instead, which needs no code change.
- **A dedicated 1200x630 OG banner image** — Task 1 reuses the existing 512x512 app icon as a placeholder (`ponytail:` comment left in `lib/seo.ts`); design a proper banner later if social-share previews need to look better than a logo crop.
- **Separate landing pages per keyword** (e.g. `/bimbel-pamekasan`, `/bimbel-madura`) — the site is a single-page marketing app in front of an authenticated dashboard; splitting into multiple public pages is a bigger content/IA decision, not a mechanical SEO fix, and should go through brainstorming if wanted.
