const WAHA_BASE = process.env.WAHA_BASE_URL ?? 'http://localhost:3001'
const WAHA_KEY = process.env.WAHA_API_KEY ?? ''
const WAHA_SESSION = process.env.WAHA_SESSION ?? 'mellyna'

export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const chatId = `${phone.replace(/\D/g, '').replace(/^0/, '62')}@c.us`
  try {
    const res = await fetch(`${WAHA_BASE}/api/sendText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': WAHA_KEY },
      body: JSON.stringify({ session: WAHA_SESSION, chatId, text: message }),
    })
    return res.ok
  } catch (e) {
    console.error('[Mellyna] WAHA send failed:', e)
    return false
  }
}

export async function getSessionStatus(): Promise<string> {
  try {
    const res = await fetch(`${WAHA_BASE}/api/sessions/${WAHA_SESSION}`, {
      headers: { 'X-Api-Key': WAHA_KEY },
    })
    if (!res.ok) return 'UNKNOWN'
    const data = await res.json()
    return data.status ?? 'UNKNOWN'
  } catch {
    return 'OFFLINE'
  }
}
