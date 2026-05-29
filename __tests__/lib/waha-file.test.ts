// Mock global fetch before importing
const mockFetch = jest.fn()
global.fetch = mockFetch

import { sendWhatsAppFile } from '@/lib/waha'

beforeEach(() => mockFetch.mockClear())

describe('sendWhatsAppFile', () => {
  it('calls WAHA sendFile endpoint with correct payload', async () => {
    mockFetch.mockResolvedValue({ ok: true } as Response)

    const result = await sendWhatsAppFile(
      '08123456789',
      'JVBERi0xLjQ=',
      'invoice.pdf',
      'application/pdf',
      'Invoice tagihan bimbel'
    )

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/sendFile')
    const body = JSON.parse(opts.body as string)
    expect(body.chatId).toBe('628123456789@c.us')
    expect(body.file.filename).toBe('invoice.pdf')
    expect(body.caption).toBe('Invoice tagihan bimbel')
  })

  it('returns false on WAHA error', async () => {
    mockFetch.mockResolvedValue({ ok: false } as Response)
    const result = await sendWhatsAppFile('08123456789', 'abc', 'f.pdf', 'application/pdf', '')
    expect(result).toBe(false)
  })
})
