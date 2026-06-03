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
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: http://localhost:9000 https:",
      "connect-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com https://app.sandbox.midtrans.com https://app.midtrans.com https://*.tile.openstreetmap.org https://unpkg.com https://sempoakreatif.com https://ahe.education",
      "font-src 'self' https://fonts.gstatic.com",
      "media-src 'self' http://localhost:9000 https:",
      "frame-src https://app.sandbox.midtrans.com https://app.midtrans.com",
      "worker-src 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000' },
      { protocol: 'https', hostname: process.env.MINIO_ENDPOINT || 'localhost' },
      { protocol: 'https', hostname: 'media.mellyna-education.my.id' },
      { protocol: 'https', hostname: 'sempoakreatif.com' },
      { protocol: 'https', hostname: 'ahe.education' },
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
