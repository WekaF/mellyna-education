export async function triggerSchedulePublished(scheduleId: string) {
  const url = `${process.env.N8N_WEBHOOK_BASE_URL}/schedule-published`
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET ?? '',
      },
      body: JSON.stringify({ scheduleId }),
    })
  } catch (e) {
    // n8n down should not block the API response
    console.error('[Mellyna] n8n trigger failed:', e)
  }
}
