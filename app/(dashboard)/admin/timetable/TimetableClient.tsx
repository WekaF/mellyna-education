'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Edit, Users, Trash2, CalendarPlus, X, Check, Search, Sparkles, Send, Clock, User, Info } from 'lucide-react'
import { DayOfWeek } from '@prisma/client'

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'MONDAY',    label: 'Senin' },
  { key: 'TUESDAY',   label: 'Selasa' },
  { key: 'WEDNESDAY', label: 'Rabu' },
  { key: 'THURSDAY',  label: 'Kamis' },
  { key: 'FRIDAY',    label: "Jum'at" },
  { key: 'SATURDAY',  label: 'Sabtu' },
  { key: 'SUNDAY',    label: 'Minggu' },
]

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '19:00',
]

const PROGRAMS = ['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH'] as const
type ProgramValue = typeof PROGRAMS[number]

const PROGRAM_COLORS: Record<string, string> = {
  SEMPOA:    'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
  AHE:       'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  EFK:       'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
  EYL:       'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300 border border-pink-200 dark:border-pink-800',
  EFE:       'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
  CALISTUNG: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800',
  ENGLISH:   'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
}

interface ClassModel {
  id: string
  name: string
  programs: { program: ProgramValue }[]
  description: string | null
  dayOfWeek: DayOfWeek | null
  timeSlot: string | null
  tutorId: string
  tutor: { id: string; name: string }
  enrollments: { id: string; studentId: string; student: { id: string; name: string; grade: string | null } }[]
}

interface Tutor {
  id: string
  name: string
  suspended: boolean
}

interface Student {
  id: string
  name: string
  grade: string | null
  isActive: boolean
}

interface Props {
  initialClasses: ClassModel[]
  initialTutors: Tutor[]
  initialStudents: Student[]
  initialPiketList: { day: string; staff: string }[]
}

