'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

interface Media {
  id: string
  url: string
  type: 'PHOTO' | 'VIDEO'
  filename: string
}

interface Report {
  id: string
  content: string
  score: number | null
  createdAt: string
  student: { id: string; name: string }
  schedule: { date: string; topic: string | null; class: { name: string } }
  tutor: { name: string }
  media: Media[]
}

interface ReportsClientProps {
  initialReports: Report[]
}

export default function ReportsClient({ initialReports }: ReportsClientProps) {
  const [reports] = useState<Report[]>(initialReports)
  const [loading] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = reports.filter((r) =>
    r.student.name.toLowerCase().includes(search.toLowerCase()) ||
    r.schedule.class.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">📋 Laporan & Media Siswa</h1>
        <p className="text-sm text-slate-500 mt-0.5">Seluruh laporan belajar dan foto/video sesi yang diupload tutor.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Cari nama siswa atau kelas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      {loading ? (
        <div className="p-10 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
          <p className="text-3xl">📭</p>
          <p className="mt-2 text-sm">{search ? 'Laporan tidak ditemukan.' : 'Belum ada laporan yang dibuat.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((report) => (
            <div key={report.id} className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800">{report.student.name}</h3>
                    <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">{report.schedule.class.name}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(report.schedule.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    {' · '}Tutor: {report.tutor.name}
                  </p>
                  {report.schedule.topic && (
                    <p className="text-xs text-indigo-600 font-medium mt-0.5">📚 {report.schedule.topic}</p>
                  )}
                </div>
                {report.score !== null && (
                  <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 shrink-0">
                    <span className="text-lg font-extrabold text-indigo-600">{report.score}</span>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-xs font-semibold text-slate-500 mb-1">Catatan Tutor:</p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{report.content}</p>
              </div>

              {report.media.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">
                    Media ({report.media.length} file):
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {report.media.map((m) => (
                      <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">
                        {m.type === 'PHOTO' ? (
                          <div className="h-24 w-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                            <img src={m.url} alt={m.filename} className="h-full w-full object-cover hover:opacity-80 transition-opacity" />
                          </div>
                        ) : (
                          <div className="h-24 w-24 rounded-xl border border-slate-200 bg-slate-800 flex flex-col items-center justify-center gap-1 hover:opacity-80 transition-opacity">
                            <span className="text-2xl">🎥</span>
                            <span className="text-[9px] text-slate-300 font-medium">Video</span>
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
