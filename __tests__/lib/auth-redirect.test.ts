describe('NextAuth redirect callback — relative URLs immune to bad NEXTAUTH_URL', () => {
  async function redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
    if (url.startsWith('/')) return url
    try {
      if (new URL(url).origin === baseUrl) return url
    } catch {
      // malformed url — fall through to baseUrl
    }
    return baseUrl
  }

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
})
