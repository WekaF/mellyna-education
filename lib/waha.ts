// WhatsApp adapter — calls WhatDesks API via JWT auth.
// Exports are identical to the previous adapter so all 13+ callers stay unchanged.

// Read lazily inside a function to avoid webpack baking undefined at build time
// (Next.js SSG runs during docker build; ARG/ENV in Dockerfile ensures values are set)
function cfg() {
  return {
    base: process.env.WHATDESKS_BASE_URL ?? 'https://whatdesks.mellyna-education.my.id',
    email: process.env.WHATDESKS_EMAIL ?? '',
    password: process.env.WHATDESKS_PASSWORD ?? '',
    deviceId: parseInt(process.env.WHATDESKS_DEVICE_ID ?? '3', 10),
    deviceUuid: process.env.WHATDESKS_DEVICE_UUID ?? '',
  }
}

// JWT token cache — login once, reuse for ~60 hours, refresh before expiry
let _token: string | null = null
let _tokenExpiry = 0

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token
  const { base, email, password } = cfg()
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`[WHATDESKS] login failed ${res.status}: ${body}`)
  }
  const data = await res.json()
  _token = data.token as string
  _tokenExpiry = Date.now() + 60 * 60 * 1000 * 60 // cache 60 h (JWT TTL is 72 h)
  return _token!
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
    const token = await getToken()
    const { base, deviceId } = cfg()
    const res = await fetch(`${base}/api/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        device_id: deviceId,
        phone: normalizePhone(phone),
        message,
        message_type: 'text',
      }),
    })
    if (!res.ok) {
      if (res.status === 401) _token = null // force re-login next call
      const body = await res.text().catch(() => '(no body)')
      console.error(`[WHATDESKS] sendText failed ${res.status} for ${phone}: ${body}`)
      return false
    }
    return true
  } catch (e) {
    console.error('[WHATDESKS] sendText error:', e)
    return false
  }
}

export async function sendWhatsAppFile(
  phone: string,
  base64Data: string,
  filename: string,
  mimetype: string,
  caption: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const token = await getToken()
    const { base, deviceId } = cfg()

    // Step 1: convert base64 → Buffer → multipart upload
    const binary = Buffer.from(base64Data, 'base64')
    const blob = new Blob([binary], { type: mimetype })
    const form = new FormData()
    form.append('file', blob, filename)

    const uploadRes = await fetch(`${base}/api/messages/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    if (!uploadRes.ok) {
      if (uploadRes.status === 401) _token = null
      const body = await uploadRes.text().catch(() => '(no body)')
      console.error(`[WHATDESKS] upload failed ${uploadRes.status}: ${body}`)
      return { ok: false, error: `WHATDESKS upload ${uploadRes.status}: ${body}` }
    }
    const { url, message_type } = (await uploadRes.json()) as {
      url: string
      message_type: string
    }

    // Step 2: send message referencing the uploaded file
    const sendRes = await fetch(`${base}/api/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        device_id: deviceId,
        phone: normalizePhone(phone),
        message: caption,
        message_type,
        media_url: url,
        file_name: filename,
      }),
    })
    if (!sendRes.ok) {
      if (sendRes.status === 401) _token = null
      const body = await sendRes.text().catch(() => '(no body)')
      console.error(`[WHATDESKS] sendFile failed ${sendRes.status} for ${phone}: ${body}`)
      return { ok: false, error: `WHATDESKS send ${sendRes.status}: ${body}` }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[WHATDESKS] sendFile error:', e)
    return { ok: false, error: `Network error: ${msg}` }
  }
}

// Returns WAHA-compatible status strings so callers checking 'WORKING' keep working
export async function getSessionStatus(): Promise<string> {
  try {
    const token = await getToken()
    const { base, deviceUuid } = cfg()
    const res = await fetch(`${base}/api/devices/${deviceUuid}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      console.error(`[WHATDESKS] getSessionStatus failed ${res.status}`)
      return 'UNKNOWN'
    }
    const raw = await res.json()
    // Handle array response (list endpoint) or direct object
    const device = Array.isArray(raw) ? raw[0] : raw
    if (!device) return 'UNKNOWN'
    // whatdesks statuses: CONNECTED / DISCONNECTED / CONNECTING
    const status: string = device.status ?? device.link_status ?? ''
    console.log(`[WHATDESKS] device status: ${status}`)
    return status === 'CONNECTED' ? 'WORKING' : 'STOPPED'
  } catch (e) {
    console.error('[WHATDESKS] getSessionStatus error:', e)
    return 'OFFLINE'
  }
}
