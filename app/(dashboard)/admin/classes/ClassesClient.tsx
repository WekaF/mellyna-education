'use client'

import { useState, useCallback } from 'react'
import { Plus, Users, Pencil, Info } from 'lucide-react'

const PROGRAMS = ['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH'] as const
type ProgramValue = typeof PROGRAMS[number]

const MAIN_PROGRAMS: ProgramValue[] = ['SEMPOA', 'CALISTUNG', 'ENGLISH']
const SUB_PROGRAMS: ProgramValue[] = ['AHE', 'EFK', 'EYL', 'EFE']

const PROGRAM_COLORS: Record<ProgramValue, string> = {
  SEMPOA:    'bg-purple-100 text-purple-700 border border-purple-200',
  AHE:       'bg-amber-100 text-amber-700 border border-amber-200',
  EFK:       'bg-teal-100 text-teal-700 border border-teal-200',
  EYL:       'bg-pink-100 text-pink-700 border border-pink-200',
  EFE:       'bg-rose-100 text-rose-700 border border-rose-200',
  CALISTUNG: 'bg-green-100 text-green-700 border border-green-200',
  ENGLISH:   'bg-blue-100 text-blue-700 border border-blue-200',
}

interface ClassProgram { program: ProgramValue }

interface Class {
  id: string
  name: string
  mainProgram: ProgramValue | null
  programs: ClassProgram[]
  description: string | null
  tutor: { name: string; email: string }
  _count: { enrollments: number }
  enrollments?: Array<{ id: string; student: { id: string; name: string; grade: string | null } }>
}

