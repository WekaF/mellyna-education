'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Save, Upload, Trash2 } from 'lucide-react'
import { useConfirm } from '@/lib/hooks/use-confirm'

interface Student {
  id: string
  name: string
  grade: string | null
}

interface MediaItem {
  id: string
  url: string
  type: 'PHOTO' | 'VIDEO'
  filename: string
}

interface ReportEntry {
  studentId: string
  content: string
  score: string
  reportId: string | null
  uploading: boolean
  media: MediaItem[]
}

export default function TutorReportsPage() {
  const params = useParams()
  const router = useRouter()
  const confirm = useConfirm()
  const scheduleId = params.scheduleId as string

  const [schedule, setSchedule] = useState<any>(null)
  const [entries, setEntries] = useState<ReportEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successIds, setSuccessIds] = useState<Set<string>>(new Set())
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [schedRes, reportsRes] = await Promise.all([
          fetch(`/api/schedules/${scheduleId}`),
          fetch(`/api/reports?scheduleId=${scheduleId}`),
        ])
        const schedData = await schedRes.json()
        const reportsData = await reportsRes.json()
        setSchedule(schedData)

        const existingReports: Record<string, any> = {}
        reportsData.forEach((r: any) => { existingReports[r.studentId] = r })

        const students: Student[] = (schedData.participants ?? []).map((p: any) => p.student)

        setEntries(students.map((s) => ({
          studentId: s.id,
          content: existingReports[s.id]?.content || '',
          score: existingReports[s.id]?.score?.toString() || '',
          reportId: existingReports[s.id]?.id || null,
          uploading: false,
          media: existingReports[s.id]?.media || [],
        })))
      } catch {
        setError('Gagal memuat data laporan.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [scheduleId])

  const handleSave = async (studentId: string) => {
    setSaving(studentId)
    setError(null)
    const entry = entries.find((e) => e.studentId === studentId)
    if (!entry) return
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          scheduleId,
          content: entry.content,
          score: entry.score ? parseInt(entry.score) : undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEntries((prev) =>
        prev.map((e) => e.studentId === studentId ? { ...e, reportId: data.id } : e)
      )
      setSuccessIds((prev) => new Set(prev).add(studentId))
      setTimeout(() => setSuccessIds((prev) => {
        const s = new Set(prev); s.delete(studentId); return s
      }), 3000)
    } catch {
      setError('Gagal menyimpan laporan untuk siswa ini.')
    } finally {
      setSaving(null)
    }
  }

  const handleUpload = async (studentId: string, file: File) => {
    const entry = entries.find((e) => e.studentId === studentId)
    if (!entry?.reportId) {
      setError('Simpan laporan terlebih dahulu sebelum upload media.')
      return
    }
    setEntries((prev) => prev.map((e) => e.studentId === studentId ? { ...e, uploading: true } : e))
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('reportId', entry.reportId)
      const res = await fetch('/api/media/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const newMedia: MediaItem = await res.json()
      setEntries((prev) =>
        prev.map((e) =>
          e.studentId === studentId
            ? { ...e, media: [...e.media, newMedia] }
            : e
        )
      )
    } catch {
      setError('Gagal upload media.')
    } finally {
      setEntries((prev) => prev.map((e) => e.studentId === studentId ? { ...e, uploading: false } : e))
    }
  }

  const handleDeleteMedia = useCallback(async (studentId: string, mediaId: string) => {
    const ok = await confirm({
      title: 'Hapus Media',
      message: 'Hapus media ini secara permanen?',
      variant: 'danger',
      confirmLabel: 'Hapus Media',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/media/${mediaId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setEntries((prev) =>
        prev.map((e) =>
          e.studentId === studentId
            ? { ...e, media: e.media.filter((m) => m.id !== mediaId) }
            : e
        )
      )
    } catch {
      setError('Gagal menghapus media.')
    }
  }, [confirm])

  if (loading) {
    return (
      <div className="p-10 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
      </div>
    )
  }

  const students: Student[] = (schedule?.participants ?? []).map((p: any) => p.student)

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium mb-2 cursor-pointer"
        >
          ← Kembali
        </button>
        <h1 className="text-2xl font-extrabold text-slate-800">📝 Laporan Belajar</h1>
        {schedule && (
          <p className="text-sm text-slate-500 mt-1">
            {schedule.class?.name} •{' '}
            {new Date(schedule.date).toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">
          ⚠️ {error}
        </div>
      )}

      {students.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
          <p className="text-3xl">👥</p>
          <p className="mt-2 text-sm">Belum ada peserta terdaftar di sesi ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {students.map((student) => {
            const entry = entries.find((e) => e.studentId === student.id)
            const isSaved = successIds.has(student.id)
            return (
              <div
                key={student.id}
                className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">{student.name}</h3>
                    <p className="text-xs text-slate-400">{student.grade || '-'}</p>
                  </div>
                  {isSaved && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-1 rounded-lg">
                      ✅ Disimpan
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Catatan Belajar *
                    </label>
                    <textarea
                      rows={3}
                      value={entry?.content || ''}
                      onChange={(e) =>
                        setEntries((prev) =>
                          prev.map((en) =>
                            en.studentId === student.id ? { ...en, content: e.target.value } : en
                          )
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                      placeholder="Catatan perkembangan belajar siswa sesi ini..."
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="w-full sm:w-36">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Nilai (0-100)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={entry?.score || ''}
                        onChange={(e) =>
                          setEntries((prev) =>
                            prev.map((en) =>
                              en.studentId === student.id ? { ...en, score: e.target.value } : en
                            )
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                        placeholder="mis. 85"
                      />
                    </div>
                    <div className="flex-1 flex items-end gap-3 flex-wrap">
                      <button
                        onClick={() => handleSave(student.id)}
                        disabled={saving === student.id}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {saving === student.id ? 'Menyimpan...' : 'Simpan Laporan'}
                      </button>
                      <button
                        onClick={() => fileRefs.current[student.id]?.click()}
                        disabled={!entry?.reportId || entry?.uploading}
                        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
                        title={!entry?.reportId ? 'Simpan laporan terlebih dahulu' : 'Upload foto/video'}
                      >
                        <Upload className="h-4 w-4" />
                        {entry?.uploading ? 'Mengupload...' : 'Upload Media'}
                      </button>
                      <input
                        ref={(el) => { fileRefs.current[student.id] = el }}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleUpload(student.id, file)
                          e.target.value = ''
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 w-full">
                      Upload min. 2 video laporan (1 per program). Video akan dikompres otomatis.
                    </p>
                  </div>

                  {entry?.media && entry.media.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs font-semibold text-slate-500">
                          Media Terupload ({entry.media.length}):
                        </p>
                        {(() => {
                          const videoCount = entry.media.filter((m) => m.type === 'VIDEO').length
                          return videoCount < 2 ? (
                            <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-lg">
                              📹 {videoCount}/2 video
                            </span>
                          ) : (
                            <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-lg">
                              📹 {videoCount} video ✓
                            </span>
                          )
                        })()}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {entry.media.map((m) => (
                          <div key={m.id} className="relative group">
                            {m.type === 'PHOTO' ? (
                              <a href={m.url} target="_blank" rel="noopener noreferrer">
                                <div className="h-20 w-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                                  <img
                                    src={m.url}
                                    alt={m.filename}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              </a>
                            ) : (
                              <div className="space-y-1">
                                <video
                                  src={m.url}
                                  controls
                                  preload="metadata"
                                  className="h-20 w-36 rounded-xl border border-slate-200 bg-slate-100 object-cover"
                                  title={m.filename}
                                />
                                <a
                                  href={m.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[10px] text-indigo-600 hover:underline font-medium"
                                >
                                  🔗 Lihat Video
                                </a>
                              </div>
                            )}
                            <button
                              onClick={() => handleDeleteMedia(student.id, m.id)}
                              className="absolute -top-2 -right-2 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm cursor-pointer"
                              title="Hapus media"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
