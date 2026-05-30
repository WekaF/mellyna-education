import { POST } from '@/app/api/webhooks/midtrans/route'
import { NextRequest } from 'next/server'

describe('POST /api/webhooks/midtrans', () => {
  it('rejects invalid signature with 403', async () => {
    process.env.MIDTRANS_SERVER_KEY = 'test-server-key'
    const req = new NextRequest('http://localhost/api/webhooks/midtrans', {
      method: 'POST',
      body: JSON.stringify({
        order_id: 'inv_test_001',
        status_code: '200',
        gross_amount: '350000.00',
        signature_key: 'invalid_bad_signature',
        transaction_status: 'settlement',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })
})
