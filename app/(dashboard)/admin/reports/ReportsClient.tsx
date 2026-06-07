'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { StarRating } from '@/components/ui/star-rating'

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
  schedule: { date: string; topic: string | null; class: { id: string; name: string } }
  tutor: { name: string }
  media: Media[]
}

interface ReportsClientProps {
  classes: { id: string; name: string }[]
}

const PAGE_SIZE = 20

export default function ReportsClient({ classes }: ReportsClientProps) {
  const [search,   setSearch]   = useState('')
  const [classId,  setClassId]  = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [page,     setPage]     = useState(1)

  const [reports,   setReports]   = useState<Report[]>([])
  const [total,     setTotal]     = useState(0)
  const [pageCount, setPageCount] = useState(0)
  const [loading,   setLoading]   = useState(true)

  // Debounce search — waits 400ms after last keystroke before triggering fetch
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearchChange(value: string) {
    setSearch(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 400)
  }

  function handleClassChange(value: string) {
    setClassId(value)
    setPage(1)
  }

  function handleDateFromChange(value: string) {
    setDateFrom(value)
    setPage(1)
  }

  function handleDateToChange(value: string) {
    setDateTo(value)
    setPage(1)
  }

  // Clicking a student name fills the search box and filters by that student
  function handleStudentClick(name: string) {
    handleSearchChange(name)
  }

  // Clicking a class badge sets the class filter
  function handleClassBadgeClick(id: string) {
    handleClassChange(id)
  }

  function clearFilters() {
    setSearch('')
    setClassId('')
    setDateFrom('')
    setDateTo('')
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    setDebouncedSearch('')
    setPage(1)
  }

  const hasActiveFilters = !!(search || classId || dateFrom || dateTo)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (classId)         params.set('classId', classId)
    if (dateFrom)        params.set('dateFrom', dateFrom)
    if (dateTo)          params.set('dateTo', dateTo)

    fetch(`/api/admin/reports/list?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setReports(data.reports ?? [])
        setTotal(data.total ?? 0)
        setPageCount(data.pageCount ?? 0)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [page, debouncedSearch, classId, dateFrom, dateTo])

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd   = Math.min(page * PAGE_SIZE, total)
  const selectedClassName = classId ? (classes.find((c) => c.id === classId)?.name ?? '') : ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">📋 Laporan & Media Siswa</h1>
        <p className="text-sm text-slate-500 mt-0.5">Seluruh laporan belajar dan foto/video sesi yang diupload tutor.</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama siswa atau kelas..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Class filter */}
        <select
          value={classId}
          onChange={(e) => handleClassChange(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-500 text-slate-700"
        >
          <option value="">Semua Kelas</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Date from */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => handleDateFromChange(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-500 text-slate-700"
          title="Dari tanggal"
        />

        {/* Date to */}
        <input
          type="date"
          value={dateTo}
          onChange={(e) => handleDateToChange(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-500 text-slate-700"
          title="Sampai tanggal"
        />

        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition shrink-0"
            title="Reset semua filter"
          >
            <X className="h-4 w-4" />
            Reset
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 -mt-2">
          {search && (
            <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 font-medium px-2.5 py-1 rounded-full">
              Nama: {search}
              <button onClick={() => handleSearchChange('')} className="hover:text-indigo-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedClassName && (
            <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 font-medium px-2.5 py-1 rounded-full">
              Kelas: {selectedClassName}
              <button onClick={() => handleClassChange('')} className="hover:text-indigo-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {dateFrom && (
            <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 font-medium px-2.5 py-1 rounded-full">
              Dari: {new Date(dateFrom).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              <button onClick={() => handleDateFromChange('')} className="hover:text-indigo-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {dateTo && (
            <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 font-medium px-2.5 py-1 rounded-full">
              Sampai: {new Date(dateTo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              <button onClick={() => handleDateToChange('')} className="hover:text-indigo-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Results count */}
      {!loading && total > 0 && (
        <p className="text-xs text-slate-400">
          Menampilkan{' '}
          <span className="font-semibold text-slate-600">{rangeStart}–{rangeEnd}</span>{' '}
          dari{' '}
          <span className="font-semibold text-slate-600">{total}</span> laporan
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="p-10 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
          <p className="text-3xl">📭</p>
          <p className="mt-2 text-sm">
            {hasActiveFilters ? 'Laporan tidak ditemukan.' : 'Belum ada laporan yang dibuat.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-3 text-xs text-indigo-600 hover:underline"
            >
              Reset filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Clickable student name → fills search */}
                    <button
                      onClick={() => handleStudentClick(report.student.name)}
                      className="font-bold text-slate-800 hover:text-indigo-600 transition-colors text-left"
                      title={`Filter laporan ${report.student.name}`}
                    >
                      {report.student.name}
                    </button>
                    {/* Clickable class badge → sets class filter */}
                    <button
                      onClick={() => handleClassBadgeClick(report.schedule.class.id)}
                      className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-full hover:bg-indigo-100 transition-colors"
                      title={`Filter kelas ${report.schedule.class.name}`}
                    >
                      {report.schedule.class.name}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(report.schedule.date).toLocaleDateString('id-ID', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                    {' · '}Tutor: {report.tutor.name}
                  </p>
                  {report.schedule.topic && (
                    <p className="text-xs text-indigo-600 font-medium mt-0.5">📚 {report.schedule.topic}</p>
                  )}
                </div>
                {report.score !== null && (
                  <div className="shrink-0">
                    <StarRating value={report.score} size="md" />
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
                      <div key={m.id} className="flex flex-col gap-1">
                        {m.type === 'PHOTO' ? (
                          <a href={m.url} target="_blank" rel="noopener noreferrer">
                            <div className="h-24 w-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                              <img
                                src={m.url}
                                alt={m.filename}
                                loading="lazy"
                                className="h-full w-full object-cover hover:opacity-80 transition-opacity"
                              />
                            </div>
                          </a>
                        ) : (
                          <div className="space-y-1">
                            <video
                              src={m.url}
                              controls
                              preload="metadata"
                              className="h-24 w-40 rounded-xl border border-slate-200 bg-slate-100 object-cover"
                              title={m.filename}
                            />
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                            >
                              🔗 Lihat Video
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="h-4 w-4" />
            Sebelumnya
          </button>

          <span className="text-xs text-slate-500">
            Halaman <span className="font-semibold text-slate-700">{page}</span> dari{' '}
            <span className="font-semibold text-slate-700">{pageCount}</span>
          </span>

          <button
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount || loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Berikutnya
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
