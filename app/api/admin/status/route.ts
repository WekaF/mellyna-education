import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSessionStatus } from '@/lib/waha'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const wahaStatus = await getSessionStatus()

  let n8nStatus = 'OFFLINE'
  try {
    const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace('/webhook', '') ?? 'http://localhost:5678'
    const res = await fetch(`${n8nUrl}/healthz`, { signal: AbortSignal.timeout(3000) })
    n8nStatus = res.ok ? 'ONLINE' : 'ERROR'
  } catch {
    n8nStatus = 'OFFLINE'
  }

  return NextResponse.json({
    whatdesks: {
      status: wahaStatus,
      dashboardUrl: process.env.WHATDESKS_BASE_URL ?? 'https://whatdesks.mellyna-education.my.id',
    },
    n8n: {
      status: n8nStatus,
      dashboardUrl: (process.env.N8N_WEBHOOK_BASE_URL ?? 'http://localhost:5678/webhook').replace('/webhook', ''),
      workflowFile: 'docs/n8n-schedule-workflow.json',
    },
  })
}