function ProgramBadge({ program }: { program: ProgramValue }) {
  return (
    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${PROGRAM_COLORS[program] ?? 'bg-slate-100 text-slate-700'}`}>
      {program}
    </span>
  )
}

function ProgramToggle({
  selected,
  onChange,
  programs: programList = PROGRAMS,
}: {
  selected: ProgramValue[]
  onChange: (p: ProgramValue[]) => void
  programs?: readonly ProgramValue[]
}) {
  const toggle = (p: ProgramValue) => {
    onChange(selected.includes(p) ? selected.filter(x => x !== p) : [...selected, p])
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {programList.map(p => (
        <button
          key={p}
          type="button"
          onClick={() => toggle(p)}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
            selected.includes(p)
              ? `${PROGRAM_COLORS[p]} shadow-sm`
              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

const makeEmptyForm = () => ({ name: '', mainProgram: '' as ProgramValue | '', programs: [] as ProgramValue[], description: '', tutorId: '' })

interface ClassCardProps {
  cls: Class
  onEdit: (cls: Class) => void
  onEnroll: (cls: Class) => void
}

function ClassCard({ cls, onEdit, onEnroll }: ClassCardProps) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-slate-800">{cls.name}</h3>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {cls.programs.map(({ program }) => (
              <ProgramBadge key={program} program={program} />
            ))}
          </div>
        </div>
        <button
          onClick={() => onEdit(cls)}
          className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-slate-500">{cls.description || 'Tidak ada deskripsi.'}</p>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Users className="h-3.5 w-3.5" />
          <span>{cls._count.enrollments} Siswa</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEnroll(cls)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
          >
            Kelola Siswa
          </button>
          <span className="text-xs text-slate-600 font-medium">Tutor: {cls.tutor.name}</span>
        </div>
      </div>
    </div>
  )
}

interface TutorOption {
  id: string
  name: string
  email: string
}

interface StudentOption {
  id: string
  name: string
  grade: string | null
}

interface ClassesClientProps {
  initialClasses: Class[]
  initialTutors: TutorOption[]
  initialStudents: StudentOption[]
}

export default function ClassesClient({ initialClasses, initialTutors, initialStudents }: ClassesClientProps) {
  const [classes, setClasses] = useState<Class[]>(initialClasses)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(makeEmptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tutors] = useState<TutorOption[]>(initialTutors)

  const [editClass, setEditClass] = useState<Class | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editForm, setEditForm] = useState(makeEmptyForm)
  const [editSaving, setEditSaving] = useState(false)

  const [enrollClass, setEnrollClass] = useState<Class | null>(null)
  const [enrollStudentId, setEnrollStudentId] = useState('')
  const [enrollSaving, setEnrollSaving] = useState(false)
  const [allStudents] = useState<StudentOption[]>(initialStudents)

  const fetchClasses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/classes')
      if (!res.ok) throw new Error('Gagal memuat data kelas.')
      setClasses(await res.json())
    } catch {
      setError('Gagal memuat data kelas.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.mainProgram) { setError('Pilih program utama.'); return }
    setSaving(true)
    setError(null)
    try {
      const allPrograms = form.mainProgram
        ? [form.mainProgram as ProgramValue, ...form.programs.filter(p => p !== form.mainProgram)]
        : form.programs
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, programs: allPrograms }),
      })
      if (!res.ok) throw new Error('Gagal menyimpan kelas.')
      await fetchClasses()
      setShowForm(false)
      setForm(makeEmptyForm())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editClass) return
    if (!editForm.mainProgram) { setError('Pilih program utama.'); return }
    setEditSaving(true)
    setError(null)
    try {
      const allPrograms = editForm.mainProgram
        ? [editForm.mainProgram as ProgramValue, ...editForm.programs.filter(p => p !== editForm.mainProgram)]
        : editForm.programs
      const payload: Record<string, unknown> = {
        name: editForm.name,
        mainProgram: editForm.mainProgram,
        programs: allPrograms,
        description: editForm.description,
        ...(editForm.tutorId ? { tutorId: editForm.tutorId } : {}),
      }
      const res = await fetch(`/api/classes/${editClass.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Gagal menyimpan perubahan.')
      await fetchClasses()
      setShowEditForm(false)
      setEditClass(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setEditSaving(false)
    }
  }

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!enrollClass || !enrollStudentId) return
    setEnrollSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: enrollStudentId, classId: enrollClass.id }),
      })
      if (!res.ok) throw new Error('Gagal mendaftarkan siswa.')
      const refetchRes = await fetch('/api/classes')
      const updatedClasses = await refetchRes.json()
      setClasses(updatedClasses)
      const refreshed = updatedClasses.find((c: Class) => c.id === enrollClass.id)
      if (refreshed) setEnrollClass(refreshed)
      setEnrollStudentId('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setEnrollSaving(false)
    }
  }

  const handleUnenroll = async (enrollmentId: string) => {
    if (!confirm('Keluarkan siswa dari kelas ini?')) return
    try {
      const delRes = await fetch(`/api/enrollments/${enrollmentId}`, { method: 'DELETE' })
      if (!delRes.ok) throw new Error('Gagal mengeluarkan siswa.')
      const refetchRes = await fetch('/api/classes')
      const updatedClasses = await refetchRes.json()
      setClasses(updatedClasses)
      if (enrollClass) {
        const refreshed = updatedClasses.find((c: Class) => c.id === enrollClass.id)
        if (refreshed) setEnrollClass(refreshed)
      }
    } catch {
      setError('Gagal mengeluarkan siswa.')
    }
  }

  const handleEditOpen = useCallback((cls: Class) => {
    setEditClass(cls)
    setEditForm({
      name: cls.name,
      mainProgram: cls.mainProgram ?? '',
      programs: cls.programs.map(p => p.program).filter(p => SUB_PROGRAMS.includes(p)),
      description: cls.description || '',
      tutorId: '',
    })
    setShowEditForm(true)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">🏫 Data Kelas & Tutor</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola kelas bimbingan belajar dan penugasan tutor.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Buat Kelas Baru
        </button>
      </div>

      {/* Program info box */}
      <div className="flex gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
        <div>
          <span className="font-bold">Program Utama vs Program Tambahan: </span>
          <strong>Program Utama</strong> adalah jenis kelas (SEMPOA, CALISTUNG, ENGLISH). <strong>Program Tambahan</strong> adalah sub-level dalam program utama (contoh: AHE, EYL dalam SEMPOA).
        </div>
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">⚠️ {error}</div>}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6 space-y-4">
          <div>
            <h2 className="font-bold text-slate-800">Tambah Kelas Baru</h2>
            <p className="text-xs text-slate-400 mt-0.5">Jadwal (hari & jam) diatur di halaman Timetable.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Kelas *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="mis. Sempoa Kelompok A"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tutor *</label>
                <select
                  required
                  value={form.tutorId}
                  onChange={(e) => setForm({ ...form, tutorId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="">Pilih Tutor</option>
                  {tutors.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Program Utama */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Program Utama <span className="text-red-400">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {MAIN_PROGRAMS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, mainProgram: p, programs: [] }))}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
                      form.mainProgram === p
                        ? `${PROGRAM_COLORS[p]} shadow-sm`
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {/* Program Tambahan */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Program Tambahan <span className="font-normal text-slate-400">(opsional — sub-level program)</span>
              </label>
              <ProgramToggle
                selected={form.programs}
                onChange={(p) => setForm(f => ({ ...f, programs: p }))}
                programs={SUB_PROGRAMS}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Deskripsi</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Deskripsi singkat (opsional)"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan Kelas'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer">Batal</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" /></div>
      ) : classes.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
          <p className="text-3xl">📚</p>
          <p className="mt-2 font-medium text-sm">Belum ada kelas yang dibuat.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {MAIN_PROGRAMS.map(prog => {
            const group = classes.filter(c => c.mainProgram === prog)
            if (group.length === 0) return null
            return (
              <div key={prog}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${PROGRAM_COLORS[prog]}`}>{prog}</span>
                  <span className="text-xs text-slate-400">{group.length} kelas</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {group.map((cls) => (
                    <ClassCard key={cls.id} cls={cls} onEdit={handleEditOpen} onEnroll={setEnrollClass} />
                  ))}
                </div>
              </div>
            )
          })}
          {(() => {
            const ungrouped = classes.filter(c => !c.mainProgram || !MAIN_PROGRAMS.includes(c.mainProgram as ProgramValue))
            if (ungrouped.length === 0) return null
            return (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600">Lainnya</span>
                  <span className="text-xs text-slate-400">{ungrouped.length} kelas</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {ungrouped.map((cls) => (
                    <ClassCard key={cls.id} cls={cls} onEdit={handleEditOpen} onEnroll={setEnrollClass} />
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Edit Class Modal */}
      {showEditForm && editClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => setShowEditForm(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl z-10">
            <h2 className="font-bold text-slate-800 mb-4">Edit Kelas: {editClass.name}</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Kelas *</label>
                  <input
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="mis. Sempoa Kelompok A"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Ganti Tutor (opsional)</label>
                  <select
                    value={editForm.tutorId}
                    onChange={(e) => setEditForm({ ...editForm, tutorId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="">Biarkan tutor saat ini ({editClass.tutor.name})</option>
                    {tutors.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Program Utama */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Program Utama <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MAIN_PROGRAMS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, mainProgram: p, programs: [] }))}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
                        editForm.mainProgram === p
                          ? `${PROGRAM_COLORS[p]} shadow-sm`
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              {/* Program Tambahan */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Program Tambahan <span className="font-normal text-slate-400">(opsional — sub-level program)</span>
                </label>
                <ProgramToggle
                  selected={editForm.programs}
                  onChange={(p) => setEditForm(f => ({ ...f, programs: p }))}
                  programs={SUB_PROGRAMS}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Deskripsi</label>
                <input
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Deskripsi singkat (opsional)"
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={editSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
                  {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
                <button type="button" onClick={() => setShowEditForm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enrollment Management Modal */}
      {enrollClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => setEnrollClass(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl z-10 max-h-[80vh] overflow-y-auto">
            <h2 className="font-bold text-slate-800 mb-1">Kelola Siswa: {enrollClass.name}</h2>
            <div className="flex flex-wrap gap-1 mb-3">
              {enrollClass.programs.map(({ program }) => (
                <ProgramBadge key={program} program={program} />
              ))}
            </div>
            <p className="text-xs text-slate-500 mb-4">{enrollClass._count.enrollments} siswa terdaftar</p>

            <div className="space-y-2 mb-5">
              {(enrollClass.enrollments ?? []).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Belum ada siswa terdaftar.</p>
              ) : (
                (enrollClass.enrollments ?? []).map(({ id: enrollId, student }) => (
                  <div key={enrollId} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{student.name}</p>
                      <p className="text-xs text-slate-400">{student.grade || 'Kelas tidak diketahui'}</p>
                    </div>
                    <button
                      onClick={() => handleUnenroll(enrollId)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                    >
                      Keluarkan
                    </button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleEnrollSubmit} className="flex gap-3 border-t border-slate-100 pt-4">
              <select
                required
                value={enrollStudentId}
                onChange={(e) => setEnrollStudentId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
              >
                <option value="">Tambah siswa ke kelas ini...</option>
                {allStudents
                  .filter((s) => !(enrollClass.enrollments ?? []).some((e) => e.student.id === s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{s.grade ? ` (${s.grade})` : ''}</option>
                  ))}
              </select>
              <button type="submit" disabled={enrollSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50">
                {enrollSaving ? '...' : 'Daftarkan'}
              </button>
            </form>

            <button
              onClick={() => setEnrollClass(null)}
              className="mt-3 w-full text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
