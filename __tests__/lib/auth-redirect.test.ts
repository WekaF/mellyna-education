import { authOptions } from '@/lib/auth'

describe('NextAuth redirect callback — relative URLs immune to bad NEXTAUTH_URL', () => {
  const redirect = authOptions.callbacks!.redirect! as (params: { url: string; baseUrl: string }) => Promise<string>

  it('returns a relative callbackUrl unchanged, even when baseUrl is wrong', async () => {
    const result = await redirect({ url: '/', baseUrl: 'http://localhost:3000' })
    expect(result).toBe('/')
  })

  it('returns a relative deep-link callbackUrl unchanged', async () => {
    const result = await redirect({ url: '/tutor', baseUrl: 'http://localhost:3000' })
    expect(result).toBe('/tutor')
  })

  it('allows an absolute url matching baseUrl origin', async () => {
    const result = await redirect({
      url: 'https://mellyna-education.my.id/tutor',
      baseUrl: 'https://mellyna-education.my.id',
    })
    expect(result).toBe('https://mellyna-education.my.id/tutor')
  })

  it('falls back to baseUrl for an absolute url on a different origin (open-redirect protection)', async () => {
    const result = await redirect({
      url: 'https://evil.example.com/phish',
      baseUrl: 'https://mellyna-education.my.id',
    })
    expect(result).toBe('https://mellyna-education.my.id')
  })

  it('falls back to baseUrl for a malformed url instead of throwing', async () => {
    const result = await redirect({ url: 'not a url', baseUrl: 'https://mellyna-education.my.id' })
    expect(result).toBe('https://mellyna-education.my.id')
  })

  it('falls back to baseUrl for a protocol-relative url (//evil.com), not treated as relative', async () => {
    const result = await redirect({
      url: '//evil.example.com/phish',
      baseUrl: 'https://mellyna-education.my.id',
    })
    expect(result).toBe('https://mellyna-education.my.id')
  })

  it('falls back to baseUrl for a backslash-relative url (/\\evil.com), browser-normalized to //', async () => {
    const result = await redirect({
      url: '/\\evil.example.com/phish',
      baseUrl: 'https://mellyna-education.my.id',
    })
    expect(result).toBe('https://mellyna-education.my.id')
  })

  it('falls back to baseUrl for a tab-prefixed protocol-relative url (browsers strip the tab, leaving //evil.com)', async () => {
    const result = await redirect({
      url: '/\t/evil.example.com/phish',
      baseUrl: 'https://mellyna-education.my.id',
    })
    expect(result).toBe('https://mellyna-education.my.id')
  })

  it('falls back to baseUrl for a newline-prefixed protocol-relative url', async () => {
    const result = await redirect({
      url: '/\n/evil.example.com/phish',
      baseUrl: 'https://mellyna-education.my.id',
    })
    expect(result).toBe('https://mellyna-education.my.id')
  })

  it('still allows a genuine relative url containing no control characters', async () => {
    const result = await redirect({ url: '/tutor/reports', baseUrl: 'http://localhost:3000' })
    expect(result).toBe('/tutor/reports')
  })
})
