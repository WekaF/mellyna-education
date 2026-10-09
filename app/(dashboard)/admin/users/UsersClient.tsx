'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/common/DataTable'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useToastNotification } from '@/lib/hooks/use-toast-notification'

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TUTOR' | 'PARENT'

interface User {
  id: string
  name: string
  email: string
  phone: string | null
  role: Role
  suspended: boolean
  createdAt: string
}

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  TUTOR: 'Tutor',
  PARENT: 'Wali Murid',
}

const ROLE_BADGE: Record<Role, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-sky-100 text-sky-700',
  TUTOR: 'bg-indigo-100 text-indigo-700',
  PARENT: 'bg-amber-100 text-amber-700',
}

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500'

const errorText = (data: any, fallback: string) => (typeof data?.error === 'string' ? data.error : fallback)

export default function UsersClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: User[]
  currentUserId: string
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const toast = useToastNotification()
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [editUser, setEditUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' })
  const [pwUser, setPwUser] = useState<User | null>(null)
  const [pwForm, setPwForm] = useState({ password: '', confirm: '' })
  const [saving, setSaving] = useState(false)

  // ponytail: refresh server component, tidak perlu state lokal + endpoint list terpisah
  const users = initialUsers
  const refresh = useCallback(() => router.refresh(), [router])

  const filtered = useMemo(
    () => (roleFilter === 'ALL' ? users : users.filter((u) => u.role === roleFilter)),
    [users, roleFilter]
  )

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUser) return
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) throw new Error(errorText(await res.json(), 'Gagal mengubah data user.'))
      toast.success('Data user diperbarui.')
      setEditUser(null)
      refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pwUser) return
    if (pwForm.password !== pwForm.confirm) {
      toast.error('Konfirmasi password tidak sama.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${pwUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwForm.password }),
      })
      if (!res.ok) throw new Error(errorText(await res.json(), 'Gagal mengganti password.'))
      toast.success(`Password ${pwUser.name} berhasil diganti.`)
      setPwUser(null)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleSuspend = useCallback(
    async (user: User) => {
      const ok = await confirm({
        title: user.suspended ? 'Aktifkan Akun' : 'Tangguhkan Akun',
        message: `${user.suspended ? 'Aktifkan kembali' : 'Tangguhkan'} akun "${user.name}" (${ROLE_LABEL[user.role]})?`,
        variant: user.suspended ? 'info' : 'warning',
        confirmLabel: user.suspended ? 'Aktifkan' : 'Tangguhkan',
      })
      if (!ok) return
      setBusyId(user.id)
      try {
        const res = await fetch(`/api/admin/users/${user.id}/suspend`, { method: 'PATCH' })
        if (!res.ok) throw new Error(errorText(await res.json(), 'Gagal mengubah status.'))
        refresh()
      } catch (err: any) {
        toast.error(err.message)
      } finally {
        setBusyId(null)
      }
    },
    [confirm, toast, refresh]
  )

  const handleDelete = useCallback(
    async (user: User) => {
      const ok = await confirm({
        title: 'Hapus Akun',
        message: `Hapus permanen akun "${user.name}" (${ROLE_LABEL[user.role]})?`,
        detail:
          user.role === 'PARENT'
            ? 'Seluruh data siswa, tagihan, absensi, dan laporan belajar akan ikut terhapus. Tindakan ini TIDAK BISA DIBATALKAN.'
            : 'Tindakan ini TIDAK BISA DIBATALKAN. Akun yang masih punya kelas/laporan/pengeluaran tidak bisa dihapus — tangguhkan saja.',
        variant: 'danger',
        confirmLabel: 'Hapus Permanen',
      })
      if (!ok) return
      setBusyId(user.id)
      try {
        const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error(errorText(await res.json(), 'Gagal menghapus akun.'))
        toast.success('Akun dihapus.')
        refresh()
      } catch (err: any) {
        toast.error(err.message)
      } finally {
        setBusyId(null)
      }
    },
    [confirm, toast, refresh]
  )

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Nama',
        cell: ({ row }) => (
          <span className="font-semibold text-slate-800">
            {row.original.name}
            {row.original.id === currentUserId && <span className="ml-2 text-[11px] text-slate-400">(Anda)</span>}
          </span>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => <span className="text-slate-600">{getValue() as string}</span>,
      },
      {
        accessorKey: 'phone',
        header: 'No. HP',
        cell: ({ getValue }) => <span className="text-slate-500">{(getValue() as string | null) || '-'}</span>,
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ getValue }) => {
          const role = getValue() as Role
          return (
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${ROLE_BADGE[role]}`}>
              {ROLE_LABEL[role]}
            </span>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.suspended ? (
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-600">Ditangguhkan</span>
          ) : (
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Aktif</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original
          // Akun SUPER_ADMIN tidak bisa ditangguhkan/dihapus (diblok API juga).
          const protectedAccount = user.role === 'SUPER_ADMIN'
          const btn = 'text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50'
          return (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setEditUser(user)
                  setEditForm({ name: user.name, email: user.email, phone: user.phone || '' })
                }}
                className={`${btn} bg-indigo-50 text-indigo-600 hover:bg-indigo-100`}
              >
                ✏️ Ubah
              </button>
              <button
                onClick={() => {
                  setPwUser(user)
                  setPwForm({ password: '', confirm: '' })
                }}
                className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}
              >
                🔑 Password
              </button>
              {!protectedAccount && (
                <>
                  <button
                    onClick={() => handleToggleSuspend(user)}
                    disabled={busyId === user.id}
                    className={`${btn} ${
                      user.suspended
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    {user.suspended ? '✅ Aktifkan' : '🔒 Tangguhkan'}
                  </button>
                  <button
                    onClick={() => handleDelete(user)}
                    disabled={busyId === user.id}
                    className={`${btn} bg-rose-50 text-rose-600 hover:bg-rose-100`}
                  >
                    🗑️ Hapus
                  </button>
                </>
              )}
            </div>
          )
        },
      },
    ],
    [currentUserId, busyId, handleToggleSuspend, handleDelete]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">🛡️ Manajemen Akun</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola semua akun: ubah data, ganti password, tangguhkan, atau hapus.</p>
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | 'ALL')}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-indigo-500"
        >
          <option value="ALL">Semua Role</option>
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Cari nama atau email..."
          emptyMessage="Tidak ada akun."
          emptyIcon="👤"
        />
      </div>

      {editUser && (
        <Modal title={`✏️ Ubah Data — ${editUser.name}`} onClose={() => setEditUser(null)}>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap *</label>
              <input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
              <input required type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">No. HP (WhatsApp)</label>
              <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className={inputCls} placeholder="mis. 6281234567890" />
            </div>
            <ModalActions saving={saving} onCancel={() => setEditUser(null)} />
          </form>
        </Modal>
      )}

      {pwUser && (
        <Modal title={`🔑 Ganti Password — ${pwUser.name}`} onClose={() => setPwUser(null)}>
          <form onSubmit={handleSavePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Password Baru *</label>
              <input required type="password" minLength={6} value={pwForm.password} onChange={(e) => setPwForm({ ...pwForm, password: e.target.value })} className={inputCls} placeholder="Min. 6 karakter" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Ulangi Password *</label>
              <input required type="password" minLength={6} value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} className={inputCls} />
            </div>
            <ModalActions saving={saving} onCancel={() => setPwUser(null)} />
          </form>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-scaleIn">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50/40">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
      <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
        {saving ? 'Menyimpan...' : 'Simpan'}
      </button>
      <button type="button" onClick={onCancel} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">
        Batal
      </button>
    </div>
  )
}
