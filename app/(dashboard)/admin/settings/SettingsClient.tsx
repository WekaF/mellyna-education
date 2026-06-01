'use client'

import { useState } from 'react'
import { ExternalLink, RefreshCw, Wifi, WifiOff, Bell, BellOff } from 'lucide-react'

interface IntegrationStatus {
  waha: {
    status: string
    dashboardUrl: string
    session: string
  }
  n8n: {
    status: string
    dashboardUrl: string
    workflowFile: string
  }
}

interface Props {
  initialStatus: IntegrationStatus | null
  initialAutoBroadcast: boolean
}

const StatusBadge = ({ status }: { status: string }) => {
  const isOnline = status === 'WORKING' || status === 'ONLINE'
  const isOff = status === 'OFFLINE' || status === 'STOPPED'
  const color = isOnline
    ? 'bg-emerald-100 text-emerald-700'
    : isOff
    ? 'bg-rose-100 text-rose-700'
    : 'bg-amber-100 text-amber-700'
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${color}`}>
      {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {status}
    </span>
  )
}

export default function SettingsClient({ initialStatus, initialAutoBroadcast }: Props) {
  const [status, setStatus] = useState<IntegrationStatus | null>(initialStatus)
  const [loading, setLoading] = useState(false)
  const [autoBroadcast, setAutoBroadcast] = useState(initialAutoBroadcast)
  const [savingBroadcast, setSavingBroadcast] = useState(false)

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/status')
      if (res.ok) setStatus(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const toggleAutoBroadcast = async () => {
    const next = !autoBroadcast
    setSavingBroadcast(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'AUTO_TIMETABLE_BROADCAST', value: next ? 'true' : 'false' }),
      })
      if (res.ok) setAutoBroadcast(next)
    } finally {
      setSavingBroadcast(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">⚙️ Pengaturan &amp; Integrasi</h1>
          <p className="text-sm text-slate-500 mt-0.5">Status koneksi WAHA (WhatsApp) dan n8n Automation.</p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Auto-Broadcast Toggle */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-extrabold text-slate-800 flex items-center gap-2">
              {autoBroadcast ? <Bell className="h-4 w-4 text-emerald-600" /> : <BellOff className="h-4 w-4 text-slate-400" />}
              Auto-Broadcast Jadwal Mingguan
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Saat aktif, cron otomatis akan membuat jadwal mingguan dan mengirim notifikasi WhatsApp ke semua orang tua &amp; tutor.
              Saat dimatikan, jadwal tetap dibuat oleh cron tapi WA tidak dikirim.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleAutoBroadcast}
            disabled={savingBroadcast}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
              autoBroadcast ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
            }`}
            role="switch"
            aria-checked={autoBroadcast}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                autoBroadcast ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <div className={`rounded-xl p-3 text-xs font-semibold ${autoBroadcast ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
          Status: <strong>{autoBroadcast ? '✅ Auto-broadcast AKTIF' : '🔕 Auto-broadcast DIMATIKAN'}</strong>
          {!autoBroadcast && ' — Cron akan tetap membuat jadwal tapi tidak mengirim WA.'}
        </div>
      </div>

      {/* WAHA Section */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-extrabold text-slate-800">📱 WAHA — WhatsApp HTTP API</h2>
            <p className="text-xs text-slate-500 mt-1">Layanan notifikasi WhatsApp otomatis ke orang tua siswa.</p>
          </div>
          {status && <StatusBadge status={status.waha.status} />}
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cara Setup Sesi WhatsApp</p>
          <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside">
            <li>Jalankan <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">docker compose up -d waha</code></li>
            <li>Buka dashboard WAHA di tombol di bawah</li>
            <li>Login dengan username <strong>admin</strong> dan password <strong>mellyna-waha-secret</strong></li>
            <li>Klik sesi <strong>{status?.waha.session ?? 'default'}</strong> → Start → Scan QR code dengan WhatsApp</li>
            <li>Status akan berubah menjadi <strong>WORKING</strong> setelah QR berhasil di-scan</li>
          </ol>
        </div>

        {status && (
          <a
            href={status.waha.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Buka Dashboard WAHA
          </a>
        )}
      </div>

      {/* n8n Section */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-extrabold text-slate-800">⚡ n8n — Workflow Automation</h2>
            <p className="text-xs text-slate-500 mt-1">Workflow notifikasi jadwal cadangan via n8n → WAHA.</p>
          </div>
          {status && <StatusBadge status={status.n8n.status} />}
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cara Import Workflow n8n</p>
          <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside">
            <li>Jalankan <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">docker compose up -d n8n</code></li>
            <li>Buka dashboard n8n di tombol di bawah (login: admin / adminpassword)</li>
            <li>Klik <strong>Workflows</strong> → <strong>Import from File</strong></li>
            <li>Upload file <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">docs/n8n-schedule-workflow.json</code></li>
            <li>Buka workflow → klik <strong>Active</strong> toggle (atas kanan) untuk mengaktifkan</li>
            <li>Pastikan env <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">N8N_WEBHOOK_BASE_URL</code> mengarah ke n8n yang berjalan</li>
          </ol>

          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700">
            <strong>Catatan:</strong> n8n adalah fallback — jadwal sudah ter-broadcast langsung via WAHA saat diterbitkan. n8n digunakan untuk workflow tambahan atau retry otomatis.
          </div>
        </div>

        {status && (
          <a
            href={status.n8n.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Buka Dashboard n8n
          </a>
        )}
      </div>

      {/* Env Variables Reference */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-3">
        <h2 className="font-extrabold text-slate-800">📋 Referensi Environment Variables</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 pr-4 font-semibold text-slate-500">Variable</th>
                <th className="text-left py-2 font-semibold text-slate-500">Fungsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-600">
              {[
                ['WAHA_BASE_URL', 'URL WAHA service (default: http://localhost:3001)'],
                ['WAHA_API_KEY', 'API key WAHA — harus cocok dengan WHATSAPP_API_KEY di docker-compose'],
                ['WAHA_SESSION', 'Nama sesi WhatsApp (default: default)'],
                ['N8N_WEBHOOK_BASE_URL', 'Base URL webhook n8n (default: http://localhost:5678/webhook)'],
                ['N8N_WEBHOOK_SECRET', 'Secret untuk autentikasi internal endpoint ke n8n'],
              ].map(([key, desc]) => (
                <tr key={key}>
                  <td className="py-2 pr-4 font-mono bg-slate-50 rounded px-2">{key}</td>
                  <td className="py-2 text-slate-500">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
