'use client'

import { useState, useEffect } from 'react'
import { Check, Info, BookOpen, Pencil, RotateCcw, X, Plus, Trash2, Save } from 'lucide-react'
import { UserPlus, Award } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { defaultSppTiers, defaultAdminFees } from '@/lib/constants/pricing'

const tierVisuals = [
  {
    color: 'border-emerald-200 hover:border-emerald-400 dark:border-emerald-900/40 dark:hover:border-emerald-500/50',
    iconColor: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400',
  },
  {
    color: 'border-indigo-200 hover:border-indigo-400 dark:border-indigo-900/40 dark:hover:border-indigo-500/50',
    iconColor: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400',
  },
  {
    color: 'border-violet-200 hover:border-violet-400 dark:border-violet-900/40 dark:hover:border-violet-500/50',
    iconColor: 'bg-violet-50 text-violet-600 dark:bg-violet-950/20 dark:text-violet-400',
  },
  {
    color: 'border-amber-200 hover:border-amber-400 dark:border-amber-900/40 dark:hover:border-amber-500/50',
    iconColor: 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400',
  },
]

const feeVisuals = [
  {
    icon: UserPlus,
    color: 'border-indigo-200 bg-indigo-50/20 dark:border-indigo-900/40 dark:bg-indigo-950/10',
  },
  {
    icon: Award,
    color: 'border-amber-200 bg-amber-50/20 dark:border-amber-900/40 dark:bg-amber-950/10',
  },
]

const monthlyTiers = defaultSppTiers.map((tier, i) => ({ ...tier, ...tierVisuals[i] }))
const adminFees = defaultAdminFees.map((fee, i) => ({ ...fee, ...feeVisuals[i] }))

