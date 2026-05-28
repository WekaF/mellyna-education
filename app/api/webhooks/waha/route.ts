import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('X-Api-Key') || req.headers.get('x-api-key')

    if (apiKey !== process.env.WAHA_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { event, payload } = body

    if (event === 'session.status') {
      console.log('[WAHA Webhook] Session status changed:', payload)
    } else {
      console.log('[WAHA Webhook] Event received:', event, payload)
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[WAHA Webhook Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
