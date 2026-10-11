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
  verification: {
    google: 'Yq6-6KXvxmIDC6x8uJrfS5DZOd04MBdVu5iR1krffyY',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${outfit.variable} ${fredoka.variable} ${nunito.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <StructuredData />
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
