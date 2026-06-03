'use client'

import { useState, useEffect, useRef } from 'react'
import { Program, MilestoneStatus } from '@prisma/client'
import { Award, Search, X } from 'lucide-react'
import { useToastNotification } from '@/lib/hooks/use-toast-notification'

type Student = { id: string; name: string; grade: string | null }
type Milestone = { id: string; name: string; description: string | null; program: Program; order: number }
type StudentMilestoneRecord = {
  id: string
  studentId: string
  milestoneId: string
  status: MilestoneStatus
  completedAt: string | null
  notes: string | null
}
type MilestoneWithProgress = Milestone & { studentMilestones: StudentMilestoneRecord[] }

const PROGRAMS: Program[] = ['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH']
const PROGRAM_LABELS: Record<Program, string> = {
  SEMPOA: 'Sempoa', AHE: 'AHE', EFK: 'EFK', EYL: 'EYL', EFE: 'EFE', CALISTUNG: 'Calistung', ENGLISH: 'English',
}

export default function StudentProgressClient({
  students,
  milestones,
}: {
  students: Student[]
  milestones: Milestone[]
}) {
  const toast = useToastNotification()
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeProgram, setActiveProgram] = useState<Program>('SEMPOA')
  const [progressData, setProgressData] = useState<MilestoneWithProgress[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchProgress = async (studentId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/student-milestones?studentId=${studentId}`)
      if (!res.ok) throw new Error('Gagal memuat data')
      setProgressData(await res.json())
    } catch {
      toast.error('Gagal memuat progress siswa')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedStudentId) fetchProgress(selectedStudentId)
    else setProgressData([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId])

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedStudent = students.find((s) => s.id === selectedStudentId)

  const selectStudent = (s: Student) => {
    setSelectedStudentId(s.id)
    setSearchQuery('')
    setShowDropdown(false)
  }

  const clearStudent = () => {
    setSelectedStudentId('')
    setSearchQuery('')
    setShowDropdown(false)
  }

  const getStudentMilestone = (milestoneId: string): StudentMilestoneRecord | undefined =>
    progressData.find((m) => m.id === milestoneId)?.studentMilestones[0]

  const updateStatus = async (milestoneId: string, status: MilestoneStatus) => {
    if (!selectedStudentId) return
    setUpdating(milestoneId)
    try {
      const res = await fetch('/api/student-milestones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudentId, milestoneId, status }),
      })
      if (!res.ok) throw new Error('Gagal memperbarui status')
      await fetchProgress(selectedStudentId)
    } catch {
      toast.error('Gagal memperbarui status milestone')
    } finally {
      setUpdating(null)
    }
  }

  const programMilestones = milestones.filter((m) => m.program === activeProgram)
  const completedCount = programMilestones.filter(
    (m) => getStudentMilestone(m.id)?.status === 'COMPLETED'
  ).length
  const progressPercent = programMilestones.length > 0
    ? Math.round((completedCount / programMilestones.length) * 100)
    : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 p-5 sm:p-8 text-white shadow-xl shadow-emerald-600/10">
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">Progress Milestone Siswa</h1>
        <p className="mt-2 text-sm sm:text-base text-emerald-100">
          Pantau dan perbarui pencapaian kurikulum per siswa.
        </p>
      </div>

      {/* Student Selector */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs p-6">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Pilih Siswa</label>
        <div className="relative mt-2" ref={searchRef}>
          {selectedStudent && !showDropdown ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3">
              <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-white">
                {selectedStudent.name}{selectedStudent.grade ? ` (${selectedStudent.grade})` : ''}
              </span>
              <button
                onClick={clearStudent}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true) }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Cari nama siswa..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-4 py-3 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:font-normal placeholder:text-slate-400"
                />
              </div>
              {showDropdown && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
                  {filteredStudents.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400">Siswa tidak ditemukan</p>
                  ) : (
                    <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                      {filteredStudents.map((s) => (
                        <li key={s.id}>
                          <button
                            onMouseDown={(e) => { e.preventDefault(); selectStudent(s) }}
                            className="w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-800 dark:text-white hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
                          >
                            {s.name}
                            {s.grade && <span className="ml-1.5 text-xs font-normal text-slate-400">({s.grade})</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedStudentId && (
        <>
          {/* Program Tabs */}
          <div className="flex flex-wrap gap-2">
            {PROGRAMS.map((p) => {
              const pMilestones = milestones.filter((m) => m.program === p)
              const pCompleted = pMilestones.filter(
                (m) => getStudentMilestone(m.id)?.status === 'COMPLETED'
              ).length
              return (
                <button
                  key={p}
                  onClick={() => setActiveProgram(p)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                    activeProgram === p
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                  }`}
                >
                  {PROGRAM_LABELS[p]}
                  {pMilestones.length > 0 && (
                    <span className="ml-2 text-xs opacity-70">{pCompleted}/{pMilestones.length}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Progress Section */}
          {loading ? (
            <div className="text-center py-10 text-slate-400 text-sm">Memuat data...</div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden">
              {/* Progress Header */}
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-slate-800 dark:text-white">
                    {PROGRAM_LABELS[activeProgram]} — Progress
                  </h2>
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-emerald-500" />
                    <span className="font-bold text-emerald-600 text-sm">{progressPercent}%</span>
                    <span className="text-xs text-slate-400">({completedCount}/{programMilestones.length})</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {programMilestones.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">
                  Belum ada milestone untuk program ini.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {programMilestones.map((m, idx) => {
                    const sm = getStudentMilestone(m.id)
                    const status: MilestoneStatus = sm?.status ?? 'NOT_STARTED'
                    const isUpdating = updating === m.id

                    return (
                      <div key={m.id} className="flex items-start gap-4 px-6 py-4">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-800 dark:text-white">{m.name}</p>
                          {m.description && <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>}
                          {sm?.completedAt && (
                            <p className="text-xs text-emerald-500 mt-0.5">
                              Selesai: {new Date(sm.completedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0">
                          <select
                            value={status}
                            onChange={(e) => updateStatus(m.id, e.target.value as MilestoneStatus)}
                            disabled={isUpdating}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors
                              ${status === 'COMPLETED' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                              : status === 'IN_PROGRESS' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                          >
                            <option value="NOT_STARTED">Belum Mulai</option>
                            <option value="IN_PROGRESS">Sedang Berjalan</option>
                            <option value="COMPLETED">Selesai</option>
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
