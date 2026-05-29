'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  UsersRound,
  UserCheck,
  UserX,
  UserPlus,
  CreditCard,
  BarChart2,
  FileText,
  X,
  Calendar,
  Award,
  Info,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  BookOpen,
  Check
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/common/DataTable'
import { formatRupiah } from '@/lib/utils'

// TS Interfaces matching Prisma relations
interface TutorInfo {
  name: string
}

interface ClassInfo {
  id: string
  name: string
  subject: string
  tutor: TutorInfo
}

interface Enrollment {
  id: string
  class: ClassInfo
}

interface Invoice {
  id: string
  amount: number
  description: string
  dueDate: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  paidAt: string | null
  createdAt: string
}

interface Attendance {
  id: string
  status: 'PRESENT' | 'ABSENT' | 'SICK' | 'PERMISSION'
  notes: string | null
  markedAt: string
}

interface LearningReport {
  id: string
  content: string
  score: number | null
  createdAt: string
  tutor: TutorInfo
  schedule: {
    date: string
    topic: string | null
  }
}

interface Student {
  id: string
  name: string
  grade: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  enrollments: Enrollment[]
  invoices: Invoice[]
  attendances: Attendance[]
  reports: LearningReport[]
}

interface Parent {
  id: string
  name: string
  email: string
  phone: string | null
  suspended: boolean
  createdAt: string
  children: Student[]
}

