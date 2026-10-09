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
