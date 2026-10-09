'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Pencil, Check, X, ArrowLeft } from 'lucide-react'
import { useConfirm } from '@/lib/hooks/use-confirm'

interface MainProgramRow {
  code: string
  name: string
  order: number
  isActive: boolean
  _count: { classes: number }
}

export default function MainProgramsClient({ initial }: { initial: MainProgramRow[] }) {
  const confirm = useConfirm()
  const [rows, setRows] = useState<MainProgramRow[]>(initial)
  const [name, setName] = useState('')
  const [order, setOrder] = useState(initial.length + 1)
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editOrder, setEditOrder] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const res = await fetch('/api/main-programs')
    if (res.ok) setRows(await res.json())
  }, [])

  const call = async (url: string, init: RequestInit): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === 'string' ? body.error : 'Gagal menyimpan.')
      }
      await reload()
      return true
    } catch (err: any) {
      setError(err.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await call('/api/main-programs', { method: 'POST', body: JSON.stringify({ name, order }) })
    if (ok) {
      setName('')
      setOrder(o => o + 1)
    }
  }

  const startEdit = (row: MainProgramRow) => {
    setEditing(row.code)
    setEditName(row.name)
    setEditOrder(row.order)
  }

  const handleSaveEdit = async (code: string) => {
    const ok = await call(`/api/main-programs/${code}`, {
      method: 'PUT',
      body: JSON.stringify({ name: editName, order: editOrder }),
    })
    if (ok) setEditing(null)
  }

  const handleToggle = (row: MainProgramRow) =>
    call(`/api/main-programs/${row.code}`, { method: 'PUT', body: JSON.stringify({ isActive: !row.isActive }) })

  const handleDelete = async (row: MainProgramRow) => {
    const ok = await confirm({
      title: 'Hapus Program Utama',
      message: `Hapus program utama "${row.name}"?`,
      variant: 'danger',
      confirmLabel: 'Hapus',
    })
    if (ok) await call(`/api/main-programs/${row.code}`, { method: 'DELETE' })
  }

  const input = 'px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500'

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/classes" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Kelas
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-800 mt-2">Master Program Utama</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Program utama = jenis kelas (mis. Sempoa, Calistung, English). Program nonaktif tidak muncul di form kelas baru.
        </p>
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">⚠️ {error}</div>}

      <form onSubmit={handleCreate} className="rounded-2xl bg-white border border-slate-100 p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Program *</label>
          <input required maxLength={50} value={name} onChange={e => setName(e.target.value)} className={`w-full ${input}`} placeholder="mis. Coding Kids" />
        </div>
        <div className="sm:w-28">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Urutan</label>
          <input type="number" min={0} value={order} onChange={e => setOrder(Number(e.target.value))} className={`w-full ${input}`} />
        </div>
        <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
          <Plus className="h-4 w-4" /> Tambah
        </button>
      </form>

      <div className="rounded-2xl bg-white border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="text-left px-4 py-3">Kode</th>
              <th className="text-left px-4 py-3">Nama</th>
              <th className="text-left px-4 py-3">Urutan</th>
              <th className="text-left px-4 py-3">Kelas</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.code} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.code}</td>
                <td className="px-4 py-3">
                  {editing === row.code
                    ? <input value={editName} maxLength={50} onChange={e => setEditName(e.target.value)} className={input} />
                    : <span className="font-semibold text-slate-800">{row.name}</span>}
                </td>
                <td className="px-4 py-3">
                  {editing === row.code
                    ? <input type="number" min={0} value={editOrder} onChange={e => setEditOrder(Number(e.target.value))} className={`w-20 ${input}`} />
                    : row.order}
                </td>
                <td className="px-4 py-3">{row._count.classes}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleToggle(row)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-full cursor-pointer ${row.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {row.isActive ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {editing === row.code ? (
                      <>
                        <button aria-label="Simpan" disabled={saving} onClick={() => handleSaveEdit(row.code)} className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 cursor-pointer"><Check className="h-4 w-4" /></button>
                        <button aria-label="Batal" onClick={() => setEditing(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 cursor-pointer"><X className="h-4 w-4" /></button>
                      </>
                    ) : (
                      <>
                        <button aria-label="Edit" onClick={() => startEdit(row)} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"><Pencil className="h-4 w-4" /></button>
                        <button aria-label="Hapus" disabled={saving} onClick={() => handleDelete(row)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