export default function TimetableClient({ initialClasses, initialTutors, initialStudents, initialPiketList }: Props) {
  const [classes, setClasses] = useState<ClassModel[]>(initialClasses)
  const [tutors, setTutors] = useState<Tutor[]>(initialTutors)
  const [students, setStudents] = useState<Student[]>(initialStudents)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Piket state
  const [piketList, setPiketList] = useState<{ day: string; staff: string }[]>(initialPiketList)
  const [showPiketModal, setShowPiketModal] = useState(false)
  const [piketForm, setPiketForm] = useState<Record<string, string[]>>({})
  const [savingPiket, setSavingPiket] = useState(false)

  // Modals state
  const [showClassModal, setShowClassModal] = useState(false)
  const [selectedClass, setSelectedClass] = useState<ClassModel | null>(null)
  const [classForm, setClassForm] = useState({
    name: '',
    programs: ['SEMPOA'] as ProgramValue[],
    tutorId: '',
    description: '',
    dayOfWeek: '' as DayOfWeek | '',
    timeSlot: '',
  })
  const [mode, setMode] = useState<'select' | 'new'>('select')
  const [selectedExistingClassId, setSelectedExistingClassId] = useState('')
  const [savingClass, setSavingClass] = useState(false)

  // Enrollments Modal state
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [enrollClass, setEnrollClass] = useState<ClassModel | null>(null)
  const [studentSearch, setStudentSearch] = useState('')

  // Generate Weekly Schedule Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateForm, setGenerateForm] = useState({
    startDate: '',
  })
  const [generating, setGenerating] = useState(false)

  // Set default next Monday for generation on mount
  useEffect(() => {
    const today = new Date()
    const currentDay = today.getDay()
    const daysUntilNextMonday = (1 - currentDay + 7) % 7 || 7
    const nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() + daysUntilNextMonday)
    setGenerateForm({ startDate: nextMonday.toISOString().split('T')[0] })
  }, [])

  // Re-fetch all data (used after mutations)
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [classesRes, tutorsRes, studentsRes] = await Promise.all([
        fetch('/api/classes'),
        fetch('/api/tutors'),
        fetch('/api/students'),
      ])

      if (!classesRes.ok || !tutorsRes.ok || !studentsRes.ok) {
        throw new Error('Gagal mengambil data dari server.')
      }

      const [classesData, tutorsData, studentsData] = await Promise.all([
        classesRes.json(),
        tutorsRes.json(),
        studentsRes.json(),
      ])

      setClasses(classesData)
      setTutors(tutorsData.filter((t: Tutor) => !t.suspended))
      setStudents(studentsData.filter((s: Student) => s.isActive))

      // Piket is non-critical — fetch separately so a failure doesn't block the timetable
      try {
        const piketRes = await fetch('/api/admin/piket')
        if (piketRes.ok) setPiketList(await piketRes.json())
      } catch {}
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem.')
    } finally {
      setLoading(false)
    }
  }, [])

  const getPiketStaff = useCallback((dayLabel: string) => {
    const match = piketList.find(p => p.day === dayLabel)
    return match ? match.staff : '—'
  }, [piketList])

  const handleSavePiket = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPiket(true)
    setError(null)
    try {
      await Promise.all(
        Object.entries(piketForm).map(([day, selectedTutors]) => {
          const staff = selectedTutors.length > 0 ? selectedTutors.join(', ') : '—'
          return fetch('/api/admin/piket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ day, staff }),
          })
        })
      )
      await fetchData()
      setSuccessMsg('Jadwal piket harian berhasil diperbarui!')
      setShowPiketModal(false)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch {
      setError('Gagal menyimpan jadwal piket.')
    } finally {
      setSavingPiket(false)
    }
  }

  const handleOpenPiketModal = () => {
    const formInit: Record<string, string[]> = {}
    for (const d of DAYS) {
      const match = piketList.find(p => p.day === d.label)
      const staffStr = match ? match.staff : ''
      formInit[d.label] = staffStr && staffStr !== '—'
        ? staffStr.split(',').map(s => s.trim()).filter(Boolean)
        : []
    }
    setPiketForm(formInit)
    setShowPiketModal(true)
  }

  const handleToggleTutorPiket = (day: string, tutorName: string) => {
    const current = piketForm[day] ?? []
    const updated = current.includes(tutorName)
      ? current.filter(name => name !== tutorName)
      : [...current, tutorName]
    setPiketForm({ ...piketForm, [day]: updated })
  }

  // Group classes by day and time slot
  const grid = useMemo(() => {
    const data: Record<string, Record<string, ClassModel[]>> = {}
    for (const cls of classes) {
      if (!cls.dayOfWeek || !cls.timeSlot) continue
      const day = cls.dayOfWeek
      const slot = cls.timeSlot
      if (!data[day]) data[day] = {}
      if (!data[day][slot]) data[day][slot] = []
      data[day][slot].push(cls)
    }
    return data
  }, [classes])

  // Total students enrolled per day
  const dayTotals = useMemo(() => {
    return DAYS.map(d => {
      const dayClasses = Object.values(grid[d.key] ?? {}).flat()
      const uniqueStudents = new Set(dayClasses.flatMap(c => c.enrollments.map(e => e.student.id)))
      return {
        key: d.key,
        label: d.label,
        count: uniqueStudents.size,
      }
    })
  }, [grid])

  // Class Form Handlers
  const handleOpenAddModal = (day: DayOfWeek, slot: string) => {
    setSelectedClass(null)
    setMode('select')
    setSelectedExistingClassId('')
    setClassForm({
      name: '',
      programs: ['SEMPOA'] as ProgramValue[],
      tutorId: tutors[0]?.id || '',
      description: '',
      dayOfWeek: day,
      timeSlot: slot,
    })
    setShowClassModal(true)
  }

  const handleOpenEditModal = (cls: ClassModel) => {
    setSelectedClass(cls)
    setMode('new')
    setClassForm({
      name: cls.name,
      programs: cls.programs.map(p => p.program),
      tutorId: cls.tutorId,
      description: cls.description || '',
      dayOfWeek: cls.dayOfWeek || '',
      timeSlot: cls.timeSlot || '',
    })
    setShowClassModal(true)
  }

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingClass(true)
    setError(null)
    try {
      let res
      if (selectedClass) {
        // Editing an already scheduled class
        res = await fetch(`/api/classes/${selectedClass.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(classForm),
        })
      } else if (mode === 'select' && selectedExistingClassId) {
        // Scheduling an existing class
        res = await fetch(`/api/classes/${selectedExistingClassId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dayOfWeek: classForm.dayOfWeek,
            timeSlot: classForm.timeSlot,
          }),
        })
      } else {
        // Creating a new class
        res = await fetch('/api/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(classForm),
        })
      }

      if (!res.ok) {
        throw new Error('Gagal menyimpan sesi kelas.')
      }

      await fetchData()
      setSuccessMsg(`Sesi kelas berhasil disimpan ke Timetable!`)
      setShowClassModal(false)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingClass(false)
    }
  }

  const handleUnscheduleClass = async () => {
    if (!selectedClass) return
    setSavingClass(true)
    setError(null)
    try {
      const res = await fetch(`/api/classes/${selectedClass.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek: null,
          timeSlot: null,
        }),
      })

      if (!res.ok) {
        throw new Error('Gagal menghapus sesi dari grid.')
      }

      await fetchData()
      setSuccessMsg(`Sesi "${selectedClass.name}" berhasil dilepas dari Timetable.`)
      setShowClassModal(false)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingClass(false)
    }
  }

  const handleDeleteClass = async () => {
    if (!selectedClass) return
    if (!confirm(`Apakah Anda yakin ingin menghapus kelas "${selectedClass.name}" secara permanen? Seluruh pendaftaran siswa akan dihapus.`)) return
    setSavingClass(true)
    setError(null)
    try {
      const res = await fetch(`/api/classes/${selectedClass.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Gagal menghapus kelas.')
      }

      await fetchData()
      setSuccessMsg(`Kelas "${selectedClass.name}" berhasil dihapus secara permanen.`)
      setShowClassModal(false)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingClass(false)
    }
  }

  // Enrollment management
  const handleToggleEnrollment = async (student: Student) => {
    if (!enrollClass) return
    const isEnrolled = enrollClass.enrollments.find(e => e.studentId === student.id)

    try {
      if (isEnrolled) {
        // Unenroll
        const res = await fetch(`/api/enrollments/${isEnrolled.id}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error()
      } else {
        // Enroll
        const res = await fetch('/api/enrollments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: student.id,
            classId: enrollClass.id,
          }),
        })
        if (!res.ok) throw new Error()
      }

      // Re-fetch classes to update enrollment state locally
      const classesRes = await fetch('/api/classes')
      const updatedClasses = await classesRes.json()
      setClasses(updatedClasses)

      // Keep focus on same updated class
      const updatedClass = updatedClasses.find((c: ClassModel) => c.id === enrollClass.id)
      setEnrollClass(updatedClass || null)
    } catch {
      setError('Gagal memperbarui pendaftaran siswa.')
    }
  }

  // Weekly generator handler
  const handleGenerateWeeklySchedules = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/timetable/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generateForm),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal membuat jadwal mingguan.')
      }

      setShowGenerateModal(false)
      setSuccessMsg(data.message || 'Jadwal berhasil diterbitkan dan WhatsApp broadcast disiarkan!')
      setTimeout(() => setSuccessMsg(null), 6000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const filteredStudents = useMemo(() => {
    return students.filter(s =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase())
    )
  }, [students, studentSearch])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent"></div>
        <p className="text-sm font-medium text-slate-500 animate-pulse">Memuat Timetable Akademik...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            📅 Timetable &amp; Jadwal Mingguan
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Kelola sesi kelas tetap mingguan dan rilis jadwal belajar langsung ke WhatsApp.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setSelectedClass(null)
              setMode('select')
              setSelectedExistingClassId('')
              setClassForm({
                name: '',
                programs: ['SEMPOA'] as ProgramValue[],
                tutorId: tutors[0]?.id || '',
                description: '',
                dayOfWeek: 'MONDAY',
                timeSlot: '08:00',
              })
              setShowClassModal(true)
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Plus className="h-4 w-4" /> Tambah Sesi
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <CalendarPlus className="h-4 w-4" /> Rilis &amp; Broadcast Jadwal
          </button>
          <button
            onClick={handleOpenPiketModal}
            className="flex items-center gap-2 bg-indigo-55 bg-opacity-10 hover:bg-opacity-20 text-indigo-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 border border-indigo-200 dark:border-slate-700"
          >
            <Users className="h-4 w-4" /> Kelola Staff Piket
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          ⚠️ {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs animate-fadeIn">
          🎉 {successMsg}
        </div>
      )}

      {/* Piket / Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-[11px] bg-slate-50 dark:bg-slate-900/40 border dark:border-slate-800 p-3 rounded-2xl">
        {DAYS.map(d => (
          <div key={d.key} className="p-2.5 bg-white dark:bg-slate-800/40 border dark:border-slate-800/60 rounded-xl shadow-2xs">
            <div className="font-bold text-slate-700 dark:text-slate-200">{d.label}</div>
            <div className="text-slate-400 dark:text-slate-500 mt-0.5 truncate" title={getPiketStaff(d.label)}>
              Piket: {getPiketStaff(d.label)}
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Timetable Grid */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/30">
        <table className="w-full border-collapse text-xs min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
              <th className="p-3 text-center w-20 font-bold text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                Jam
              </th>
              {DAYS.map(d => (
                <th key={d.key} className="p-3 text-center font-bold text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 last:border-r-0">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot) => (
              <tr key={slot} className="border-b border-slate-200 dark:border-slate-800 last:border-b-0 hover:bg-slate-50/20 dark:hover:bg-slate-800/10">
                <td className="p-3 text-center font-bold text-slate-500 dark:text-slate-400 bg-slate-50/30 dark:bg-slate-800/20 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-center items-center h-full min-h-[90px]">
                  <Clock className="h-3.5 w-3.5 mb-1 opacity-70" />
                  {slot}
                </td>
                {DAYS.map(day => {
                  const cellClasses = grid[day.key]?.[slot] ?? []
                  return (
                    <td key={day.key} className="p-2 align-top border-r border-slate-200 dark:border-slate-800 last:border-r-0 min-w-[130px] group relative">
                      {cellClasses.map(cls => (
                        <div
                          key={cls.id}
                          className="group/card relative bg-white dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800 transition-all mb-2 last:mb-0 duration-200"
                        >
                          <div className="flex justify-between items-start gap-1">
                            <div className="flex flex-wrap gap-0.5">
                              {cls.programs.map(({ program }) => (
                                <span key={program} className={`inline-block px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wide uppercase ${PROGRAM_COLORS[program] ?? 'bg-slate-100 text-slate-800'}`}>
                                  {program}
                                </span>
                              ))}
                            </div>
                            <div className="flex opacity-0 group-hover/card:opacity-100 transition-opacity gap-1">
                              <button
                                onClick={() => handleOpenEditModal(cls)}
                                title="Ubah Kelas"
                                className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors cursor-pointer"
                              >
                                <Edit className="h-2.5 w-2.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setEnrollClass(cls)
                                  setStudentSearch('')
                                  setShowEnrollModal(true)
                                }}
                                title="Kelola Siswa"
                                className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors cursor-pointer"
                              >
                                <Users className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          </div>
                          <h4 className="font-bold text-slate-800 dark:text-slate-200 mt-1.5 text-[11px] leading-tight">
                            {cls.name}
                          </h4>
                          <div className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5 flex items-center gap-1">
                            <User className="h-2.5 w-2.5 opacity-60" /> {cls.tutor.name}
                          </div>
                          <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 dark:text-slate-500 font-medium">👥 Siswa</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30">
                              {cls.enrollments.length}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Hover action to add directly */}
                      <button
                        onClick={() => handleOpenAddModal(day.key, slot)}
                        className="opacity-0 group-hover:opacity-100 w-full mt-1.5 py-2.5 border border-dashed border-slate-300 hover:border-indigo-400 dark:border-slate-700 dark:hover:border-indigo-800 rounded-xl text-[10px] text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 flex items-center justify-center gap-1 bg-slate-50/50 hover:bg-indigo-50/20 dark:bg-slate-800/10 dark:hover:bg-indigo-950/10 transition-all duration-200 cursor-pointer font-semibold shadow-3xs"
                      >
                        <Plus className="h-3 w-3" /> Tambah Sesi
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 font-bold">
              <td className="p-3 text-center text-slate-500 dark:text-slate-400">Total Siswa</td>
              {dayTotals.map(d => (
                <td key={d.key} className="p-3 text-center text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 last:border-r-0">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {d.count}
                  </span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/30 px-3 py-1.5 rounded-xl border dark:border-slate-800">
          💼 Total Sesi: <strong className="text-slate-700 dark:text-slate-200">{classes.filter(c => c.dayOfWeek !== null).length}</strong>
        </span>
        <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/30 px-3 py-1.5 rounded-xl border dark:border-slate-800">
          🎓 Total Siswa Unik: <strong className="text-slate-700 dark:text-slate-200">{new Set(classes.flatMap(c => c.enrollments.map(e => e.student.name))).size}</strong>
        </span>
      </div>

      {/* MODAL 1: ADD/EDIT WEEKLY CLASS SESSION */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-indigo-50/40 dark:bg-slate-800/40">
              <h3 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-indigo-600" />
                {selectedClass ? 'Ubah Sesi Timetable' : 'Tambah Sesi Timetable'}
              </h3>
              <button
                onClick={() => setShowClassModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveClass} className="p-6 space-y-4">
              {!selectedClass && (
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/50 mb-2">
                  <button
                    type="button"
                    onClick={() => setMode('select')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all duration-200 ${
                      mode === 'select'
                        ? 'bg-white dark:bg-slate-700 text-indigo-650 dark:text-white shadow-xs font-black'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                    }`}
                  >
                    🔗 Hubungkan Kelas yang Ada
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('new')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all duration-200 ${
                      mode === 'new'
                        ? 'bg-white dark:bg-slate-700 text-indigo-655 dark:text-white shadow-xs font-black'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                    }`}
                  >
                    🆕 Buat & Jadwalkan Baru
                  </button>
                </div>
              )}

              {/* Mode Select Existing Class */}
              {!selectedClass && mode === 'select' ? (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Pilih Kelas Bimbingan *</label>
                    <select
                      required
                      value={selectedExistingClassId}
                      onChange={(e) => {
                        const cid = e.target.value
                        setSelectedExistingClassId(cid)
                        const match = classes.find(c => c.id === cid)
                        if (match) {
                          setClassForm({
                            name: match.name,
                            programs: match.programs.map(p => p.program),
                            tutorId: match.tutorId,
                            description: match.description || '',
                            dayOfWeek: classForm.dayOfWeek,
                            timeSlot: classForm.timeSlot,
                          })
                        }
                      }}
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500 bg-white"
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.programs.map(p => p.program).join(' + ')}) • {c.tutor.name} {c.dayOfWeek ? `(Aktif: ${DAYS.find(d => d.key === c.dayOfWeek)?.label || c.dayOfWeek} ${c.timeSlot})` : '(Belum Terjadwal)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedExistingClassId && (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/30 p-3.5 border dark:border-slate-800 space-y-1 text-xs">
                      <div className="text-slate-450 dark:text-slate-450 font-semibold uppercase tracking-wider text-[9px]">Detail Kelas Terpilih:</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Program: <span className="text-indigo-650 dark:text-indigo-400">{classForm.programs.join(' + ')}</span></div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Tutor Pengajar: <span className="text-slate-600 dark:text-slate-350">{tutors.find(t => t.id === classForm.tutorId)?.name || 'Tutor Terpilih'}</span></div>
                      {classForm.description && <div className="text-slate-500 dark:text-slate-400 mt-1 italic">"{classForm.description}"</div>}
                    </div>
                  )}
                </div>
              ) : (
                /* Mode Create New Class / Edit Mode */
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Nama Sesi Kelas *</label>
                    <input
                      required
                      type="text"
                      value={classForm.name}
                      onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                      placeholder="mis. Sempoa Tingkat Dasar A-1"
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Program * <span className="font-normal text-slate-400">(pilih semua yang relevan)</span></label>
                    <div className="flex flex-wrap gap-1.5">
                      {PROGRAMS.map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            const current = classForm.programs
                            const updated = current.includes(p) ? current.filter(x => x !== p) : [...current, p]
                            setClassForm({ ...classForm, programs: updated })
                          }}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
                            classForm.programs.includes(p)
                              ? `${PROGRAM_COLORS[p]} shadow-sm`
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Tutor Pengajar *</label>
                    <select
                      required
                      value={classForm.tutorId}
                      onChange={(e) => setClassForm({ ...classForm, tutorId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500 bg-white"
                    >
                      {tutors.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Deskripsi Sesi</label>
                    <textarea
                      value={classForm.description}
                      onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
                      placeholder="Keterangan opsional sesi belajar..."
                      rows={2}
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Day & Time Slot (Always Shown) */}
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800/80 pt-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Hari *</label>
                  <select
                    required
                    value={classForm.dayOfWeek}
                    onChange={(e) => setClassForm({ ...classForm, dayOfWeek: e.target.value as DayOfWeek })}
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="">Pilih Hari</option>
                    {DAYS.map(d => (
                      <option key={d.key} value={d.key}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Jam Sesi *</label>
                  <select
                    required
                    value={classForm.timeSlot}
                    onChange={(e) => setClassForm({ ...classForm, timeSlot: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="">Pilih Jam</option>
                    {TIME_SLOTS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 justify-between">
                {selectedClass ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleUnscheduleClass}
                      className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer shadow-3xs hover:-translate-y-0.5 active:translate-y-0"
                    >
                      Lepas Sesi
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteClass}
                      className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer shadow-3xs hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Hapus
                    </button>
                  </div>
                ) : <div />}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingClass}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {savingClass ? 'Menyimpan...' : 'Simpan Sesi'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClassModal(false)}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANAGE STUDENT ENROLLMENTS */}
      {showEnrollModal && enrollClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-scaleIn flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-emerald-50/40 dark:bg-slate-800/40">
              <div>
                <h3 className="font-extrabold text-slate-800 dark:text-white text-sm">
                  🎓 Kelola Siswa Terdaftar
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{enrollClass.name}</p>
              </div>
              <button
                onClick={() => setShowEnrollModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Box */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Cari siswa untuk didaftarkan..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* List */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                  Tidak ditemukan siswa.
                </div>
              ) : (
                filteredStudents.map(student => {
                  const enrollment = enrollClass.enrollments.find(e => e.studentId === student.id)
                  return (
                    <div
                      key={student.id}
                      onClick={() => handleToggleEnrollment(student)}
                      className={`flex justify-between items-center p-3 rounded-2xl border transition-all cursor-pointer select-none active:scale-[0.98] ${
                        enrollment
                          ? 'border-indigo-200 bg-indigo-50/40 dark:border-indigo-900/40 dark:bg-indigo-950/20'
                          : 'border-slate-100 hover:border-slate-200 dark:border-slate-800 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">{student.name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{student.grade || 'Tidak ada program'}</div>
                      </div>
                      <div className={`p-1.5 rounded-full transition-all ${enrollment ? 'bg-indigo-600 text-white shadow-2xs' : 'border border-slate-200 dark:border-slate-800 text-transparent'}`}>
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-bold">Terdaftar: {enrollClass.enrollments.length} Siswa</span>
              <button
                onClick={() => setShowEnrollModal(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: GENERATE WEEKLY SCHEDULES FROM TIMETABLE */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-emerald-50/40 dark:bg-slate-800/40">
              <h3 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <CalendarPlus className="h-4.5 w-4.5 text-emerald-600" />
                Rilis Jadwal Mingguan
              </h3>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleGenerateWeeklySchedules} className="p-6 space-y-4">
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 p-4 text-amber-800 dark:text-amber-300 text-xs space-y-2">
                <div className="flex gap-2 font-bold items-center">
                  <Info className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                  PENTING &amp; OTOMATISASI WAHA
                </div>
                <p className="leading-relaxed">
                  Tindakan ini akan membaca semua Sesi Kelas tetap yang ada di Timetable ini, menghitung tanggal riilnya berdasarkan Senin yang dipilih, dan membuat jadwal di database.
                </p>
                <p className="font-semibold leading-relaxed">
                  Jadwal akan dirilis langsung dengan status <strong className="underline">Diterbitkan (PUBLISHED)</strong>, dan notifikasi WhatsApp berisi rincian kelas akan dikirim otomatis ke masing-masing Orang Tua Siswa &amp; Tutor pengajar!
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Tanggal Mulai Minggu (Senin) *</label>
                <input
                  required
                  type="date"
                  value={generateForm.startDate}
                  onChange={(e) => setGenerateForm({ ...generateForm, startDate: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Sesi akan dijadwalkan dari Senin s.d. Minggu di minggu tersebut.</p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 justify-end">
                <button
                  type="submit"
                  disabled={generating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Send className="h-3.5 w-3.5 animate-pulse" />
                  {generating ? 'Memproses & Mengirim WA...' : 'Mulai Rilis & Kirim WA'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT DAILY PIKET */}
      {showPiketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-indigo-50/40 dark:bg-slate-800/40">
              <h3 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                <Users className="h-4.5 w-4.5 text-indigo-600" />
                Kelola Staff Piket Harian
              </h3>
              <button
                onClick={() => setShowPiketModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSavePiket} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                {DAYS.map(d => {
                  const selectedNames = piketForm[d.label] || []
                  return (
                    <div key={d.key} className="space-y-2 pb-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                      <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">{d.label}</label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {tutors.length === 0 ? (
                          <span className="text-[10px] text-slate-400">Belum ada tutor aktif.</span>
                        ) : (
                          tutors.map(tutor => {
                            const isSelected = selectedNames.includes(tutor.name)
                            return (
                              <button
                                key={tutor.id}
                                type="button"
                                onClick={() => handleToggleTutorPiket(d.label, tutor.name)}
                                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                                  isSelected
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-3xs active:scale-95'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                }`}
                              >
                                {isSelected && <Check className="h-3 w-3" />}
                                {tutor.name}
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 justify-end">
                <button
                  type="submit"
                  disabled={savingPiket}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0"
                >
                  {savingPiket ? 'Menyimpan...' : 'Simpan Jadwal Piket'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPiketModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
