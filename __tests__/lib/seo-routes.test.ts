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
