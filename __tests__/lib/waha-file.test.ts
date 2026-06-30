// Reset module cache between tests to clear JWT token cache in lib/waha.ts
beforeEach(() => {
  jest.resetModules()
})

const mockFetch = jest.fn()
global.fetch = mockFetch

afterEach(() => {
  mockFetch.mockClear()
})

describe('sendWhatsAppFile — WhatDesks 2-step flow', () => {
  it('calls login, upload, then send — returns ok:true on success', async () => {
    // Call 1: JWT login
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'test-jwt-token' }),
    } as Response)
    // Call 2: multipart upload → returns CDN url + message_type
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://cdn.example.com/invoice.pdf', message_type: 'document' }),
    } as Response)
    // Call 3: send message with media reference
    mockFetch.mockResolvedValueOnce({ ok: true } as Response)

    const { sendWhatsAppFile } = await import('@/lib/waha')
    const result = await sendWhatsAppFile(
      '08123456789',
      'JVBERi0xLjQ=',
      'invoice.pdf',
      'application/pdf',
      'Invoice tagihan bimbel'
    )

    expect(result).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(3)

    // Verify step 1: login endpoint
    const [loginUrl] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(loginUrl).toContain('/auth/login')

    // Verify step 2: upload endpoint with Bearer token
    const [uploadUrl, uploadOpts] = mockFetch.mock.calls[1] as [string, RequestInit]
    expect(uploadUrl).toContain('/api/messages/upload')
    expect((uploadOpts.headers as Record<string, string>)['Authorization']).toBe('Bearer test-jwt-token')

    // Verify step 3: send with normalized phone, caption, media_url
    const [sendUrl, sendOpts] = mockFetch.mock.calls[2] as [string, RequestInit]
    expect(sendUrl).toContain('/api/messages/send')
    const sendBody = JSON.parse(sendOpts.body as string)
    expect(sendBody.phone).toBe('628123456789')
    expect(sendBody.message).toBe('Invoice tagihan bimbel')
    expect(sendBody.media_url).toBe('https://cdn.example.com/invoice.pdf')
    expect(sendBody.file_name).toBe('invoice.pdf')
  })

  it('returns ok:false when upload step fails — no send call made', async () => {
    // Call 1: login OK
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'test-jwt-token' }),
    } as Response)
    // Call 2: upload fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 413,
      text: async () => 'Payload Too Large',
    } as Response)

    const { sendWhatsAppFile } = await import('@/lib/waha')
    const result = await sendWhatsAppFile('08123456789', 'abc', 'f.pdf', 'application/pdf', '')

    expect(result.ok).toBe(false)
    expect(mockFetch).toHaveBeenCalledTimes(2) // login + upload only, no send
  })
})
