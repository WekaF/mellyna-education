'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Save } from 'lucide-react'

const statusOptions = [
  { value: 'PRESENT', label: 'Hadir' },
  { value: 'ABSENT', label: 'Alpha' },
  { value: 'SICK', label: 'Sakit' },
  { value: 'PERMISSION', label: 'Izin' },
]

interface Student {
  id: string
  name: string
  grade: string | null
}

interface Entry {
  studentId: string
  status: string
  notes: string
}

export default function TutorAttendancePage() {
  const params = useParams()
  const router = useRouter()
  const scheduleId = params.scheduleId as string

  const [schedule, setSchedule] = useState<any>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [schedRes, attRes] = await Promise.all([
          fetch(`/api/schedules/${scheduleId}`),
          fetch(`/api/attendance?scheduleId=${scheduleId}`),
        ])
        const schedData = await schedRes.json()
        const attData = await attRes.json()
        setSchedule(schedData)

        const existing: Record<string, any> = {}
        attData.forEach((a: any) => { existing[a.studentId] = a })

        const students: Student[] = schedData.class?.enrollments?.map((e: any) => e.student) || []
        setEntries(
          students.map((s) => ({
            studentId: s.id,
            status: existing[s.id]?.status || 'PRESENT',
            notes: existing[s.id]?.notes || '',
          }))
        )
      } catch {
        setError('Gagal memuat data absensi.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [scheduleId])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId, entries }),
      })
      if (!res.ok) throw new Error('Gagal menyimpan absensi.')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-10 text-center"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" /></div>
  }

  const students: Student[] = schedule?.class?.enrollments?.map((e: any) => e.student) || []

  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => router.back()} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium mb-2 cursor-pointer">← Kembali</button>
        <h1 className="text-2xl font-extrabold text-slate-800">✏️ Form Absensi</h1>
        {schedule && (
          <p className="text-sm text-slate-500 mt-1">
            {schedule.class?.name} • {new Date(schedule.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • {schedule.startTime}–{schedule.endTime}
          </p>
        )}
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">⚠️ {error}</div>}
      {success && <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">✅ Absensi berhasil disimpan!</div>}

      {students.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
          <p className="text-3xl">👥</p>
          <p className="mt-2 text-sm">Belum ada siswa terdaftar di kelas ini.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {students.map((student, idx) => {
              const entry = entries[idx]
              return (
                <div key={student.id} className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-4">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{student.name}</p>
                    <p className="text-xs text-slate-400">{student.grade || 'Kelas tidak diketahui'}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={entry?.status || 'PRESENT'}
                      onChange={(e) => {
                        const updated = [...entries]
                        if (updated[idx]) updated[idx].status = e.target.value
                        setEntries(updated)
                      }}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={entry?.notes || ''}
                      onChange={(e) => {
                        const updated = [...entries]
                        if (updated[idx]) updated[idx].notes = e.target.value
                        setEntries(updated)
                      }}
                      placeholder="Catatan (opsional)"
                      className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-48"
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Menyimpan...' : 'Simpan Absensi'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
