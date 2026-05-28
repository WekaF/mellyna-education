'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users } from 'lucide-react'

interface TutorUser {
  id: string
  name: string
  email: string
  phone: string | null
  createdAt: string
  tutorClasses: { id: string; name: string; subject: string }[]
}

export default function AdminTutorsPage() {
  const [tutors, setTutors] = useState<TutorUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTutors = useCallback(async () => {
    setLoading(true)
    try {
      // Get all users who are tutors by listing classes and grouping by tutor
      const res = await fetch('/api/classes')
      const classes = await res.json()

      // Group classes by tutor
      const tutorMap: Record<string, TutorUser> = {}
      classes.forEach((cls: any) => {
        const tutor = cls.tutor
        if (!tutorMap[tutor.id]) {
          tutorMap[tutor.id] = {
            id: tutor.id,
            name: tutor.name,
            email: tutor.email,
            phone: tutor.phone || null,
            createdAt: tutor.createdAt || '',
            tutorClasses: [],
          }
        }
        tutorMap[tutor.id].tutorClasses.push({ id: cls.id, name: cls.name, subject: cls.subject })
      })

      setTutors(Object.values(tutorMap))
    } catch {
      setError('Gagal memuat data tutor.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTutors() }, [fetchTutors])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">👩‍🏫 Data Tutor</h1>
        <p className="text-sm text-slate-500 mt-0.5">Daftar tutor yang terdaftar di Mellyna Education.</p>
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">⚠️ {error}</div>}

      {loading ? (
        <div className="p-10 text-center"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" /></div>
      ) : tutors.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
          <p className="text-3xl">👩‍🏫</p>
          <p className="mt-2 text-sm font-medium">Belum ada tutor yang terdaftar.</p>
          <p className="text-xs text-slate-400 mt-1">Buat kelas baru dan pilih tutor untuk melihat data di sini.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tutors.map((tutor) => (
            <div key={tutor.id} className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
                  <span className="text-xl">👩‍🏫</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{tutor.name}</h3>
                  <p className="text-xs text-slate-500">{tutor.email}</p>
                  {tutor.phone && <p className="text-xs text-slate-400">{tutor.phone}</p>}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 mb-2">
                  <Users className="h-3.5 w-3.5" />
                  <span>Mengajar {tutor.tutorClasses.length} kelas</span>
                </div>
                {tutor.tutorClasses.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Belum ada kelas yang diasuh.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {tutor.tutorClasses.map((cls) => (
                      <span key={cls.id} className="inline-block text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full border border-indigo-100">
                        {cls.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
