import { getSessionStatus } from '@/lib/waha'
import { prisma } from '@/lib/db'
import SettingsClient from './SettingsClient'

export default async function AdminSettingsPage() {
  const wahaStatus = await getSessionStatus()

  let n8nStatus = 'OFFLINE'
  try {
    const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace('/webhook', '') ?? 'http://localhost:5678'
    const res = await fetch(`${n8nUrl}/healthz`, { signal: AbortSignal.timeout(3000) })
    n8nStatus = res.ok ? 'ONLINE' : 'ERROR'
  } catch {
    n8nStatus = 'OFFLINE'
  }

  const autoBroadcastSetting = await prisma.systemSetting.findFirst({
    where: { key: 'AUTO_TIMETABLE_BROADCAST' },
  })
  const autoBroadcast = autoBroadcastSetting?.value !== 'false'

  const initialStatus = {
    whatdesks: {
      status: wahaStatus,
      dashboardUrl: process.env.WHATDESKS_BASE_URL ?? 'https://whatdesks.mellyna-education.my.id',
    },
    n8n: {
      status: n8nStatus,
      dashboardUrl: (process.env.N8N_WEBHOOK_BASE_URL ?? 'http://localhost:5678/webhook').replace('/webhook', ''),
      workflowFile: 'docs/n8n-schedule-workflow.json',
    },
  }

  return <SettingsClient initialStatus={initialStatus} initialAutoBroadcast={autoBroadcast} />
}
