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
