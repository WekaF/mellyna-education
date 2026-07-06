export {} // module scope so top-level const doesn't collide with waha-file.test.ts

beforeEach(() => {
  jest.resetModules()
})

const mockFetch = jest.fn()
global.fetch = mockFetch

afterEach(() => {
  mockFetch.mockClear()
})

describe('sendWhatsApp — retry on transient send failure', () => {
  it('returns true on first-try success without retrying', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'jwt-1' }) } as Response) // login
    mockFetch.mockResolvedValueOnce({ ok: true } as Response) // send

    const { sendWhatsApp } = await import('@/lib/waha')
    const result = await sendWhatsApp('08123456789', 'Halo')

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('retries once after a failed send, then succeeds', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'jwt-1' }) } as Response) // login
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' } as Response) // send attempt 1
    mockFetch.mockResolvedValueOnce({ ok: true } as Response) // send attempt 2 (token cached, no re-login)

    const { sendWhatsApp } = await import('@/lib/waha')
    const result = await sendWhatsApp('08123456789', 'Halo')

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('returns false after both attempts fail', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'jwt-1' }) } as Response) // login
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' } as Response) // attempt 1
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom again' } as Response) // attempt 2

    const { sendWhatsApp } = await import('@/lib/waha')
    const result = await sendWhatsApp('08123456789', 'Halo')

    expect(result).toBe(false)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('clears cached token and does not retry-loop forever on repeated 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'jwt-1' }) } as Response) // login
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'expired' } as Response) // attempt 1: 401

    const { sendWhatsApp } = await import('@/lib/waha')
    // Attempt 2 needs a fresh login since 401 clears the cached token
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'jwt-2' }) } as Response) // re-login
    mockFetch.mockResolvedValueOnce({ ok: true } as Response) // attempt 2: send succeeds

    const result = await sendWhatsApp('08123456789', 'Halo')

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })
})