export default function AdminPricingPage() {
  const [activeTab, setActiveTab] = useState<'spp' | 'admin'>('spp')
  const [sppTiers, setSppTiers] = useState(monthlyTiers)
  const [fees, setFees] = useState(adminFees)
  const [isMounted, setIsMounted] = useState(false)
  
  // Toast notifications
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<{ type: 'spp' | 'admin'; index: number } | null>(null)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState<number>(0)
  const [editDesc, setEditDesc] = useState('')
  const [editFeatures, setEditFeatures] = useState<string[]>([])
  const [editBadge, setEditBadge] = useState<string | null>(null)

  // Load from localStorage safely
  useEffect(() => {
    setIsMounted(true)
    const savedSpp = localStorage.getItem('mellyna_spp_tiers')
    if (savedSpp) {
      try {
        setSppTiers(JSON.parse(savedSpp))
      } catch (e) {
        console.error('Error parsing SPP tiers:', e)
      }
    }
    const savedFees = localStorage.getItem('mellyna_admin_fees')
    if (savedFees) {
      try {
        setFees(JSON.parse(savedFees))
      } catch (e) {
        console.error('Error parsing admin fees:', e)
      }
    }
  }, [])

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const handleEditClick = (type: 'spp' | 'admin', index: number) => {
    const item = type === 'spp' ? sppTiers[index] : fees[index]
    setEditingItem({ type, index })
    setEditName(item.name)
    setEditPrice(item.price)
    setEditDesc(item.desc || '')
    setEditFeatures([...item.features])
    setEditBadge(type === 'spp' ? (item as any).badge || null : null)
  }

  const handleAddNew = () => {
    setEditingItem({ type: 'spp', index: -1 })
    setEditName('')
    setEditPrice(0)
    setEditDesc('')
    setEditFeatures([''])
    setEditBadge(null)
  }

  const handleDeleteTier = (index: number) => {
    const name = sppTiers[index].name
    if (!confirm(`Hapus paket "${name}"? Tindakan ini tidak dapat dibatalkan.`)) return
    const updated = sppTiers.filter((_, i) => i !== index)
    setSppTiers(updated)
    localStorage.setItem('mellyna_spp_tiers', JSON.stringify(updated))
    triggerToast(`Paket ${name} berhasil dihapus.`)
  }

  const handleFeatureChange = (index: number, value: string) => {
    const updated = [...editFeatures]
    updated[index] = value
    setEditFeatures(updated)
  }

  const handleAddFeature = () => {
    setEditFeatures([...editFeatures, ''])
  }

  const handleRemoveFeature = (index: number) => {
    setEditFeatures(editFeatures.filter((_, i) => i !== index))
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return

    if (editingItem.type === 'spp') {
      if (editingItem.index === -1) {
        const visualIdx = sppTiers.length % tierVisuals.length
        const newTier = {
          name: editName,
          price: Number(editPrice) || 0,
          period: '/bulan',
          desc: editDesc,
          features: editFeatures.filter(f => f.trim() !== ''),
          badge: editBadge,
          ...tierVisuals[visualIdx],
        }
        const updated = [...sppTiers, newTier]
        setSppTiers(updated)
        localStorage.setItem('mellyna_spp_tiers', JSON.stringify(updated))
        triggerToast(`Berhasil menambahkan paket ${editName}!`)
      } else {
        const updated = [...sppTiers]
        updated[editingItem.index] = {
          ...updated[editingItem.index],
          name: editName,
          price: Number(editPrice) || 0,
          desc: editDesc,
          features: editFeatures.filter(f => f.trim() !== ''),
          badge: editBadge,
        }
        setSppTiers(updated)
        localStorage.setItem('mellyna_spp_tiers', JSON.stringify(updated))
        triggerToast(`Berhasil memperbarui paket ${editName}!`)
      }
      setEditingItem(null)
    } else {
      const updated = [...fees]
      updated[editingItem.index] = {
        ...updated[editingItem.index],
        name: editName,
        price: Number(editPrice) || 0,
        desc: editDesc,
        features: editFeatures.filter(f => f.trim() !== ''),
      }
      setFees(updated)
      localStorage.setItem('mellyna_admin_fees', JSON.stringify(updated))
      triggerToast(`Berhasil memperbarui biaya ${editName}!`)
    }

    setEditingItem(null)
  }

  const handleResetDefaults = () => {
    if (confirm('Apakah Anda yakin ingin mengembalikan semua paket harga ke setelan awal?')) {
      setSppTiers(monthlyTiers)
      setFees(adminFees)
      localStorage.removeItem('mellyna_spp_tiers')
      localStorage.removeItem('mellyna_admin_fees')
      triggerToast('Sistem harga berhasil diatur ulang ke bawaan.')
    }
  }

  if (!isMounted) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-8 select-none relative">
      {/* Dynamic Background Accents */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2.5">
            <span>💰</span> Sistem Paket Harga & Administrasi
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Daftar harga resmi SPP bulanan, biaya pendaftaran, dan kenaikan tingkat Mellyna Education yang sepenuhnya dapat dikelola langsung.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 hover:border-rose-200 dark:hover:border-rose-900/50 rounded-xl transition-all duration-200 shadow-xs hover:bg-rose-50/10 active:scale-95 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Atur Ulang Default</span>
          </button>

          {activeTab === 'spp' && (
            <button
              onClick={handleAddNew}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/10 hover:shadow-lg hover:shadow-indigo-600/20 transition-all duration-200 active:scale-95 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Paket SPP</span>
            </button>
          )}

          {/* Tab Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/50">
            <button
              onClick={() => setActiveTab('spp')}
              className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all duration-200 ${
                activeTab === 'spp'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              💳 SPP Bulanan
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all duration-200 ${
                activeTab === 'admin'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              📋 Registrasi & Kenaikan
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      {activeTab === 'spp' ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {sppTiers.map((tier, index) => (
            <div
              key={tier.name}
              className={`rounded-3xl bg-white dark:bg-[#111a2e] border-2 ${tier.color} p-6 flex flex-col justify-between space-y-5 relative shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
            >
              {tier.badge && (
                <div
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-extrabold tracking-wider uppercase px-3 py-1 rounded-full ${
                    tier.badge === 'Terpopuler'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'
                      : 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white'
                  } shadow-md`}
                >
                  {tier.badge}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h2 className="font-extrabold text-base text-slate-800 dark:text-white">{tier.name}</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-450 mt-1 min-h-[32px]">{tier.desc}</p>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{formatRupiah(tier.price)}</span>
                  <span className="text-xs font-bold text-slate-400">{tier.period}</span>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">Fasilitas Paket:</h4>
                  <ul className="space-y-2">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-slate-650 dark:text-slate-350">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Edit & Delete Triggers */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleEditClick('spp', index)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 dark:border-slate-800 dark:hover:border-indigo-500/30 text-slate-600 dark:text-slate-300 font-bold hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10 hover:text-indigo-650 dark:hover:text-indigo-400 transition-all duration-200 text-xs cursor-pointer active:scale-95 shadow-xs"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Ubah</span>
                </button>
                <button
                  onClick={() => handleDeleteTier(index)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 hover:border-rose-300 dark:border-slate-800 dark:hover:border-rose-500/30 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50/30 dark:hover:bg-rose-950/10 transition-all duration-200 text-xs cursor-pointer active:scale-95 shadow-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {fees.map((fee, index) => {
            const Icon = (fee as any).icon || BookOpen
            return (
              <div
                key={fee.name}
                className={`rounded-3xl border-2 ${fee.color} bg-white dark:bg-[#111a2e] p-8 flex flex-col justify-between space-y-6 relative shadow-xs hover:shadow-lg transition-all duration-300`}
              >
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="font-extrabold text-lg text-slate-800 dark:text-white">{fee.name}</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{fee.desc}</p>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1.5 border-b border-slate-100 dark:border-slate-800/80 pb-5">
                    <span className="text-3xl font-black text-slate-900 dark:text-white">{formatRupiah(fee.price)}</span>
                    <span className="text-xs font-bold text-slate-450">/ {fee.period}</span>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">Rincian Komponen Biaya:</h4>
                    <ul className="space-y-2.5">
                      {fee.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-slate-650 dark:text-slate-350">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className={f.includes('TERMASUK') ? 'font-bold text-slate-800 dark:text-slate-200' : ''}>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Edit Trigger */}
                <button
                  onClick={() => handleEditClick('admin', index)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 hover:border-indigo-300 dark:border-slate-800 dark:hover:border-indigo-500/30 text-slate-600 dark:text-slate-300 font-bold hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10 hover:text-indigo-650 dark:hover:text-indigo-400 transition-all duration-200 text-xs cursor-pointer active:scale-95 shadow-xs"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Ubah Rincian & Biaya</span>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Info Alert Section */}
      <div className="rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/15 border border-indigo-100 dark:border-indigo-900/30 p-5 flex gap-3 text-xs text-indigo-700 dark:text-indigo-300 transition-colors duration-300">
        <Info className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-sm">📝 Catatan Sinkronisasi Sistem</p>
          <p className="leading-relaxed">
            Perubahan nominal paket di atas akan langsung tersimpan di penyimpanan web lokal (*local storage*) untuk demo visual yang mulus. Halaman pembuatan invoice, rincian pembayaran, serta parent portal akan menampilkan penyesuaian nominal terbaru secara konsisten.
          </p>
        </div>
      </div>

      {/* Floating success toast */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-emerald-600 text-white shadow-xl animate-fade-in font-bold text-xs">
          <Check className="h-4 w-4 bg-white/20 p-0.5 rounded-full" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Edit Drawer / Modal Backdrop */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          {/* Modal Container */}
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden transform transition-all flex flex-col max-h-[90vh] animate-slide-in">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h3 className="font-extrabold text-base text-slate-850 dark:text-white">
                  {editingItem.index === -1
                    ? '➕ Tambah Paket SPP Baru'
                    : `✏️ Edit ${editingItem.type === 'spp' ? 'Paket SPP' : 'Biaya Administrasi'}`}
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-450 mt-0.5">
                  {editingItem.index === -1
                    ? 'Isi detail paket SPP bulanan baru.'
                    : 'Sesuaikan nominal harga dan daftar rincian.'}
                </p>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-550 dark:text-slate-400 uppercase tracking-wider">Nama Paket / Biaya</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:border-indigo-500 dark:bg-slate-800 dark:text-white transition-colors font-bold"
                />
              </div>

              {/* Price & Badge */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-550 dark:text-slate-400 uppercase tracking-wider">Nominal Harga (Rp)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:border-indigo-500 dark:bg-slate-800 dark:text-white transition-colors font-bold"
                  />
                </div>

                {editingItem.type === 'spp' && (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-550 dark:text-slate-400 uppercase tracking-wider">Badge Info (Opsional)</label>
                    <select
                      value={editBadge || ''}
                      onChange={(e) => setEditBadge(e.target.value ? e.target.value : null)}
                      className="w-full px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:border-indigo-500 dark:bg-slate-800 dark:text-white transition-colors font-bold"
                    >
                      <option value="">Tidak Ada Badge</option>
                      <option value="Terpopuler">Terpopuler</option>
                      <option value="Termaju">Termaju</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-550 dark:text-slate-400 uppercase tracking-wider">Deskripsi Singkat</label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:border-indigo-500 dark:bg-slate-800 dark:text-white transition-colors leading-relaxed"
                />
              </div>

              {/* Features List */}
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-4">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-extrabold text-slate-550 dark:text-slate-400 uppercase tracking-wider">Komponen Rincian / Fasilitas</label>
                  <button
                    type="button"
                    onClick={handleAddFeature}
                    className="flex items-center gap-1 text-[10px] font-black text-indigo-650 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Tambah Baris</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {editFeatures.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={feature}
                        onChange={(e) => handleFeatureChange(fIdx, e.target.value)}
                        placeholder="Contoh: Buku modul bimbingan awal lengkap"
                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:border-indigo-500 dark:bg-slate-800 dark:text-white transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(fIdx)}
                        className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {editFeatures.length === 0 && (
                    <p className="text-[11px] text-slate-400 text-center py-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200/50 dark:border-slate-800/40">
                      Belum ada rincian yang ditambahkan.
                    </p>
                  )}
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center gap-3 border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-3 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/10 hover:shadow-lg hover:shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{editingItem.index === -1 ? 'Tambah Paket' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
