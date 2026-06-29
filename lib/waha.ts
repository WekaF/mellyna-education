// WhatsApp adapter — calls Waguzz (self-hosted WA gateway) via static API key.
// Exports are identical to the previous adapter so all 13+ callers stay unchanged.

function cfg() {
  return {
    base: process.env.WAGUZZ_BASE_URL ?? 'http://localhost:3000',
    apiKey: process.env.WAGUZZ_API_KEY ?? '',
  }
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': cfg().apiKey,
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^0/, '62')
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function randomDelay(minMs = 3000, maxMs = 7000): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  try {
    const { base } = cfg()
    const res = await fetch(`${base}/wa/send-text`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ phone: normalizePhone(phone), message }),
    })
    if (!res.ok) {
      const body = typeof res.text === 'function' ? await res.text().catch(() => '') : ''
      console.error(`[WAGUZZ] sendText failed ${res.status} for ${phone}: ${body}`)
      return false
    }
    return true
  } catch (e) {
    console.error('[WAGUZZ] sendText error:', e)
    return false
  }
}

export async function sendWhatsAppFile(
  phone: string,
  base64Data: string,
  filename: string,
  mimetype: string,
  caption: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { base } = cfg()
    const res = await fetch(`${base}/wa/send-file`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        phone: normalizePhone(phone),
        base64: base64Data,
        filename,
        mimetype,
        caption,
      }),
    })
    if (!res.ok) {
      const body = typeof res.text === 'function' ? await res.text().catch(() => '(no body)') : '(no body)'
      console.error(`[WAGUZZ] sendFile failed ${res.status}: ${body}`)
      return { ok: false, error: `WAGUZZ ${res.status}: ${body}` }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[WAGUZZ] sendFile error:', e)
    return { ok: false, error: `Network error: ${msg}` }
  }
}

export async function getSessionStatus(): Promise<string> {
  try {
    const { base, apiKey } = cfg()
    const res = await fetch(`${base}/wa/status`, {
      headers: { 'X-Api-Key': apiKey },
    })
    if (!res.ok) {
      console.error(`[WAGUZZ] getSessionStatus failed ${res.status}`)
      return 'UNKNOWN'
    }
    const data = (await res.json()) as { status: string }
    return data.status === 'CONNECTED' ? 'WORKING' : 'STOPPED'
  } catch (e) {
    console.error('[WAGUZZ] getSessionStatus error:', e)
    return 'OFFLINE'
  }
}
