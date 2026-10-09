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
