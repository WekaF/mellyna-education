'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface ProfileClientProps {
  user: { id: string; name: string; email: string; phone: string | null }
}

export default function ProfileClient({ user }: ProfileClientProps) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || '',
    password: '',
    confirmPassword: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (form.password && form.password !== form.confirmPassword) {
      setError('Konfirmasi password tidak cocok.')
      return
    }
    if (form.password && form.password.length < 6) {
      setError('Password minimal 6 karakter.')
      return
    }

    setSaving(true)
    try {
      const body: Record<string, string | null> = { name: form.name, phone: form.phone || null }
      if (form.password) body.password = form.password

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = typeof data.error === 'string'
          ? data.error
          : typeof data.error === 'object' && data.error !== null
            ? Object.values(data.error).flat().join(' ')
            : 'Gagal menyimpan.'
        throw new Error(msg)
      }

      setSuccess('Profil berhasil diperbarui!')
      setForm((f) => ({ ...f, password: '', confirmPassword: '' }))
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-violet-800 p-5 sm:p-8 text-white shadow-xl shadow-violet-600/10">
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">👤 Profil Saya</h1>
        <p className="mt-2 text-sm text-violet-100">Perbarui nama, nomor HP, atau password akun Anda.</p>
      </div>

      <div className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 p-6 shadow-xs">
        <div className="mb-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/40">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Email (tidak dapat diubah)</p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{user.email}</p>
        </div>

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 px-3.5 py-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">No. HP / WhatsApp</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="08123456789"
              className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 px-3.5 py-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Ubah Password (opsional)</p>
            <div className="space-y-3">
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Password baru (min. 6 karakter)"
                className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 px-3.5 py-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
              />
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Konfirmasi password baru"
                className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 px-3.5 py-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-semibold text-sm transition-all cursor-pointer shadow-md shadow-violet-500/20"
            >
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
