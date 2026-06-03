'use client'

import { useState } from 'react'
import { X, ArrowUpCircle, BookOpen, CheckCircle2, PlusCircle, Settings2 } from 'lucide-react'
import {
  PROGRAMS,
  PROGRAM_LABELS,
  PROGRAM_GRADIENTS,
  PROGRAM_ICONS,
  type ProgramKey,
} from '@/lib/program-config'

interface ActiveEnrollment {
  id: string
  program: string
}

interface ProgramEnrollmentModalProps {
  isOpen: boolean
  onClose: () => void
  studentName: string
  studentId: string
  mode: 'assign' | 'add' | 'upgrade'
  currentProgramEnrollmentId?: string
  currentProgram?: string
  activeEnrollments?: ActiveEnrollment[]
  onSuccess: () => void
}

export function ProgramEnrollmentModal({
  isOpen,
  onClose,
  studentName,
  studentId,
  mode,
  currentProgramEnrollmentId,
  currentProgram,
  activeEnrollments = [],
  onSuccess,
}: ProgramEnrollmentModalProps) {
  const [selectedPrograms, setSelectedPrograms] = useState<ProgramKey[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availablePrograms = mode === 'upgrade'
    ? PROGRAMS.filter((p) => p !== currentProgram)
    : mode === 'add'
    ? PROGRAMS.filter((p) => !activeEnrollments.some((e) => e.program === p))
    : PROGRAMS

  const handleSubmit = async () => {
    if (selectedPrograms.length === 0) {
      setError('Pilih minimal satu program.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (mode === 'assign' || mode === 'add') {
        for (const program of selectedPrograms) {
          const res = await fetch('/api/program-enrollments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, program, notes: notes || undefined }),
          })
          if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || 'Terjadi kesalahan.')
          }
        }
      } else {
        const res = await fetch(`/api/program-enrollments/${currentProgramEnrollmentId}/upgrade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPrograms: selectedPrograms, notes: notes || undefined }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Terjadi kesalahan.')
        }
      }
      handleClose()
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (enrollmentId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/program-enrollments/${enrollmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DROPPED' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Terjadi kesalahan.')
      }
      handleClose()
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedPrograms([])
    setNotes('')
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  const isUpgrade = mode === 'upgrade'
  const headerTitle = mode === 'upgrade' ? 'Upgrade Program' : mode === 'add' ? 'Kelola Program' : 'Daftarkan Program'
  const headerGradient = isUpgrade ? 'from-amber-500 to-orange-600' : 'from-indigo-600 to-violet-700'
  const buttonLabel = loading
    ? 'Menyimpan...'
    : mode === 'upgrade'
    ? 'Upgrade Program'
    : mode === 'add'
    ? 'Tambah Program'
    : 'Daftarkan Program'
  const buttonColor = isUpgrade ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className={`p-5 bg-gradient-to-r ${headerGradient} text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                {mode === 'upgrade'
                  ? <ArrowUpCircle className="h-5 w-5" />
                  : mode === 'add'
                  ? <Settings2 className="h-5 w-5" />
                  : <BookOpen className="h-5 w-5" />
                }
              </div>
              <div>
                <h3 className="font-extrabold text-base leading-tight">{headerTitle}</h3>
                <p className="text-xs text-white/80 mt-0.5">Siswa: <strong>{studentName}</strong></p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {mode === 'upgrade' && currentProgram && (
            <div className="mt-3 flex items-center gap-2 text-xs bg-white/10 rounded-xl px-3 py-2">
              <span className="text-white/70">Program saat ini:</span>
              <span className="font-bold">{PROGRAM_LABELS[currentProgram as ProgramKey] ?? currentProgram}</span>
              <span className="text-white/70">→ pilih program baru di bawah</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-3 text-sm text-rose-700 dark:text-rose-400">
              {error}
            </div>
          )}

          {/* Active programs with remove button — only in 'add' mode */}
          {mode === 'add' && activeEnrollments.length > 0 && (
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Program Aktif
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeEnrollments.map((enr) => (
                  <div
                    key={enr.id}
                    className="flex items-center gap-1.5 pl-2 pr-1 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                  >
                    <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${PROGRAM_GRADIENTS[enr.program as ProgramKey]} flex items-center justify-center text-xs shrink-0`}>
                      {PROGRAM_ICONS[enr.program as ProgramKey]}
                    </div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {PROGRAM_LABELS[enr.program as ProgramKey] ?? enr.program}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemove(enr.id)}
                      disabled={loading}
                      className="p-0.5 rounded-md text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer disabled:opacity-50"
                      title={`Hapus program ${enr.program}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Program picker */}
          {availablePrograms.length === 0 ? (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 text-center text-sm text-slate-500 dark:text-slate-400">
              Semua program sudah terdaftar untuk siswa ini.
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {mode === 'add' ? 'Tambah Program' : 'Pilih Program'}
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {availablePrograms.map((program) => {
                  const isSelected = selectedPrograms.includes(program)
                  return (
                    <button
                      key={program}
                      type="button"
                      onClick={() => {
                        setSelectedPrograms(prev =>
                          prev.includes(program)
                            ? prev.filter(p => p !== program)
                            : [...prev, program]
                        )
                      }}
                      className={`relative flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${PROGRAM_GRADIENTS[program]} flex items-center justify-center text-base shrink-0 shadow-xs`}>
                        {PROGRAM_ICONS[program]}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>
                          {program}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate leading-tight mt-0.5">
                          {PROGRAM_LABELS[program].split(' ').slice(0, 3).join(' ')}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-indigo-500 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Catatan <span className="normal-case font-normal">(opsional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Misal: Mulai dari level dasar, tes penempatan sudah dilakukan..."
              rows={2}
              className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Tutup
          </button>
          {availablePrograms.length > 0 && (
            <button
              onClick={handleSubmit}
              disabled={loading || selectedPrograms.length === 0}
              className={`px-5 py-2 rounded-xl text-sm font-bold text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${buttonColor}`}
            >
              {buttonLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
