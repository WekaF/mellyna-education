import type { Metadata, Viewport } from 'next'
import { Outfit, Fredoka, Nunito } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Providers } from './providers'
import { PwaInstallPrompt } from '@/components/pwa-install-prompt'

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
    <html
      lang="id"
      className={`${outfit.variable} ${fredoka.variable} ${nunito.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
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
