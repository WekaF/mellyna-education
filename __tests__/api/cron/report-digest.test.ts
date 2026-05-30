import { GET } from '@/app/api/cron/report-digest/route'
import { NextRequest } from 'next/server'

describe('GET /api/cron/report-digest', () => {
  it('returns 401 without valid secret', async () => {
    process.env.N8N_WEBHOOK_SECRET = 'test-secret'
    const req = new NextRequest(
      'http://localhost/api/cron/report-digest?type=daily&secret=wrong'
    )
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for unknown type', async () => {
    process.env.N8N_WEBHOOK_SECRET = 'test-secret'
    const req = new NextRequest(
      'http://localhost/api/cron/report-digest?type=monthly&secret=test-secret'
    )
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})
