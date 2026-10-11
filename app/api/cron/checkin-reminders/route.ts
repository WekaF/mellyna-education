import { NextRequest, NextResponse } from 'next/server'
import { sendCheckInReminders } from '@/lib/checkin-reminders'

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}

// Pemicu manual/eksternal. Dalam operasi normal pengingat dijalankan timer internal (lib/internal-cron.ts).
async function handleCron(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') ?? req.headers.get('x-cron-secret')
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET ?? 'change-this-to-random-secret'

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized: Invalid cron secret.' }, { status: 401 })
  }

  try {
    return NextResponse.json({ success: true, ...(await sendCheckInReminders()) })
  } catch (error: any) {
    console.error('[Cron Check-in Reminder] Failed:', error)
    return NextResponse.json({ error: error.message || 'Gagal memproses pengingat absen.' }, { status: 500 })
  }
}
