import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendWhatsApp } from '@/lib/waha'

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const baseUrl = process.env.WHATDESKS_BASE_URL ?? '(not set)'
  const email = process.env.WHATDESKS_EMAIL ?? '(not set)'
  const deviceId = process.env.WHATDESKS_DEVICE_ID ?? '(not set)'

  // Raw login test — diagnose actual error
  let loginStatus = 'unknown'
  let loginError = ''
  try {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: process.env.WHATDESKS_PASSWORD }),
    })
    loginStatus = `${loginRes.status}`
    if (!loginRes.ok) loginError = await loginRes.text().catch(() => '')
  } catch (e) {
    loginStatus = 'NETWORK_ERROR'
    loginError = e instanceof Error ? e.message : String(e)
  }

  const diagnostics = { baseUrl, email, deviceId, loginStatus, loginError }

  const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
  const message = `🧪 *Test WhatDesks — Mellyna Education*\n\nPesan uji coba untuk memverifikasi koneksi WhatsApp via WhatDesks berjalan dengan baik.\n\nWaktu: ${now}`

  const results: Array<{ label: string; phone: string; success: boolean; error?: string }> = []

  const parentPhone = '081216046911'
  const parentOk = await sendWhatsApp(parentPhone, message)
  results.push({ label: 'Parent (081216046911)', phone: parentPhone, success: parentOk })

  const tutor = await prisma.user.findFirst({
    where: { name: { contains: 'tutorcoba', mode: 'insensitive' } },
    select: { name: true, phone: true },
  })
  if (!tutor) {
    results.push({ label: 'Tutor (tutorcoba)', phone: '-', success: false, error: 'User tidak ditemukan di database' })
  } else if (!tutor.phone) {
    results.push({ label: `Tutor (${tutor.name})`, phone: '-', success: false, error: 'Nomor telepon tutor kosong' })
  } else {
    const tutorOk = await sendWhatsApp(tutor.phone, message)
    results.push({ label: `Tutor (${tutor.name})`, phone: tutor.phone, success: tutorOk })
  }

  const allOk = results.every(r => r.success)
  return NextResponse.json({ ok: allOk, results, diagnostics })
}
