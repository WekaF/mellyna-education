const WAHA_BASE = process.env.WAHA_BASE_URL ?? 'http://localhost:3001'
const WAHA_KEY = process.env.WAHA_API_KEY ?? ''
const WAHA_SESSION = process.env.WAHA_SESSION ?? 'mellyna'

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Returns random ms between min and max (inclusive)
export function randomDelay(minMs = 3000, maxMs = 7000): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

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

export async function sendWhatsAppFile(
  phone: string,
  base64Data: string,
  filename: string,
  mimetype: string,
  caption: string
): Promise<boolean> {
  const chatId = `${phone.replace(/\D/g, '').replace(/^0/, '62')}@c.us`
  try {
    const res = await fetch(`${WAHA_BASE}/api/sendFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': WAHA_KEY },
      body: JSON.stringify({
        session: WAHA_SESSION,
        chatId,
        file: {
          data: `data:${mimetype};base64,${base64Data}`,
          filename,
        },
        caption,
      }),
    })
    return res.ok
  } catch (e) {
    console.error('[Mellyna] WAHA sendFile failed:', e)
    return false
  }
}
