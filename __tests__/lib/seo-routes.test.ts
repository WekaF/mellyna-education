import robots from '@/app/robots'
import sitemap from '@/app/sitemap'

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

describe('sitemap.ts', () => {
  it('lists the homepage as the only indexable entry', () => {
    const result = sitemap()
    expect(result).toHaveLength(1)
    expect(result[0].url).toBe('https://mellyna-education.my.id')
    expect(result[0].priority).toBe(1)
  })
})
