# Tambah Paket SPP Bulanan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Superadmin dapat menambahkan paket harga baru pada tab SPP Bulanan di halaman Paket Harga.

**Architecture:** Semua data paket SPP disimpan di localStorage (`mellyna_spp_tiers`). Tambah "Tambah Paket SPP" button di header — hanya muncul di tab SPP. Reuse modal edit yang sudah ada dengan mode `index: -1` untuk mode "tambah baru". Visuals (warna border/icon) di-cycle dari `tierVisuals` array menggunakan modulo agar tidak habis saat paket > 4.

**Tech Stack:** Next.js 14 App Router, React client component, localStorage, Tailwind CSS, Lucide React icons.

---

## File Structure

**Modify only:**
- `app/(dashboard)/admin/pricing/page.tsx` — single file, semua changes di sini

---

### Task 1: Tambah `handleAddNew` function dan update `handleSave` untuk handle `index: -1`

**Files:**
- Modify: `app/(dashboard)/admin/pricing/page.tsx`

**Context:** Saat ini `editingItem` berisi `{ type: 'spp' | 'admin', index: number }`. Index -1 = mode tambah baru. `handleSave` perlu handle kasus ini: append ke array bukannya update index tertentu.

- [ ] **Step 1: Tambah `handleAddNew` function**

Tambahkan function ini setelah `handleEditClick` (sekitar baris 95), sebelum `handleFeatureChange`:

```tsx
const handleAddNew = () => {
  setEditingItem({ type: 'spp', index: -1 })
  setEditName('')
  setEditPrice(0)
  setEditDesc('')
  setEditFeatures([''])
  setEditBadge(null)
}
```

- [ ] **Step 2: Update `handleSave` — pisah logic edit vs tambah baru**

Ganti blok `if (editingItem.type === 'spp')` (baris 115–127) menjadi:

```tsx
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
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/admin/pricing/page.tsx
git commit -m "feat(pricing): add handleAddNew and update handleSave for new SPP tier"
```

---

### Task 2: Tambah tombol "Tambah Paket SPP" di header

**Files:**
- Modify: `app/(dashboard)/admin/pricing/page.tsx`

**Context:** Tombol harus muncul hanya saat `activeTab === 'spp'`, ditempatkan di samping tombol "Atur Ulang Default" di header Action Controls (sekitar baris 180–212).

- [ ] **Step 1: Tambah tombol di Action Controls**

Dalam `<div className="flex items-center gap-3">` (baris 180), tambahkan button setelah tombol Reset dan **sebelum** Tab Switcher div:

```tsx
{activeTab === 'spp' && (
  <button
    onClick={handleAddNew}
    className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/10 hover:shadow-lg hover:shadow-indigo-600/20 transition-all duration-200 active:scale-95 cursor-pointer"
  >
    <Plus className="h-3.5 w-3.5" />
    <span>Tambah Paket SPP</span>
  </button>
)}
```

**Catatan:** Icon `Plus` sudah di-import di baris 4 (`import { Check, Info, BookOpen, Pencil, RotateCcw, X, Plus, Trash2, Save } from 'lucide-react'`). Tidak perlu tambah import baru.

- [ ] **Step 2: Verifikasi visual — jalankan dev server**

```bash
npm run dev
```

Buka `http://localhost:3000/admin/pricing`. Pastikan:
- Tombol "Tambah Paket SPP" muncul di header saat tab SPP aktif
- Tombol hilang saat pindah ke tab "Registrasi & Kenaikan"

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/admin/pricing/page.tsx
git commit -m "feat(pricing): show Tambah Paket SPP button on SPP tab header"
```

---

### Task 3: Update modal title untuk mode tambah vs edit

**Files:**
- Modify: `app/(dashboard)/admin/pricing/page.tsx`

**Context:** Modal header saat ini selalu tampil "✏️ Edit Paket SPP". Saat mode tambah (`index === -1`), harus tampil "➕ Tambah Paket SPP Baru".

- [ ] **Step 1: Update judul modal**

Cari baris modal header (sekitar baris 350–353):

```tsx
<h3 className="font-extrabold text-base text-slate-850 dark:text-white">
  ✏️ Edit {editingItem.type === 'spp' ? 'Paket SPP' : 'Biaya Administrasi'}
</h3>
<p className="text-[10px] text-slate-400 dark:text-slate-450 mt-0.5">Sesuaikan nominal harga dan daftar rincian.</p>
```

Ganti menjadi:

```tsx
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
```

- [ ] **Step 2: Update label tombol submit modal**

Cari tombol submit (sekitar baris 469–475):

```tsx
<button
  type="submit"
  className="flex-1 py-3 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/10 hover:shadow-lg hover:shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
>
  <Save className="h-3.5 w-3.5" />
  <span>Simpan Perubahan</span>
</button>
```

Ganti `<span>` menjadi:

```tsx
<span>{editingItem.index === -1 ? 'Tambah Paket' : 'Simpan Perubahan'}</span>
```

- [ ] **Step 3: Test flow lengkap secara manual**

Dev server harus sudah jalan. Buka `http://localhost:3000/admin/pricing`, lakukan:

1. Klik "Tambah Paket SPP" → modal terbuka dengan judul "➕ Tambah Paket SPP Baru", semua field kosong
2. Isi Nama: "Tingkat 5", Harga: 190000, Deskripsi: "Level eksper", klik "+ Tambah Baris" dan isi 1 fitur
3. Klik "Tambah Paket" → toast "Berhasil menambahkan paket Tingkat 5!" muncul, kartu baru muncul di grid
4. Refresh halaman → paket baru tetap ada (tersimpan di localStorage)
5. Klik "Ubah Data Paket" di kartu baru → modal terbuka dengan judul "✏️ Edit Paket SPP" dan data terisi
6. Klik "Atur Ulang Default" → paket tambahan hilang, kembali ke 4 default

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/admin/pricing/page.tsx
git commit -m "feat(pricing): update modal title and submit button for add vs edit mode"
```

---

## Self-Review

### 1. Spec Coverage
- ✅ Superadmin dapat menambahkan paket harga → "Tambah Paket SPP" button + handleAddNew
- ✅ Di tab SPP Bulanan → button hanya muncul saat `activeTab === 'spp'`
- ✅ Data tersimpan konsisten → localStorage sama seperti edit yang sudah ada
- ✅ Visual cycling → `tierVisuals[sppTiers.length % tierVisuals.length]` untuk tier ke-5 dst.

### 2. Placeholder Scan
- Tidak ada TBD/TODO
- Semua code snippet lengkap
- Exact file path + baris referensi dicantumkan

### 3. Type Consistency
- `editingItem: { type: 'spp' | 'admin', index: number }` — index -1 valid sebagai number ✅
- `newTier` spread dari `tierVisuals[visualIdx]` menghasilkan `{ color, iconColor }` sama seperti existing tiers ✅
- `handleAddNew` set `editingItem.type = 'spp'` → modal title check `editingItem.type === 'spp'` consistent ✅
