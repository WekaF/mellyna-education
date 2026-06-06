'use client'

import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { useConfirm } from '@/lib/hooks/use-confirm'

interface Announcement {
  id: string
  title: string
  content: string
  published: boolean
  createdAt: string
}

interface AnnouncementsClientProps {
  initialAnnouncements: Announcement[]
}

export default function AnnouncementsClient({ initialAnnouncements }: AnnouncementsClientProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', published: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/announcements')
      setAnnouncements(await res.json())
    } catch {
      setError('Gagal memuat pengumuman.')
    } finally {
      setLoading(false)
    }
  }, [])

  const triggerBroadcast = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/announcements/${id}/broadcast`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        console.log(`[Broadcast] WA dikirim ke ${data.recipientCount} penerima.`)
      } else {
        console.warn(`[Broadcast] Broadcast tidak berhasil: ${data.error}`)
      }
    } catch (e) {
      console.error('[Broadcast] Error saat broadcast:', e)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const shouldBroadcast = form.published
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Gagal menyimpan pengumuman.')
      const created = await res.json()
      await fetchAnnouncements()
      setShowForm(false)
      setForm({ title: '', content: '', published: false })
      // Broadcast immediately if created as published
      if (shouldBroadcast && created?.id) {
        await triggerBroadcast(created.id)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePublish = useCallback(async (id: string, published: boolean) => {
    const willPublish = !published
    try {
      await fetch(`/api/announcements/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: willPublish }),
      })
      await fetchAnnouncements()
      // Trigger WA broadcast only when publishing (not when hiding)
      if (willPublish) {
        await triggerBroadcast(id)
      }
    } catch {
      setError('Gagal memperbarui status pengumuman.')
    }
  }, [fetchAnnouncements, triggerBroadcast])

  const handleDelete = useCallback(async (id: string) => {
    const ok = await confirm({
      title: 'Hapus Pengumuman',
      message: 'Hapus pengumuman ini secara permanen?',
      variant: 'danger',
      confirmLabel: 'Hapus',
    })
    if (!ok) return
    try {
      await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
      await fetchAnnouncements()
    } catch {
      setError('Gagal menghapus pengumuman.')
    }
  }, [confirm, fetchAnnouncements])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">📢 Pengumuman</h1>
          <p className="text-sm text-slate-500 mt-0.5">Buat dan kelola pengumuman untuk orang tua siswa.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Buat Pengumuman
        </button>
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">⚠️ {error}</div>}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6 space-y-4">
          <h2 className="font-bold text-slate-800">Buat Pengumuman Baru</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Judul Pengumuman *</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Judul pengumuman"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Isi Pengumuman *</label>
              <textarea
                required
                rows={4}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="Tulis isi pengumuman di sini..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="published"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="published" className="text-sm text-slate-700 font-medium">Terbitkan sekarang (langsung tampil ke orang tua)</label>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan Pengumuman'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">Batal</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="p-10 text-center"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" /></div>
        ) : announcements.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
            <p className="text-3xl">📭</p>
            <p className="mt-2 text-sm">Belum ada pengumuman yang dibuat.</p>
          </div>
        ) : (
          announcements.map((ann) => (
            <div key={ann.id} className="rounded-2xl bg-white border border-slate-100 shadow-xs p-5 flex gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-slate-800">{ann.title}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ann.published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {ann.published ? 'Diterbitkan' : 'Draft'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">{ann.content}</p>
                <p className="text-xs text-slate-400 mt-2">{new Date(ann.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => handleTogglePublish(ann.id, ann.published)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${ann.published ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                >
                  {ann.published ? 'Sembunyikan' : 'Terbitkan'}
                </button>
                <button
                  onClick={() => handleDelete(ann.id)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer transition-colors"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
