'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, User, CheckCircle2, AlertCircle, FileText, Send, X } from 'lucide-react'

interface Student {
  id: string
  name: string
}

interface Schedule {
  id: string
  date: string
  startTime: string
  endTime: string
  topic: string | null
  location: string | null
  class: {
    name: string
    tutor: { name: string }
    enrollments: Array<{ student: Student }>
  }
  attendances: Array<{
    studentId: string
    status: 'PRESENT' | 'ABSENT' | 'SICK' | 'PERMISSION'
    notes: string | null
  }>
  reports: Report[]
}

interface Media {
  id: string
  url: string
  type: 'PHOTO' | 'VIDEO'
  filename: string
}

interface Report {
  id: string
  studentId: string
  content: string
  score: number | null
  createdAt: string
  tutor: { name: string }
  student: { id: string; name: string }
  media: Media[]
}

interface ParentScheduleListProps {
  schedules: Schedule[]
}

export default function ParentScheduleList({ schedules }: ParentScheduleListProps) {
  const router = useRouter()
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [excuseType, setExcuseType] = useState<'SICK' | 'PERMISSION'>('SICK')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedReport, setExpandedReport] = useState<string | null>(null)

  const handleOpenModal = (sched: Schedule, stud: Student) => {
    setSelectedSchedule(sched)
    setSelectedStudent(stud)
    setExcuseType('SICK')
    setNotes('')
    setError(null)
  }

  const handleCloseModal = () => {
    setSelectedSchedule(null)
    setSelectedStudent(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSchedule || !selectedStudent) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/schedules/${selectedSchedule.id}/excuse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          status: excuseType,
          notes,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal mengajukan izin.')
      }

      router.refresh()
      handleCloseModal()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const getAttendanceStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return { label: 'Hadir', classes: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border-emerald-100 dark:border-emerald-500/20' }
      case 'ABSENT':
        return { label: 'Alpha', classes: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-100 dark:border-rose-500/20' }
      case 'SICK':
        return { label: 'Sakit', classes: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-450 border-amber-100 dark:border-amber-500/20' }
      case 'PERMISSION':
        return { label: 'Izin', classes: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-450 border-blue-100 dark:border-blue-500/20' }
      default:
        return { label: 'Menunggu Kelas', classes: 'bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-850' }
    }
  }

  return (
    <div className="space-y-4">
      {schedules.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 p-8 text-center text-slate-400 dark:text-slate-500 transition-colors duration-300">
          <p className="text-3xl">🗓️</p>
          <p className="mt-2 text-sm font-medium">Belum ada jadwal belajar mendatang.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {schedules.map((s) => {
            const dateObj = new Date(s.date)
            const dateStr = dateObj.toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })

            return (
              <div
                key={s.id}
                className="group rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 shadow-xs p-5 hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
              >
                {/* Visual glow on card hover */}
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {s.class.name}
                      </h3>
                      <p className="text-[11px] text-slate-450 dark:text-slate-400 font-medium mt-0.5">
                        Tutor: {s.class.tutor.name}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                      <span>{dateStr}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                      <span>{s.startTime} – {s.endTime} WIB</span>
                    </div>
                    {s.topic && (
                      <div className="flex items-center gap-2 font-medium text-blue-600 dark:text-blue-400">
                        <FileText className="h-3.5 w-3.5" />
                        <span>Materi: {s.topic}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Enrolled Children Mapping */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status Kehadiran Anak:</p>
                  {s.class.enrollments.map(({ student }) => {
                    const att = s.attendances.find((a) => a.studentId === student.id)
                    const statusInfo = getAttendanceStatusBadge(att?.status || '')

                    return (
                      <div key={student.id} className="flex items-center justify-between gap-3 text-xs bg-slate-50/50 dark:bg-slate-800/20 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-600 dark:text-slate-400 uppercase">
                            {student.name.substring(0, 2)}
                          </div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{student.name}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusInfo.classes}`}>
                            {statusInfo.label}
                          </span>

                          {/* excuse button if not yet marked as PRESENT/ABSENT */}
                          {(!att || (att.status !== 'PRESENT' && att.status !== 'ABSENT')) && (
                            <button
                              onClick={() => handleOpenModal(s, student)}
                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline cursor-pointer"
                            >
                              {att ? 'Ubah Izin' : 'Ajukan Izin'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Learning Reports Section */}
                {s.reports && s.reports.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => setExpandedReport(expandedReport === s.id ? null : s.id)}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline cursor-pointer"
                    >
                      {expandedReport === s.id ? '▲ Sembunyikan Laporan' : '▼ Lihat Laporan Belajar'}
                    </button>
                    {expandedReport === s.id && (
                      <div className="mt-3 space-y-2">
                        {s.reports.map((report) => (
                          <div key={report.id} className="rounded-xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 p-3 text-xs space-y-1">
                            <p className="font-bold text-slate-700 dark:text-slate-300">{report.student.name}</p>
                            <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">{report.content}</p>
                            {report.score !== null && (
                              <p className="font-semibold text-indigo-600 dark:text-indigo-400">Nilai: {report.score}/100</p>
                            )}
                            {report.media && report.media.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {report.media.map((m) => (
                                  <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="block shrink-0">
                                    {m.type === 'PHOTO' ? (
                                      <img
                                        src={m.url}
                                        alt={m.filename}
                                        className="h-16 w-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                                      />
                                    ) : (
                                      <div className="h-16 w-16 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 flex flex-col items-center justify-center gap-0.5">
                                        <span className="text-xl">🎥</span>
                                        <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">VIDEO</span>
                                      </div>
                                    )}
                                  </a>
                                ))}
                              </div>
                            )}
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                              Tutor: {report.tutor.name} · {new Date(report.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Glassmorphic Excuse Submission Modal */}
      {selectedSchedule && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Blur Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-300"
            onClick={handleCloseModal}
          />

          {/* Modal Content Card */}
          <div className="relative w-full max-w-md bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800/60 rounded-3xl p-6 shadow-2xl overflow-hidden transition-all duration-300 animate-slide-up-fade">
            {/* Shimmer loading backdrop */}
            <div className="absolute top-0 left-0 w-full h-[5px] bg-gradient-to-r from-blue-500 to-indigo-500" />
            
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800/60 mb-5">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white">📝 Form Pengajuan Izin</h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Untuk: {selectedStudent.name}</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Tipe Izin</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExcuseType('SICK')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                      excuseType === 'SICK'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/15'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-amber-300'
                    }`}
                  >
                    <span>🤒</span>
                    <span>Anak Sakit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExcuseType('PERMISSION')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                      excuseType === 'PERMISSION'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/15'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-blue-300'
                    }`}
                  >
                    <span>✈️</span>
                    <span>Acara Keluarga / Izin</span>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Panas demam sejak tadi pagi, atau Ada acara pernikahan kakak sepupu..."
                  rows={3}
                  className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-55/35 dark:bg-slate-850 px-3.5 py-2.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 mt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-2 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-xs py-3 rounded-xl cursor-pointer shadow-md transition-all active:scale-98"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submitting ? 'Mengirim...' : 'Kirim Permohonan'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