export default function AdminParentsPage() {
  const [parents, setParents] = useState<Parent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Suspension states to prevent double clicks
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState<string | null>(null)

  // Drawer / Modal states
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null)
  const [activeAnalyticTab, setActiveAnalyticTab] = useState<'overview' | 'attendance' | 'academic' | 'finance'>('overview')

  // Fetch all parents data
  const fetchParents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/parents')
      if (!res.ok) throw new Error('Gagal memuat data wali murid.')
      const data = await res.json()
      setParents(data)
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem saat memuat data.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleAddParent = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setAddSaving(true)
    setAddError(null)
    setAddSuccess(null)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, role: 'PARENT' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan wali murid.')
      setAddSuccess(`Akun wali murid "${data.name}" berhasil dibuat. Login dengan email: ${data.email}`)
      setAddForm({ name: '', email: '', phone: '', password: '' })
      await fetchParents()
    } catch (err: any) {
      setAddError(err.message)
    } finally {
      setAddSaving(false)
    }
  }, [addForm, fetchParents])

  useEffect(() => {
    fetchParents()
  }, [fetchParents])

  // Handle Account Suspension Toggle
  const handleToggleSuspend = useCallback(async (parent: Parent) => {
    if (togglingId) return
    
    const confirmMsg = parent.suspended
      ? `Aktifkan kembali akun wali murid "${parent.name}"? Ini juga akan mengaktifkan seluruh siswanya kembali.`
      : `Tangguhkan akun wali murid "${parent.name}"? Seluruh siswa (anak) dari wali murid ini otomatis akan menjadi NONAKTIF.`
      
    if (!confirm(confirmMsg)) return

    setTogglingId(parent.id)
    try {
      const res = await fetch(`/api/admin/users/${parent.id}/suspend`, {
        method: 'PATCH',
      })
      
      if (!res.ok) throw new Error('Gagal memperbarui status penangguhan.')
      
      // Update local state cascadingly
      setParents((prevParents) =>
        prevParents.map((p) => {
          if (p.id === parent.id) {
            const nextSuspended = !p.suspended
            return {
              ...p,
              suspended: nextSuspended,
              children: p.children.map((c) => ({
                ...c,
                isActive: !nextSuspended // cascade to active state of students
              }))
            }
          }
          return p
        })
      )

      // If active drawer is currently showing a student from this parent, update its isActive status
      if (selectedParent && selectedParent.id === parent.id) {
        const nextSuspended = !parent.suspended
        setSelectedParent((prev) => prev ? { ...prev, suspended: nextSuspended } : null)
        if (selectedStudent) {
          setSelectedStudent((prev) => prev ? { ...prev, isActive: !nextSuspended } : null)
        }
      }
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status akun.')
    } finally {
      setTogglingId(null)
    }
  }, [togglingId, selectedParent, selectedStudent])

  // Helper: check if parent has unpaid billings
  const getParentBillingStatus = (parent: Parent) => {
    let hasUnpaid = false
    parent.children.forEach((student) => {
      student.invoices.forEach((invoice) => {
        if (invoice.status === 'PENDING' || invoice.status === 'OVERDUE') {
          hasUnpaid = true
        }
      })
    })
    return hasUnpaid ? 'UNPAID' : 'PAID'
  }

  // Helper: format phone to wa link
  const getWaLink = (phone: string | null, name: string) => {
    if (!phone) return null
    const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '62')
    const message = encodeURIComponent(`Halo ${name}, kami dari tim administrasi Mellyna Education...`)
    return `https://wa.me/${cleanPhone}?text=${message}`
  }

  // Operational metrics
  const stats = useMemo(() => {
    let total = parents.length
    let active = 0
    let suspended = 0
    let unpaid = 0

    parents.forEach((p) => {
      if (p.suspended) suspended++
      else active++

      if (getParentBillingStatus(p) === 'UNPAID') unpaid++
    })

    return [
      { label: 'Total Wali Murid', value: total, icon: UsersRound, color: 'from-blue-500 to-indigo-600', text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
      { label: 'Wali Murid Aktif', value: active, icon: UserCheck, color: 'from-emerald-500 to-teal-600', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
      { label: 'Akun Ditangguhkan', value: suspended, icon: UserX, color: 'from-rose-500 to-pink-600', text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/30' },
      { label: 'Wali Menunggak', value: unpaid, icon: CreditCard, color: 'from-amber-500 to-orange-600', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
    ]
  }, [parents])

  // Columns for DataTable
  const columns = useMemo<ColumnDef<Parent>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Nama Wali Murid',
      cell: ({ row }) => {
        const parent = row.original
        return (
          <div className="flex flex-col">
            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm tracking-wide">{parent.name}</span>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 shrink-0 text-slate-350" />
                {parent.email}
              </span>
              {parent.phone && (
                <a
                  href={getWaLink(parent.phone, parent.name) || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium transition-colors"
                  title="Hubungi via WhatsApp"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {parent.phone}
                </a>
              )}
            </div>
          </div>
        )
      },
    },
    {
      id: 'children',
      header: 'Siswa / Anak',
      cell: ({ row }) => {
        const parent = row.original
        if (parent.children.length === 0) {
          return <span className="text-xs text-slate-400 dark:text-slate-500 italic">Belum mendaftarkan siswa</span>
        }
        return (
          <div className="flex flex-wrap gap-1.5 max-w-xs">
            {parent.children.map((child) => (
              <button
                key={child.id}
                onClick={() => {
                  setSelectedParent(parent)
                  setSelectedStudent(child)
                  setActiveAnalyticTab('overview')
                }}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 shadow-xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200 ${
                  child.isActive
                    ? 'bg-blue-50/70 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/60 dark:text-blue-400'
                    : 'bg-slate-50 border-slate-200 text-slate-400 line-through dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-500'
                }`}
                title={`Lihat Analitik: ${child.name}`}
              >
                📊 {child.name}
              </button>
            ))}
          </div>
        )
      },
    },
    {
      id: 'packages',
      header: 'Paket Belajar',
      cell: ({ row }) => {
        const parent = row.original
        if (parent.children.length === 0) {
          return <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
        }
        return (
          <div className="space-y-1.5">
            {parent.children.map((child) => {
              const baseGrade = child.grade ? child.grade.split(' | ')[0] : 'Siswa Bimbel'
              const pricingPart = child.grade && child.grade.includes(' | ') ? child.grade.split(' | ')[1] : 'Tingkat 1'
              
              return (
                <div key={child.id} className="text-xs flex items-center gap-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-350">{child.name}:</span>
                  <span className="text-slate-500 dark:text-slate-450 truncate" title={`${baseGrade} (${pricingPart})`}>
                    {baseGrade} <span className="text-[10px] px-1 bg-slate-100 dark:bg-slate-800 rounded font-semibold text-indigo-600 dark:text-indigo-400">{pricingPart.split(' ')[0]}</span>
                  </span>
                </div>
              )
            })}
          </div>
        )
      },
    },
    {
      id: 'billing_status',
      header: 'Status Keuangan',
      cell: ({ row }) => {
        const parent = row.original
        const status = getParentBillingStatus(parent)
        return status === 'UNPAID' ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Menunggak
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Lunas
          </span>
        )
      },
    },
    {
      id: 'account_status',
      header: 'Status Akun',
      cell: ({ row }) => {
        const parent = row.original
        const isToggling = togglingId === parent.id
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleToggleSuspend(parent)}
              disabled={isToggling}
              className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all duration-200 disabled:opacity-50 border ${
                parent.suspended
                  ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100/70 dark:bg-rose-950/10 dark:border-rose-900/40 dark:text-rose-400'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100/70 dark:bg-emerald-950/10 dark:border-emerald-900/40 dark:text-emerald-400'
              }`}
            >
              {isToggling ? (
                <span className="h-3 w-3 animate-spin rounded-full border border-slate-350 border-t-transparent" />
              ) : parent.suspended ? (
                <UserX className="h-3.5 w-3.5" />
              ) : (
                <UserCheck className="h-3.5 w-3.5" />
              )}
              {parent.suspended ? 'Suspended' : 'Aktif'}
            </button>
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const parent = row.original
        if (parent.children.length === 0) return null
        return (
          <div className="flex items-center justify-end">
            <button
              onClick={() => {
                setSelectedParent(parent)
                setSelectedStudent(parent.children[0]) // Open drawer with first child
                setActiveAnalyticTab('overview')
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/30 dark:text-indigo-400 transition-colors cursor-pointer"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span>Analitik</span>
            </button>
          </div>
        )
      },
    },
  ], [handleToggleSuspend, togglingId])

  // Calculation for student analytics
  const studentAnalytics = useMemo(() => {
    if (!selectedStudent) return null

    // 1. Attendance analytics
    const totalAttendances = selectedStudent.attendances.length
    const present = selectedStudent.attendances.filter((a) => a.status === 'PRESENT').length
    const sick = selectedStudent.attendances.filter((a) => a.status === 'SICK').length
    const permission = selectedStudent.attendances.filter((a) => a.status === 'PERMISSION').length
    const absent = selectedStudent.attendances.filter((a) => a.status === 'ABSENT').length

    const attendanceRate = totalAttendances > 0 ? Math.round((present / totalAttendances) * 100) : 100

    // 2. Academic score analytics
    const gradedReports = selectedStudent.reports.filter((r) => r.score !== null)
    const averageScore =
      gradedReports.length > 0
        ? Math.round(gradedReports.reduce((sum, r) => sum + (r.score || 0), 0) / gradedReports.length)
        : null

    return {
      attendance: {
        total: totalAttendances,
        present,
        sick,
        permission,
        absent,
        rate: attendanceRate
      },
      academic: {
        averageScore,
        gradedCount: gradedReports.length,
        totalCount: selectedStudent.reports.length
      }
    }
  }, [selectedStudent])

  return (
    <div className="space-y-8 pb-10 select-none">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100/20 text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
              <UsersRound className="h-6 w-6" />
            </span>
            Portal Pengelola Wali Murid
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 ml-1">
            Pantau akun orang tua, status tagihan aktif, serta analisis grafik performa siswa bimbel secara riil.
          </p>
        </div>
        <button
          onClick={() => {
            setShowAddForm(true)
            setAddForm({ name: '', email: '', phone: '', password: '' })
            setAddError(null)
            setAddSuccess(null)
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer shrink-0"
        >
          <UserPlus className="h-4 w-4" /> Tambah Wali Murid
        </button>
      </div>

      {/* Add Parent Inline Form */}
      {showAddForm && (
        <div className="rounded-2xl bg-white dark:bg-[#121b2d] border border-indigo-100 dark:border-indigo-900/30 shadow-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-indigo-500" />
              Tambah Akun Wali Murid Baru
            </h2>
            <button
              onClick={() => {
                setShowAddForm(false)
                setAddError(null)
                setAddSuccess(null)
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {addError && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 px-4 py-3 text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {addError}
            </div>
          )}

          {addSuccess && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {addSuccess}
            </div>
          )}

          <form onSubmit={handleAddParent} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Nama Lengkap *
              </label>
              <input
                required
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                placeholder="Nama wali murid"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Email *
              </label>
              <input
                required
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                placeholder="email@contoh.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                No. WhatsApp
              </label>
              <input
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                placeholder="08xxxxxxxxxx"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Password Sementara *
              </label>
              <input
                required
                type="password"
                minLength={6}
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                placeholder="Min. 6 karakter"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex gap-3">
              <button
                type="submit"
                disabled={addSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {addSaving ? 'Menyimpan...' : 'Simpan Akun'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setAddError(null)
                  setAddSuccess(null)
                }}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats Operational Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#151f32] p-6 shadow-xs border border-slate-100 dark:border-slate-800/80 flex items-center gap-4 group transition-all duration-300 hover:shadow-md"
            >
              {/* Decorative light effect */}
              <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-slate-100 dark:bg-slate-800/30 blur-2xl group-hover:scale-125 transition-transform" />
              
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.bg} ${stat.text} shadow-xs z-10`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="z-10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{stat.label}</p>
                <p className="mt-1 text-3xl font-black text-slate-800 dark:text-white tracking-tight">{stat.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Error alert */}
      {error && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-4 text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Datatable Container */}
      <div className="rounded-2xl bg-white dark:bg-[#121b2d] border border-slate-150 dark:border-slate-800/60 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={parents}
          loading={loading}
          searchPlaceholder="Cari nama wali murid atau kontak..."
          emptyMessage="Belum ada data wali murid di sistem."
          emptyIcon="📭"
        />
      </div>

      {/* Premium Analytical Side Drawer (Slide Over Panel) */}
      {selectedStudent && selectedParent && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop Blur Overlay */}
            <div
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity duration-500"
              onClick={() => {
                setSelectedStudent(null)
                setSelectedParent(null)
              }}
            />

            {/* Slide-over panel container */}
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <div className="pointer-events-auto w-screen max-w-2xl transform transition-transform duration-500 animate-slide-in bg-white dark:bg-[#121a2c] shadow-2xl flex flex-col h-full border-l border-slate-200 dark:border-slate-800/80">
                
                {/* Header of Drawer */}
                <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-indigo-950 dark:from-[#0e1524] dark:to-[#1a233b] text-white flex items-center justify-between border-b border-indigo-950/30 shadow-md">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest">
                      <Sparkles className="h-3.5 w-3.5" /> Laporan Analitik & Progres Siswa
                    </div>
                    <h2 className="text-xl font-extrabold tracking-tight mt-1 text-white">
                      {selectedStudent.name}
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Orang Tua: <strong className="text-slate-100">{selectedParent.name}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedStudent(null)
                      setSelectedParent(null)
                    }}
                    className="p-2.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer border border-white/5 active:scale-95"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Multiple children toggle tabs (If parent has > 1 children) */}
                {selectedParent.children.length > 1 && (
                  <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800/50 flex items-center gap-2.5 overflow-x-auto">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">Pilih Siswa:</span>
                    <div className="flex items-center gap-2">
                      {selectedParent.children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => setSelectedStudent(child)}
                          className={`text-xs font-bold px-3 py-1 rounded-lg transition-all duration-200 cursor-pointer border ${
                            child.id === selectedStudent.id
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 border-slate-250 dark:border-slate-700 text-slate-600 dark:text-slate-350 hover:bg-slate-50'
                          }`}
                        >
                          {child.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subheader / Tabs of Analytics */}
                <div className="flex bg-slate-50 dark:bg-[#131b2e] border-b border-slate-200 dark:border-slate-800/80 px-6 pt-2 shrink-0">
                  <div className="flex gap-4">
                    {[
                      { id: 'overview', label: 'Ringkasan', icon: Sparkles },
                      { id: 'attendance', label: 'Kehadiran', icon: Calendar },
                      { id: 'academic', label: 'Akademik', icon: Award },
                      { id: 'finance', label: 'Keuangan SPP', icon: CreditCard },
                    ].map((tab) => {
                      const Icon = tab.icon
                      const active = activeAnalyticTab === tab.id
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveAnalyticTab(tab.id as any)}
                          className={`flex items-center gap-1.5 px-2.5 pb-3 pt-1 text-xs font-bold uppercase tracking-wider transition-all duration-200 border-b-2 cursor-pointer ${
                            active
                              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-black'
                              : 'border-transparent text-slate-500 hover:text-slate-850 dark:hover:text-slate-300'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {tab.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Content Container (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-[#101726]/40">
                  {studentAnalytics && (
                    <div className="space-y-6">
                      
                      {/* Status Nonaktif Banner */}
                      {!selectedStudent.isActive && (
                        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-4 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
                          <Info className="h-4.5 w-4.5 shrink-0 text-amber-500 mt-0.5" />
                          <div className="space-y-1">
                            <span className="font-bold">⚠️ Akun Siswa Dinonaktifkan</span>
                            <p className="leading-relaxed">
                              Siswa ini saat ini tidak aktif mengikuti bimbingan belajar karena akun Orang Tua sedang ditangguhkan (Suspended) atau siswa sudah tidak mengikuti kelas.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* TABS IMPLEMENTATION */}
                      
                      {/* TAB 1: OVERVIEW */}
                      {activeAnalyticTab === 'overview' && (
                        <div className="space-y-6">
                          
                          {/* Mini dashboard grid */}
                          <div className="grid gap-4 grid-cols-2">
                            {/* Attendance Rate Metric */}
                            <div className="bg-white dark:bg-[#151f32] p-5 rounded-2xl border border-slate-150 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Rasio Kehadiran</span>
                              <div className="flex items-baseline gap-1.5 mt-3">
                                <span className="text-3xl font-black text-slate-800 dark:text-white">{studentAnalytics.attendance.rate}%</span>
                                <span className="text-xs text-slate-450 dark:text-slate-500">Hadir</span>
                              </div>
                              {/* Progress bar container */}
                              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-4 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    studentAnalytics.attendance.rate >= 85
                                      ? 'bg-emerald-500'
                                      : studentAnalytics.attendance.rate >= 60
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${studentAnalytics.attendance.rate}%` }}
                                />
                              </div>
                            </div>

                            {/* Academic Average Metric */}
                            <div className="bg-white dark:bg-[#151f32] p-5 rounded-2xl border border-slate-150 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nilai Rata-rata</span>
                              <div className="flex items-baseline gap-1.5 mt-3">
                                <span className="text-3xl font-black text-slate-800 dark:text-white">
                                  {studentAnalytics.academic.averageScore !== null ? studentAnalytics.academic.averageScore : '-'}
                                </span>
                                <span className="text-xs text-slate-450 dark:text-slate-500">/ 100</span>
                              </div>
                              {/* Progress bar container */}
                              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-4 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    studentAnalytics.academic.averageScore !== null
                                      ? studentAnalytics.academic.averageScore >= 80
                                        ? 'bg-indigo-500'
                                        : studentAnalytics.academic.averageScore >= 70
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                      : 'bg-slate-200'
                                  }`}
                                  style={{ width: `${studentAnalytics.academic.averageScore || 0}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Classes information card */}
                          <div className="bg-white dark:bg-[#151f32] p-6 rounded-2xl border border-slate-150 dark:border-slate-800/80 shadow-xs space-y-4">
                            <h3 className="font-extrabold text-sm text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800/60 pb-2.5">
                              <BookOpen className="h-4 w-4 text-indigo-500" /> Detail Kelas & Paket Bimbel
                            </h3>
                            
                            <div className="grid gap-4 sm:grid-cols-2 text-xs">
                              <div className="space-y-1">
                                <span className="text-slate-400 dark:text-slate-500">Paket Bimbel aktif:</span>
                                <p className="font-bold text-slate-700 dark:text-slate-350">
                                  {selectedStudent.grade ? selectedStudent.grade.split(' | ')[0] : 'Siswa Bimbel'}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-slate-400 dark:text-slate-500">Tingkat Paket Harga:</span>
                                <p className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                  <Sparkles className="h-3.5 w-3.5" />
                                  {selectedStudent.grade && selectedStudent.grade.includes(' | ')
                                    ? selectedStudent.grade.split(' | ')[1]
                                    : 'Tingkat 1'}
                                </p>
                              </div>
                            </div>

                            {/* Classes Enrollments detailed timeline */}
                            <div className="pt-2">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2.5">Kelas Terdaftar:</span>
                              {selectedStudent.enrollments.length === 0 ? (
                                <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                  Belum terdaftar di kelas manapun.
                                </div>
                              ) : (
                                <div className="space-y-2.5">
                                  {selectedStudent.enrollments.map((enr) => (
                                    <div key={enr.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-150 dark:border-slate-800/60 hover:bg-slate-100/50 dark:hover:bg-slate-900/50 transition-colors">
                                      <div>
                                        <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{enr.class.name}</p>
                                        <p className="text-[10px] text-slate-450 mt-0.5">Mata Pelajaran: {enr.class.subject}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-350">👨‍🏫 Tutor: {enr.class.tutor.name}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Notes/Bio panel */}
                          {selectedStudent.notes && (
                            <div className="bg-white dark:bg-[#151f32] p-5 rounded-2xl border border-slate-150 dark:border-slate-800/80 shadow-xs">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Catatan/Keterangan Akademik:</span>
                              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">
                                "{selectedStudent.notes.split(' | ')[0]}"
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* TAB 2: ATTENDANCE */}
                      {activeAnalyticTab === 'attendance' && (
                        <div className="space-y-6">
                          
                          {/* Circular/Progress visual indicators */}
                          <div className="bg-white dark:bg-[#151f32] p-6 rounded-2xl border border-slate-150 dark:border-slate-800/80 shadow-xs flex flex-col md:flex-row md:items-center gap-6 justify-between">
                            <div className="space-y-2">
                              <h3 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-wider">Metrik Kehadiran Sesi</h3>
                              <p className="text-xs text-slate-450">Tingkat persentase presensi dari total sesi belajar yang dijadwalkan.</p>
                              
                              <div className="grid grid-cols-4 gap-2 pt-2.5 text-center">
                                <div className="bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded-xl border border-emerald-100/30">
                                  <span className="text-emerald-600 dark:text-emerald-400 text-base font-black">{studentAnalytics.attendance.present}</span>
                                  <p className="text-[9px] font-semibold text-slate-450 mt-0.5 uppercase">Hadir</p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-950/20 p-2 rounded-xl border border-amber-100/30">
                                  <span className="text-amber-600 dark:text-amber-400 text-base font-black">{studentAnalytics.attendance.sick}</span>
                                  <p className="text-[9px] font-semibold text-slate-450 mt-0.5 uppercase">Sakit</p>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-950/20 p-2 rounded-xl border border-blue-100/30">
                                  <span className="text-blue-600 dark:text-blue-400 text-base font-black">{studentAnalytics.attendance.permission}</span>
                                  <p className="text-[9px] font-semibold text-slate-450 mt-0.5 uppercase">Izin</p>
                                </div>
                                <div className="bg-rose-50 dark:bg-rose-950/20 p-2 rounded-xl border border-rose-100/30">
                                  <span className="text-rose-600 dark:text-rose-400 text-base font-black">{studentAnalytics.attendance.absent}</span>
                                  <p className="text-[9px] font-semibold text-slate-450 mt-0.5 uppercase">Alfa</p>
                                </div>
                              </div>
                            </div>

                            {/* Big percentage indicator ring */}
                            <div className="flex items-center gap-4 border-l border-slate-100 dark:border-slate-800 pl-6 self-center md:h-24">
                              <div className="relative flex items-center justify-center">
                                {/* SVG Ring */}
                                <svg className="w-20 h-20 transform -rotate-90">
                                  <circle cx="40" cy="40" r="34" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="6" fill="transparent" />
                                  <circle
                                    cx="40"
                                    cy="40"
                                    r="34"
                                    className={`transition-all duration-500 ${
                                      studentAnalytics.attendance.rate >= 85
                                        ? 'stroke-emerald-500'
                                        : studentAnalytics.attendance.rate >= 60
                                        ? 'stroke-amber-500'
                                        : 'stroke-rose-500'
                                    }`}
                                    strokeWidth="6"
                                    fill="transparent"
                                    strokeDasharray={2 * Math.PI * 34}
                                    strokeDashoffset={2 * Math.PI * 34 * (1 - studentAnalytics.attendance.rate / 100)}
                                  />
                                </svg>
                                <span className="absolute text-base font-black text-slate-850 dark:text-white">
                                  {studentAnalytics.attendance.rate}%
                                </span>
                              </div>
                              <div>
                                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Rasio Presensi</span>
                                <p className="text-[10px] text-slate-400 mt-0.5">Sangat Baik ({studentAnalytics.attendance.rate}%)</p>
                              </div>
                            </div>
                          </div>

                          {/* Detailed Attendance List */}
                          <div className="space-y-3">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Riwayat Absensi Lengkap:</span>
                            {selectedStudent.attendances.length === 0 ? (
                              <div className="p-10 text-center text-xs text-slate-400 bg-white dark:bg-[#151f32] rounded-2xl border border-slate-150 dark:border-slate-800/80">
                                Belum ada catatan absensi terdaftar.
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                {selectedStudent.attendances.map((att) => (
                                  <div key={att.id} className="flex items-center justify-between p-3.5 bg-white dark:bg-[#151f32] rounded-xl border border-slate-150 dark:border-slate-800/80 hover:bg-slate-100/30 dark:hover:bg-[#151f32]/80 transition-colors gap-4">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-450 shrink-0">
                                        <Calendar className="h-4 w-4" />
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-slate-850 dark:text-slate-200">
                                          {new Date(att.markedAt).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                        {att.notes && (
                                          <p className="text-[10px] text-slate-500 mt-0.5 italic">Catatan: "{att.notes}"</p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="shrink-0">
                                      {att.status === 'PRESENT' ? (
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-450">Hadir</span>
                                      ) : att.status === 'SICK' ? (
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-450">Sakit</span>
                                      ) : att.status === 'PERMISSION' ? (
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-450">Izin</span>
                                      ) : (
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-450">Alfa</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* TAB 3: ACADEMIC */}
                      {activeAnalyticTab === 'academic' && (
                        <div className="space-y-6">
                          
                          {/* Top stat box */}
                          <div className="bg-white dark:bg-[#151f32] p-5 rounded-2xl border border-slate-150 dark:border-slate-800/80 shadow-xs flex items-center justify-between">
                            <div className="space-y-1">
                              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white uppercase tracking-wider">Perkembangan Akademik</h3>
                              <p className="text-xs text-slate-450">Data laporan berkala yang dikirim oleh tutor pasca sesi bimbingan.</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                                {studentAnalytics.academic.averageScore !== null ? `${studentAnalytics.academic.averageScore}/100` : '-'}
                              </p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Rata-rata Nilai</p>
                            </div>
                          </div>

                          {/* Academic Timeline list */}
                          <div className="space-y-4">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Laporan Hasil Belajar (Timeline):</span>
                            
                            {selectedStudent.reports.length === 0 ? (
                              <div className="p-10 text-center text-xs text-slate-400 bg-white dark:bg-[#151f32] rounded-2xl border border-slate-150 dark:border-slate-800/80">
                                Belum ada laporan perkembangan yang ditulis oleh tutor.
                              </div>
                            ) : (
                              <div className="relative border-l border-slate-200 dark:border-slate-800 ml-3 pl-5 space-y-6">
                                {selectedStudent.reports.map((report) => (
                                  <div key={report.id} className="relative space-y-2">
                                    
                                    {/* Circle dot on timeline */}
                                    <div className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-[#121a2c] bg-indigo-500 z-10" />

                                    {/* Report box item */}
                                    <div className="bg-white dark:bg-[#151f32] p-5 rounded-2xl border border-slate-150 dark:border-slate-800/80 shadow-xs hover:shadow-md transition-shadow">
                                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2 mb-3">
                                        <div>
                                          <p className="text-xs font-black text-slate-850 dark:text-slate-200">{report.schedule.topic || 'Review Materi'}</p>
                                          <p className="text-[9px] text-slate-400 mt-0.5">
                                            {new Date(report.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {report.score !== null && (
                                            <span className={`text-xs font-black px-2 py-0.5 rounded-lg border ${
                                              report.score >= 80
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/10 dark:border-emerald-900/30'
                                                : report.score >= 70
                                                ? 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/10 dark:border-amber-900/30'
                                                : 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/10 dark:border-rose-900/30'
                                            }`}>
                                              Skor: {report.score}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <p className="text-xs text-slate-650 dark:text-slate-350 leading-relaxed font-normal">
                                        {report.content}
                                      </p>

                                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                                        <span>Sistem Mellyna Ed.</span>
                                        <span className="text-indigo-600 dark:text-indigo-450">Tutor: {report.tutor.name}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* TAB 4: FINANCE */}
                      {activeAnalyticTab === 'finance' && (
                        <div className="space-y-6">
                          
                          {/* Financial Header Info */}
                          <div className="bg-white dark:bg-[#151f32] p-5 rounded-2xl border border-slate-150 dark:border-slate-800/80 shadow-xs flex items-center justify-between">
                            <div className="space-y-1">
                              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white uppercase tracking-wider">Administrasi Keuangan Siswa</h3>
                              <p className="text-xs text-slate-450">Daftar histori kuitansi pembayaran SPP bulanan dan administrasi.</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-slate-400">Total Tagihan terbit:</p>
                              <p className="text-lg font-black text-slate-850 dark:text-white mt-0.5">{selectedStudent.invoices.length} Kuitansi</p>
                            </div>
                          </div>

                          {/* Invoice list */}
                          <div className="space-y-3.5">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Histori Transaksi Invoice SPP:</span>
                            
                            {selectedStudent.invoices.length === 0 ? (
                              <div className="p-10 text-center text-xs text-slate-400 bg-white dark:bg-[#151f32] rounded-2xl border border-slate-150 dark:border-slate-800/80">
                                Belum ada tagihan terdaftar untuk siswa ini.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {selectedStudent.invoices.map((inv) => (
                                  <div key={inv.id} className="bg-white dark:bg-[#151f32] p-5 rounded-2xl border border-slate-150 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-850 dark:text-slate-200">{inv.description}</span>
                                        {inv.status === 'PAID' ? (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-450 uppercase">PAID</span>
                                        ) : inv.status === 'PENDING' ? (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-450 uppercase">PENDING</span>
                                        ) : inv.status === 'OVERDUE' ? (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-450 uppercase">OVERDUE</span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-900/20 dark:text-slate-500 uppercase">CANCELLED</span>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-400 font-semibold tracking-wide">
                                        <p className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" /> Jatuh Tempo: {new Date(inv.dueDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'numeric', day: 'numeric' })}
                                        </p>
                                        {inv.paidAt && (
                                          <p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-450">
                                            <Check className="h-3 w-3" /> Lunas pada: {new Date(inv.paidAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'numeric', day: 'numeric' })}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="sm:text-right">
                                      <p className="text-base font-black text-slate-800 dark:text-white">{formatRupiah(inv.amount)}</p>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Nominal Tagihan</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer of Drawer */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-[#0e1423] border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider shrink-0">
                  <span>Portal Akademik Mellyna Education</span>
                  <span>ID Siswa: {selectedStudent.id}</span>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
