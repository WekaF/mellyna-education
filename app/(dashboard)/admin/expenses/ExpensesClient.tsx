'use client'

import { useState, useCallback } from 'react'
import CreatableSelect from 'react-select/creatable'
import { StylesConfig } from 'react-select'
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useToastNotification } from '@/lib/hooks/use-toast-notification'
import { formatRupiah } from '@/lib/utils'

type Category = { id: string; name: string }
type Expense = {
  id: string
  date: string
  amount: number
  description: string
  category: Category
}
type CategoryOption = { value: string; label: string; isNew?: boolean }

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)
const MONTHS = [
  { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' }, { value: '4', label: 'April' },
  { value: '5', label: 'Mei' }, { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' }, { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' }, { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
]

const emptyForm = { date: new Date().toISOString().slice(0, 10), amount: 0, description: '' }

const categorySelectStyles: StylesConfig<CategoryOption, false> = {
  control: (base, state) => ({
    ...base,
    borderRadius: '0.75rem',
    borderColor: state.isFocused ? '#f43f5e' : '#e2e8f0',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(244, 63, 94, 0.1)' : 'none',
    '&:hover': { borderColor: '#f43f5e' },
    fontSize: '0.875rem',
    minHeight: '42px',
    backgroundColor: 'white',
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '0.75rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
    zIndex: 50,
    overflow: 'hidden',
  }),
  menuList: (base) => ({ ...base, padding: '4px' }),
  option: (base, state) => ({
    ...base,
    borderRadius: '0.5rem',
    backgroundColor: state.isSelected ? '#e11d48' : state.isFocused ? '#fff1f2' : 'white',
    color: state.isSelected ? 'white' : '#1e293b',
    fontSize: '0.875rem',
    cursor: 'pointer',
    padding: '8px 12px',
  }),
  singleValue: (base) => ({ ...base, color: '#1e293b', fontSize: '0.875rem' }),
  placeholder: (base) => ({ ...base, color: '#94a3b8', fontSize: '0.875rem' }),
  noOptionsMessage: (base) => ({ ...base, fontSize: '0.875rem', color: '#94a3b8' }),
}

export default function ExpensesClient({
  initialExpenses,
  initialCategories,
  defaultMonth,
  defaultYear,
}: {
  initialExpenses: Expense[]
  initialCategories: Category[]
  defaultMonth: string
  defaultYear: string
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const toast = useToastNotification()
  const [month, setMonth] = useState(defaultMonth)
  const [year, setYear] = useState(defaultYear)
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Expense | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedCategory, setSelectedCategory] = useState<CategoryOption | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const categoryOptions: CategoryOption[] = categories.map((c) => ({ value: c.id, label: c.name }))

  const fetchExpenses = useCallback(async (m: string, y: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/expenses?month=${m}&year=${y}`)
      if (!res.ok) throw new Error('Gagal memuat data pengeluaran')
      setExpenses(await res.json())
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  const handleFilterChange = (m: string, y: string) => {
    setMonth(m)
    setYear(y)
    fetchExpenses(m, y)
  }

  const openCreate = () => {
    setEditTarget(null)
    setForm(emptyForm)
    setSelectedCategory(null)
    setError('')
    setShowForm(true)
  }

  const openEdit = (e: Expense) => {
    setEditTarget(e)
    setForm({ date: e.date.slice(0, 10), amount: e.amount, description: e.description })
    setSelectedCategory({ value: e.category.id, label: e.category.name })
    setError('')
    setShowForm(true)
  }

  const handleSubmit = useCallback(async () => {
    if (!form.description.trim()) { setError('Deskripsi wajib diisi'); return }
    if (form.amount <= 0) { setError('Jumlah harus lebih dari 0'); return }
    if (!selectedCategory) { setError('Kategori wajib dipilih'); return }

    setLoading(true)
    setError('')
    const categoryField = selectedCategory.isNew
      ? { categoryName: selectedCategory.label }
      : { categoryId: selectedCategory.value }
    const payload = { date: form.date, amount: form.amount, description: form.description, ...categoryField }

    // an expense only belongs on the current page if it falls in the selected month/year filter
    const inSelectedPeriod = (dateStr: string) => {
      const d = new Date(dateStr)
      return d.getMonth() + 1 === Number(month) && d.getFullYear() === Number(year)
    }
    const byDateDesc = (a: Expense, b: Expense) => new Date(b.date).getTime() - new Date(a.date).getTime()

    try {
      let saved: Expense
      if (editTarget) {
        const res = await fetch(`/api/expenses/${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Gagal memperbarui pengeluaran')
        saved = await res.json()
        setExpenses((prev) => {
          const withoutOld = prev.filter((e) => e.id !== saved.id)
          return inSelectedPeriod(saved.date) ? [...withoutOld, saved].sort(byDateDesc) : withoutOld
        })
      } else {
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Gagal mencatat pengeluaran')
        saved = await res.json()
        setExpenses((prev) => (inSelectedPeriod(saved.date) ? [...prev, saved].sort(byDateDesc) : prev))
      }
      if (selectedCategory.isNew) {
        setCategories((prev) =>
          prev.some((c) => c.id === saved.category.id)
            ? prev
            : [...prev, saved.category].sort((a, b) => a.name.localeCompare(b.name))
        )
      }
      setShowForm(false)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [form, selectedCategory, editTarget, month, year, router])

  const handleDelete = useCallback(async (id: string) => {
    const ok = await confirm({
      title: 'Hapus Pengeluaran',
      message: 'Hapus catatan pengeluaran ini?',
      variant: 'danger',
      confirmLabel: 'Hapus',
    })
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus pengeluaran')
      setExpenses((prev) => prev.filter((e) => e.id !== id))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [confirm, toast])

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-rose-600 to-orange-600 p-5 sm:p-8 text-white shadow-xl shadow-rose-600/10">
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">Pencatatan Pengeluaran</h1>
        <p className="mt-2 text-sm sm:text-base text-rose-100">
          Catat pengeluaran operasional untuk menghitung total bersih pendapatan.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
        <div className="flex gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Bulan</label>
            <select
              value={month}
              onChange={(e) => handleFilterChange(e.target.value, year)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 min-w-[130px]"
            >
              {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tahun</label>
            <select
              value={year}
              onChange={(e) => handleFilterChange(month, e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 min-w-[90px]"
            >
              {YEARS.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors"
        >
          <Plus className="h-4 w-4" />
          Tambah Pengeluaran
        </button>
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-orange-600 text-white">
              <Wallet className="h-4 w-4" />
            </div>
            <h2 className="font-bold text-slate-800 dark:text-white">
              {expenses.length} Pengeluaran — Total {formatRupiah(total)}
            </h2>
          </div>
        </div>

        {expenses.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <p className="text-3xl">💸</p>
            <p className="mt-2 text-sm">Belum ada pengeluaran pada periode ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-start justify-between px-6 py-4 gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">{e.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(e.date).toLocaleDateString('id-ID')} · {e.category.name}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-rose-600 text-sm">{formatRupiah(e.amount)}</span>
                  <button
                    onClick={() => openEdit(e)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 border border-rose-100 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="font-extrabold text-slate-800 dark:text-white">
              {editTarget ? 'Edit Pengeluaran' : 'Tambah Pengeluaran Baru'}
            </h3>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-600">{error}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tanggal *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kategori *</label>
                <CreatableSelect<CategoryOption>
                  className="mt-1.5"
                  styles={categorySelectStyles}
                  value={selectedCategory}
                  onChange={(opt) => setSelectedCategory(opt)}
                  options={categoryOptions}
                  placeholder="Pilih atau ketik kategori baru..."
                  formatCreateLabel={(input) => `Tambah kategori "${input}"`}
                  getNewOptionData={(inputValue, label) => ({ value: inputValue, label: label as string, isNew: true })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Jumlah (Rp) *</label>
                <input
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: parseInt(e.target.value) || 0 })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deskripsi *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="contoh: Bayar listrik bulan Agustus"
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : editTarget ? 'Simpan Perubahan' : 'Tambah Pengeluaran'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
