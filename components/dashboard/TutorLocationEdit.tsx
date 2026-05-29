'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function TutorLocationEdit({
  scheduleId,
  location,
}: {
  scheduleId: string
  location: string | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(location ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: value }),
      })
      setEditing(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-400"
          placeholder="Lokasi mengajar..."
          autoFocus
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs bg-indigo-600 text-white px-2 py-1 rounded-lg disabled:opacity-50"
        >
          {saving ? '...' : 'Simpan'}
        </button>
        <button
          onClick={() => { setEditing(false); setValue(location ?? '') }}
          className="text-xs text-slate-400 hover:text-slate-600 px-1"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <p
      className="text-xs text-slate-400 mt-1 cursor-pointer hover:text-indigo-600 transition-colors"
      onClick={() => setEditing(true)}
      title="Klik untuk edit lokasi"
    >
      📍 {location || 'Tambah lokasi…'}
    </p>
  )
}
