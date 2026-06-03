# Custom Alert & Confirm Dialog System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all 17 native `confirm()` and 11 native `alert()` calls with branded, animated custom components consistent with the app's design system.

**Architecture:** Two context-based hooks — `useConfirm()` returns a promise-based function that shows a modal dialog, and `useToastNotification()` returns toast helpers for success/error/info/warning notifications. Both providers are wrapped in a `DashboardProviders` client component added to the dashboard layout.

**Tech Stack:** Radix UI Dialog (@radix-ui/react-dialog), Radix Toast (@radix-ui/react-toast), Framer Motion (framer-motion), Lucide React icons, Tailwind CSS 4.x, Next.js 15 App Router.

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `components/ui/confirm-dialog.tsx` | ConfirmDialog UI — Radix Dialog + Framer Motion, 3 variants |
| `lib/hooks/use-confirm.tsx` | ConfirmProvider + useConfirm hook (promise-based) |
| `lib/hooks/use-toast-notification.tsx` | ToastProvider + useToastNotification hook |
| `components/dashboard/DashboardProviders.tsx` | Client wrapper combining both providers |

### Modified files
| File | Changes |
|------|---------|
| `app/(dashboard)/layout.tsx` | Wrap children with `<DashboardProviders>` |
| `app/(dashboard)/admin/parents/ParentsClient.tsx` | 3 confirm + 5 alert |
| `app/(dashboard)/admin/billing/BillingClient.tsx` | 3 confirm |
| `app/(dashboard)/admin/classes/ClassesClient.tsx` | 2 confirm |
| `app/(dashboard)/admin/milestones/MilestonesClient.tsx` | 1 confirm + 1 alert |
| `app/(dashboard)/admin/milestones/progress/StudentProgressClient.tsx` | 2 alert |
| `app/(dashboard)/admin/milestones/reports/MilestoneReportsClient.tsx` | 1 confirm + 1 alert |
| `app/(dashboard)/admin/pricing/page.tsx` | 2 confirm |
| `app/(dashboard)/admin/schedules/SchedulesClient.tsx` | 2 alert |
| `app/(dashboard)/admin/students/StudentsClient.tsx` | 1 confirm |
| `app/(dashboard)/admin/timetable/TimetableClient.tsx` | 1 confirm |
| `app/(dashboard)/admin/tutors/TutorsClient.tsx` | 1 confirm |
| `app/(dashboard)/admin/announcements/AnnouncementsClient.tsx` | 1 confirm |
| `app/(dashboard)/tutor/reports/[scheduleId]/page.tsx` | 1 confirm |

---

## Task 1: Create ConfirmDialog Component

**Files:**
- Create: `components/ui/confirm-dialog.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/ui/confirm-dialog.tsx
'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Info, Trash2, X } from 'lucide-react'

export type ConfirmVariant = 'danger' | 'warning' | 'info'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  detail?: string
  variant?: ConfirmVariant
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

const variantConfig = {
  danger: {
    Icon: Trash2,
    iconBg: 'bg-red-100 dark:bg-red-950/40',
    iconColor: 'text-red-600 dark:text-red-400',
    titleColor: 'text-red-700 dark:text-red-300',
    confirmBtn: 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white',
  },
  warning: {
    Icon: AlertTriangle,
    iconBg: 'bg-amber-100 dark:bg-amber-950/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    titleColor: 'text-amber-700 dark:text-amber-300',
    confirmBtn: 'bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white',
  },
  info: {
    Icon: Info,
    iconBg: 'bg-blue-100 dark:bg-blue-950/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    titleColor: 'text-blue-700 dark:text-blue-300',
    confirmBtn: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white',
  },
}

export function ConfirmDialog({
  open,
  title,
  message,
  detail,
  variant = 'info',
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cfg = variantConfig[variant]

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open && (
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </Dialog.Overlay>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {open && (
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700/60 p-6 focus:outline-none"
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <Dialog.Close
                  onClick={onCancel}
                  className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="h-4 w-4" />
                </Dialog.Close>

                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl ${cfg.iconBg}`}>
                    <cfg.Icon className={`h-5 w-5 ${cfg.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <Dialog.Title className={`text-base font-semibold leading-snug ${cfg.titleColor}`}>
                      {title}
                    </Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {message}
                    </Dialog.Description>
                    {detail && (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-500 leading-relaxed bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/40">
                        {detail}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    onClick={onConfirm}
                    className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors cursor-pointer ${cfg.confirmBtn}`}
                  >
                    {confirmLabel}
                  </button>
                </div>
              </motion.div>
            </Dialog.Content>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/confirm-dialog.tsx
git commit -m "feat: add ConfirmDialog component with danger/warning/info variants"
```

---

## Task 2: Create useConfirm Hook + ConfirmProvider

**Files:**
- Create: `lib/hooks/use-confirm.tsx`

- [ ] **Step 1: Create the hook**

```tsx
// lib/hooks/use-confirm.tsx
'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { ConfirmDialog, type ConfirmVariant } from '@/components/ui/confirm-dialog'

export interface ConfirmOptions {
  title: string
  message: string
  detail?: string
  variant?: ConfirmVariant
  confirmLabel?: string
  cancelLabel?: string
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({ title: '', message: '' })
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setOpen(false)
    resolverRef.current?.(true)
    resolverRef.current = null
  }, [])

  const handleCancel = useCallback(() => {
    setOpen(false)
    resolverRef.current?.(false)
    resolverRef.current = null
  }, [])

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        open={open}
        {...options}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx.confirm
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/hooks/use-confirm.tsx
git commit -m "feat: add useConfirm hook with promise-based ConfirmProvider"
```

---

## Task 3: Create useToastNotification Hook + ToastProvider

**Files:**
- Create: `lib/hooks/use-toast-notification.tsx`

- [ ] **Step 1: Create the hook**

```tsx
// lib/hooks/use-toast-notification.tsx
'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import * as Toast from '@radix-ui/react-toast'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: {
    success: (message: string) => void
    error: (message: string) => void
    warning: (message: string) => void
    info: (message: string) => void
  }
}

const ToastContext = createContext<ToastContextValue | null>(null)

const variantConfig = {
  success: {
    Icon: CheckCircle2,
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    textColor: 'text-emerald-800 dark:text-emerald-200',
  },
  error: {
    Icon: XCircle,
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-800/60',
    iconColor: 'text-red-600 dark:text-red-400',
    textColor: 'text-red-800 dark:text-red-200',
  },
  warning: {
    Icon: AlertTriangle,
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800/60',
    iconColor: 'text-amber-600 dark:text-amber-400',
    textColor: 'text-amber-800 dark:text-amber-200',
  },
  info: {
    Icon: Info,
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-800/60',
    iconColor: 'text-blue-600 dark:text-blue-400',
    textColor: 'text-blue-800 dark:text-blue-200',
  },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((message: string, variant: ToastVariant) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, variant }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = {
    success: (message: string) => addToast(message, 'success'),
    error: (message: string) => addToast(message, 'error'),
    warning: (message: string) => addToast(message, 'warning'),
    info: (message: string) => addToast(message, 'info'),
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      <Toast.Provider swipeDirection="right">
        {children}
        <AnimatePresence>
          {toasts.map((t) => {
            const cfg = variantConfig[t.variant]
            return (
              <Toast.Root
                key={t.id}
                open
                duration={4500}
                onOpenChange={(o) => !o && removeToast(t.id)}
                asChild
                forceMount
              >
                <motion.div
                  initial={{ opacity: 0, x: 60, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 60, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border w-full ${cfg.bg} ${cfg.border}`}
                >
                  <cfg.Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${cfg.iconColor}`} />
                  <Toast.Description className={`flex-1 text-sm font-medium leading-relaxed ${cfg.textColor}`}>
                    {t.message}
                  </Toast.Description>
                  <Toast.Close
                    onClick={() => removeToast(t.id)}
                    className={`flex-shrink-0 rounded-md p-0.5 ${cfg.iconColor} hover:opacity-70 transition-opacity cursor-pointer`}
                  >
                    <X className="h-4 w-4" />
                  </Toast.Close>
                </motion.div>
              </Toast.Root>
            )
          })}
        </AnimatePresence>
        <Toast.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 z-[100] w-[380px] max-w-[calc(100vw-2rem)] outline-none" />
      </Toast.Provider>
    </ToastContext.Provider>
  )
}

export function useToastNotification() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToastNotification must be used within ToastProvider')
  return ctx.toast
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/hooks/use-toast-notification.tsx
git commit -m "feat: add useToastNotification hook with success/error/warning/info variants"
```

---

## Task 4: Create DashboardProviders and Update Layout

**Files:**
- Create: `components/dashboard/DashboardProviders.tsx`
- Modify: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create DashboardProviders**

```tsx
// components/dashboard/DashboardProviders.tsx
'use client'

import { ConfirmProvider } from '@/lib/hooks/use-confirm'
import { ToastProvider } from '@/lib/hooks/use-toast-notification'

export function DashboardProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        {children}
      </ConfirmProvider>
    </ToastProvider>
  )
}
```

- [ ] **Step 2: Update dashboard layout**

In `app/(dashboard)/layout.tsx`, add import and wrap `children`:

```tsx
// Add import after existing imports:
import { DashboardProviders } from '@/components/dashboard/DashboardProviders'

// In the JSX return, wrap the entire div with DashboardProviders:
return (
  <DashboardProviders>
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* ... rest of layout unchanged ... */}
    </div>
  </DashboardProviders>
)
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/DashboardProviders.tsx app/(dashboard)/layout.tsx
git commit -m "feat: add DashboardProviders wrapper to dashboard layout"
```

---

## Task 5: Replace in ParentsClient.tsx (3 confirm + 5 alert)

**Files:**
- Modify: `app/(dashboard)/admin/parents/ParentsClient.tsx`

- [ ] **Step 1: Add hook imports at top of component body**

After the existing `useState, useCallback, useMemo` imports are already there. Add hook imports below existing imports (after line 30):

```tsx
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useToastNotification } from '@/lib/hooks/use-toast-notification'
```

- [ ] **Step 2: Add hook calls inside component function**

Find where other hooks are called (near the top of the `ParentsClient` function body, after state declarations). Add:

```tsx
const confirm = useConfirm()
const toast = useToastNotification()
```

- [ ] **Step 3: Replace handleToggleSuspend (line 406)**

Find:
```tsx
if (!confirm(confirmMsg)) return
```

Replace with:
```tsx
const ok = await confirm({
  title: parent.suspended ? 'Aktifkan Akun Wali Murid' : 'Tangguhkan Akun Wali Murid',
  message: confirmMsg,
  variant: parent.suspended ? 'info' : 'warning',
  confirmLabel: parent.suspended ? 'Aktifkan' : 'Tangguhkan',
})
if (!ok) return
```

- [ ] **Step 4: Replace alert in handleToggleSuspend (line 443)**

Find:
```tsx
alert(err.message || 'Gagal mengubah status akun.')
```

Replace with:
```tsx
toast.error(err.message || 'Gagal mengubah status akun.')
```

- [ ] **Step 5: Replace handleDeleteParent confirm (line 450)**

Find:
```tsx
if (!confirm(`Hapus permanen akun wali murid "${parent.name}"?\n\nSeluruh data siswa, tagihan, absensi, dan laporan belajar akan ikut terhapus. Tindakan ini TIDAK BISA DIBATALKAN.`)) return
```

Replace with:
```tsx
const ok = await confirm({
  title: 'Hapus Akun Wali Murid',
  message: `Hapus permanen akun wali murid "${parent.name}"?`,
  detail: 'Seluruh data siswa, tagihan, absensi, dan laporan belajar akan ikut terhapus. Tindakan ini TIDAK BISA DIBATALKAN.',
  variant: 'danger',
  confirmLabel: 'Hapus Permanen',
})
if (!ok) return
```

- [ ] **Step 6: Replace 2 alert calls in handleDeleteParent (lines 455, 461)**

Find:
```tsx
alert(typeof data.error === 'string' ? data.error : 'Gagal menghapus akun.')
```
Replace with:
```tsx
toast.error(typeof data.error === 'string' ? data.error : 'Gagal menghapus akun.')
```

Find:
```tsx
alert('Gagal menghapus akun.')
```
Replace with:
```tsx
toast.error('Gagal menghapus akun.')
```

- [ ] **Step 7: Replace handleDeleteStudent confirm (line 466)**

Find:
```tsx
if (!confirm(`Hapus permanen siswa "${studentName}"?\n\nSeluruh data kehadiran, tagihan, dan laporan belajar akan ikut terhapus. Tindakan ini TIDAK BISA DIBATALKAN.`)) return
```

Replace with:
```tsx
const ok = await confirm({
  title: 'Hapus Data Siswa',
  message: `Hapus permanen siswa "${studentName}"?`,
  detail: 'Seluruh data kehadiran, tagihan, dan laporan belajar akan ikut terhapus. Tindakan ini TIDAK BISA DIBATALKAN.',
  variant: 'danger',
  confirmLabel: 'Hapus Permanen',
})
if (!ok) return
```

- [ ] **Step 8: Replace 2 alert calls in handleDeleteStudent (lines 471, 477)**

Find:
```tsx
alert(typeof data.error === 'string' ? data.error : 'Gagal menghapus siswa.')
```
Replace with:
```tsx
toast.error(typeof data.error === 'string' ? data.error : 'Gagal menghapus siswa.')
```

Find:
```tsx
alert('Gagal menghapus siswa.')
```
Replace with:
```tsx
toast.error('Gagal menghapus siswa.')
```

- [ ] **Step 9: Update useCallback dependency arrays**

Add `confirm` and `toast` to all handlers that use them. E.g.:

```tsx
// handleToggleSuspend: add confirm, toast to deps
}, [togglingId, selectedParent, selectedStudent, confirm, toast])

// handleDeleteParent: add confirm, toast to deps
}, [selectedParent, fetchParents, confirm, toast])

// handleDeleteStudent: add confirm, toast to deps
}, [selectedStudent, fetchParents, confirm, toast])
```

- [ ] **Step 10: Commit**

```bash
git add app/(dashboard)/admin/parents/ParentsClient.tsx
git commit -m "feat: replace native confirm/alert with custom dialog in ParentsClient"
```

---

## Task 6: Replace in BillingClient.tsx (3 confirm)

**Files:**
- Modify: `app/(dashboard)/admin/billing/BillingClient.tsx`

- [ ] **Step 1: Add imports + hook calls**

```tsx
import { useConfirm } from '@/lib/hooks/use-confirm'
// At top of component body:
const confirm = useConfirm()
```

- [ ] **Step 2: Replace line 91 — send WA reminder**

Find:
```tsx
if (!confirm('Kirim pengingat WA ke semua orang tua dengan tagihan PENDING?')) return
```

Replace with:
```tsx
const ok = await confirm({
  title: 'Kirim Pengingat WhatsApp',
  message: 'Kirim pengingat WhatsApp ke semua orang tua dengan tagihan PENDING?',
  variant: 'info',
  confirmLabel: 'Kirim Sekarang',
})
if (!ok) return
```

- [ ] **Step 3: Replace line 210 — cancel invoice**

Find:
```tsx
if (!confirm('Batalkan invoice ini?')) return
```

Replace with:
```tsx
const ok = await confirm({
  title: 'Batalkan Invoice',
  message: 'Batalkan invoice ini? Status akan berubah menjadi DIBATALKAN.',
  variant: 'warning',
  confirmLabel: 'Batalkan Invoice',
})
if (!ok) return
```

- [ ] **Step 4: Replace line 226 — delete invoice**

Find:
```tsx
if (!confirm('Hapus invoice ini permanen? Tindakan tidak bisa dibatalkan.')) return
```

Replace with:
```tsx
const ok = await confirm({
  title: 'Hapus Invoice',
  message: 'Hapus invoice ini secara permanen?',
  detail: 'Tindakan ini tidak bisa dibatalkan.',
  variant: 'danger',
  confirmLabel: 'Hapus Invoice',
})
if (!ok) return
```

- [ ] **Step 5: Add confirm to useCallback deps for all 3 handlers, then commit**

```bash
git add app/(dashboard)/admin/billing/BillingClient.tsx
git commit -m "feat: replace native confirm with custom dialog in BillingClient"
```

---

## Task 7: Replace in ClassesClient.tsx (2 confirm)

**Files:**
- Modify: `app/(dashboard)/admin/classes/ClassesClient.tsx`

- [ ] **Step 1: Add imports + hook call**

```tsx
import { useConfirm } from '@/lib/hooks/use-confirm'
// Top of component:
const confirm = useConfirm()
```

- [ ] **Step 2: Replace line 266 — remove student from class**

Find:
```tsx
if (!confirm('Keluarkan siswa dari kelas ini?')) return
```

Replace with:
```tsx
const ok = await confirm({
  title: 'Keluarkan Siswa',
  message: 'Keluarkan siswa dari kelas ini?',
  variant: 'warning',
  confirmLabel: 'Keluarkan',
})
if (!ok) return
```

- [ ] **Step 3: Replace line 283 — delete class**

Find:
```tsx
if (!confirm(`Hapus kelas "${cls.name}"? Semua data enrollment akan ikut terhapus.`)) return
```

Replace with:
```tsx
const ok = await confirm({
  title: 'Hapus Kelas',
  message: `Hapus kelas "${cls.name}"?`,
  detail: 'Semua data enrollment siswa dalam kelas ini akan ikut terhapus.',
  variant: 'danger',
  confirmLabel: 'Hapus Kelas',
})
if (!ok) return
```

- [ ] **Step 4: Add confirm to useCallback deps, then commit**

```bash
git add app/(dashboard)/admin/classes/ClassesClient.tsx
git commit -m "feat: replace native confirm with custom dialog in ClassesClient"
```

---

## Task 8: Replace in MilestonesClient.tsx (1 confirm + 1 alert)

**Files:**
- Modify: `app/(dashboard)/admin/milestones/MilestonesClient.tsx`

- [ ] **Step 1: Add imports + hook calls**

```tsx
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useToastNotification } from '@/lib/hooks/use-toast-notification'
// Top of component:
const confirm = useConfirm()
const toast = useToastNotification()
```

- [ ] **Step 2: Replace line 98 — delete milestone confirm**

Find:
```tsx
if (!confirm('Hapus milestone ini? Data progress siswa yang terhubung juga akan terhapus.')) return
```

Replace with:
```tsx
const ok = await confirm({
  title: 'Hapus Milestone',
  message: 'Hapus milestone ini?',
  detail: 'Data progress siswa yang terhubung juga akan terhapus.',
  variant: 'danger',
  confirmLabel: 'Hapus Milestone',
})
if (!ok) return
```

- [ ] **Step 3: Replace line 105 — error alert**

Find:
```tsx
alert(e.message)
```

Replace with:
```tsx
toast.error(e.message)
```

- [ ] **Step 4: Add confirm and toast to useCallback deps, then commit**

```bash
git add app/(dashboard)/admin/milestones/MilestonesClient.tsx
git commit -m "feat: replace native confirm/alert with custom dialog in MilestonesClient"
```

---

## Task 9: Replace in StudentProgressClient.tsx (2 alert)

**Files:**
- Modify: `app/(dashboard)/admin/milestones/progress/StudentProgressClient.tsx`

- [ ] **Step 1: Add import + hook call**

```tsx
import { useToastNotification } from '@/lib/hooks/use-toast-notification'
// Top of component:
const toast = useToastNotification()
```

- [ ] **Step 2: Replace line 57 — load error**

Find:
```tsx
alert('Gagal memuat progress siswa')
```

Replace with:
```tsx
toast.error('Gagal memuat progress siswa')
```

- [ ] **Step 3: Replace line 102 — update error**

Find:
```tsx
alert('Gagal memperbarui status milestone')
```

Replace with:
```tsx
toast.error('Gagal memperbarui status milestone')
```

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/admin/milestones/progress/StudentProgressClient.tsx
git commit -m "feat: replace native alert with toast in StudentProgressClient"
```

---

## Task 10: Replace in MilestoneReportsClient.tsx (1 confirm + 1 alert)

**Files:**
- Modify: `app/(dashboard)/admin/milestones/reports/MilestoneReportsClient.tsx`

- [ ] **Step 1: Add imports + hook calls**

```tsx
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useToastNotification } from '@/lib/hooks/use-toast-notification'
// Top of component:
const confirm = useConfirm()
const toast = useToastNotification()
```

- [ ] **Step 2: Replace line 150 — delete report confirm**

Find:
```tsx
if (!confirm('Hapus raport ini?')) return
```

Replace with:
```tsx
const ok = await confirm({
  title: 'Hapus Raport',
  message: 'Hapus raport ini secara permanen?',
  variant: 'danger',
  confirmLabel: 'Hapus Raport',
})
if (!ok) return
```

- [ ] **Step 3: Replace line 156 — error alert**

Find:
```tsx
alert('Gagal menghapus raport')
```

Replace with:
```tsx
toast.error('Gagal menghapus raport')
```

- [ ] **Step 4: Add deps, then commit**

```bash
git add app/(dashboard)/admin/milestones/reports/MilestoneReportsClient.tsx
git commit -m "feat: replace native confirm/alert with custom dialog in MilestoneReportsClient"
```

---

## Task 11: Replace in pricing/page.tsx (2 confirm)

**Files:**
- Modify: `app/(dashboard)/admin/pricing/page.tsx`

- [ ] **Step 1: Add import + hook call**

```tsx
import { useConfirm } from '@/lib/hooks/use-confirm'
// Top of component:
const confirm = useConfirm()
```

- [ ] **Step 2: Replace line 108 — delete package**

Find:
```tsx
if (!confirm(`Hapus paket "${name}"? Tindakan ini tidak dapat dibatalkan.`)) return
```

Replace with:
```tsx
const ok = await confirm({
  title: 'Hapus Paket Harga',
  message: `Hapus paket "${name}"?`,
  detail: 'Tindakan ini tidak dapat dibatalkan.',
  variant: 'danger',
  confirmLabel: 'Hapus Paket',
})
if (!ok) return
```

- [ ] **Step 3: Replace line 182 — reset to defaults**

Find:
```tsx
if (confirm('Apakah Anda yakin ingin mengembalikan semua paket harga ke setelan awal?')) {
```

Replace with:
```tsx
const ok = await confirm({
  title: 'Reset ke Setelan Awal',
  message: 'Kembalikan semua paket harga ke setelan awal?',
  detail: 'Seluruh perubahan harga yang sudah dibuat akan hilang.',
  variant: 'warning',
  confirmLabel: 'Reset Sekarang',
})
if (ok) {
```

(Keep the closing `}` that was there for the original if block)

- [ ] **Step 4: Add deps, then commit**

```bash
git add app/(dashboard)/admin/pricing/page.tsx
git commit -m "feat: replace native confirm with custom dialog in pricing page"
```

---

## Task 12: Replace in SchedulesClient.tsx (2 alert)

**Files:**
- Modify: `app/(dashboard)/admin/schedules/SchedulesClient.tsx`

- [ ] **Step 1: Add import + hook call**

```tsx
import { useToastNotification } from '@/lib/hooks/use-toast-notification'
// Top of component:
const toast = useToastNotification()
```

- [ ] **Step 2: Replace line 88 — success alert**

Find:
```tsx
alert(data.message || 'Jadwal berhasil disinkronkan dan disiarkan via WhatsApp!')
```

Replace with:
```tsx
toast.success(data.message || 'Jadwal berhasil disinkronkan dan disiarkan via WhatsApp!')
```

- [ ] **Step 3: Replace line 168 — success alert for recurring**

Find:
```tsx
if (data.count > 1) alert(`${data.count} jadwal berhasil dibuat (jadwal berulang mingguan).`)
```

Replace with:
```tsx
if (data.count > 1) toast.success(`${data.count} jadwal berhasil dibuat (jadwal berulang mingguan).`)
```

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/admin/schedules/SchedulesClient.tsx
git commit -m "feat: replace native alert with toast in SchedulesClient"
```

---

## Task 13: Replace in StudentsClient.tsx (1 confirm)

**Files:**
- Modify: `app/(dashboard)/admin/students/StudentsClient.tsx`

- [ ] **Step 1: Add import + hook call**

```tsx
import { useConfirm } from '@/lib/hooks/use-confirm'
// Top of component:
const confirm = useConfirm()
```

- [ ] **Step 2: Replace line 83 — delete student**

Find:
```tsx
if (!confirm(`Hapus siswa "${name}"? Tindakan ini tidak dapat dibatalkan.`)) return
```

Replace with:
```tsx
const ok = await confirm({
  title: 'Hapus Siswa',
  message: `Hapus siswa "${name}"?`,
  detail: 'Tindakan ini tidak dapat dibatalkan.',
  variant: 'danger',
  confirmLabel: 'Hapus Siswa',
})
if (!ok) return
```

- [ ] **Step 3: Add deps, then commit**

```bash
git add app/(dashboard)/admin/students/StudentsClient.tsx
git commit -m "feat: replace native confirm with custom dialog in StudentsClient"
```

---

## Task 14: Replace in TimetableClient.tsx (1 confirm)

**Files:**
- Modify: `app/(dashboard)/admin/timetable/TimetableClient.tsx`

- [ ] **Step 1: Add import + hook call**

```tsx
import { useConfirm } from '@/lib/hooks/use-confirm'
// Top of component:
const confirm = useConfirm()
```

- [ ] **Step 2: Replace line 410 — delete class**

Find:
```tsx
if (!confirm(`Apakah Anda yakin ingin menghapus kelas "${selectedClass.name}" secara permanen? Seluruh pendaftaran siswa akan dihapus.`)) return
```

Replace with:
```tsx
const ok = await confirm({
  title: 'Hapus Kelas Permanen',
  message: `Hapus kelas "${selectedClass.name}" secara permanen?`,
  detail: 'Seluruh pendaftaran siswa dalam kelas ini akan ikut dihapus.',
  variant: 'danger',
  confirmLabel: 'Hapus Kelas',
})
if (!ok) return
```

- [ ] **Step 3: Add deps, then commit**

```bash
git add app/(dashboard)/admin/timetable/TimetableClient.tsx
git commit -m "feat: replace native confirm with custom dialog in TimetableClient"
```

---

## Task 15: Replace in TutorsClient.tsx (1 confirm)

**Files:**
- Modify: `app/(dashboard)/admin/tutors/TutorsClient.tsx`

- [ ] **Step 1: Add import + hook call**

```tsx
import { useConfirm } from '@/lib/hooks/use-confirm'
// Top of component:
const confirm = useConfirm()
```

- [ ] **Step 2: Replace line 114 — suspend/activate tutor**

Find:
```tsx
if (!confirm(`${tutor.suspended ? 'Aktifkan kembali' : 'Tangguhkan'} akun tutor "${tutor.name}"?`)) return
```

Replace with:
```tsx
const ok = await confirm({
  title: tutor.suspended ? 'Aktifkan Akun Tutor' : 'Tangguhkan Akun Tutor',
  message: `${tutor.suspended ? 'Aktifkan kembali' : 'Tangguhkan'} akun tutor "${tutor.name}"?`,
  variant: tutor.suspended ? 'info' : 'warning',
  confirmLabel: tutor.suspended ? 'Aktifkan' : 'Tangguhkan',
})
if (!ok) return
```

- [ ] **Step 3: Add deps, then commit**

```bash
git add app/(dashboard)/admin/tutors/TutorsClient.tsx
git commit -m "feat: replace native confirm with custom dialog in TutorsClient"
```

---

## Task 16: Replace in AnnouncementsClient.tsx (1 confirm)

**Files:**
- Modify: `app/(dashboard)/admin/announcements/AnnouncementsClient.tsx`

- [ ] **Step 1: Add import + hook call**

```tsx
import { useConfirm } from '@/lib/hooks/use-confirm'
// Top of component:
const confirm = useConfirm()
```

- [ ] **Step 2: Replace line 73 — delete announcement**

Find:
```tsx
if (!confirm('Hapus pengumuman ini?')) return
```

Replace with:
```tsx
const ok = await confirm({
  title: 'Hapus Pengumuman',
  message: 'Hapus pengumuman ini secara permanen?',
  variant: 'danger',
  confirmLabel: 'Hapus',
})
if (!ok) return
```

- [ ] **Step 3: Add deps, then commit**

```bash
git add app/(dashboard)/admin/announcements/AnnouncementsClient.tsx
git commit -m "feat: replace native confirm with custom dialog in AnnouncementsClient"
```

---

## Task 17: Replace in tutor/reports/[scheduleId]/page.tsx (1 confirm)

**Files:**
- Modify: `app/(dashboard)/tutor/reports/[scheduleId]/page.tsx`

- [ ] **Step 1: Add import + hook call**

```tsx
import { useConfirm } from '@/lib/hooks/use-confirm'
// Top of component:
const confirm = useConfirm()
```

- [ ] **Step 2: Replace line 136 — delete media**

Find:
```tsx
if (!confirm('Hapus media ini?')) return
```

Replace with:
```tsx
const ok = await confirm({
  title: 'Hapus Media',
  message: 'Hapus media ini secara permanen?',
  variant: 'danger',
  confirmLabel: 'Hapus Media',
})
if (!ok) return
```

- [ ] **Step 3: Add deps, then commit**

```bash
git add "app/(dashboard)/tutor/reports/[scheduleId]/page.tsx"
git commit -m "feat: replace native confirm with custom dialog in tutor report page"
```

---

## Task 18: Final Verification

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test ConfirmDialog variants manually**

Navigate to each page and trigger the actions below — verify the custom dialog appears instead of the browser's native popup:

| Page | Action to test |
|------|---------------|
| `/admin/parents` | Click "Hapus" button on any parent → expect **danger** ConfirmDialog |
| `/admin/parents` | Click "Tangguhkan" / "Aktif" toggle → expect **warning/info** ConfirmDialog |
| `/admin/billing` | Click cancel/delete invoice → expect **warning/danger** ConfirmDialog |
| `/admin/classes` | Delete a class → expect **danger** ConfirmDialog |
| `/admin/milestones` | Delete a milestone → expect **danger** ConfirmDialog |
| `/admin/pricing` | Delete a package → expect **danger** ConfirmDialog |
| `/admin/students` | Delete a student → expect **danger** ConfirmDialog |
| `/admin/timetable` | Delete a class → expect **danger** ConfirmDialog |
| `/admin/tutors` | Suspend a tutor → expect **warning** ConfirmDialog |
| `/admin/announcements` | Delete an announcement → expect **danger** ConfirmDialog |

- [ ] **Step 3: Test toast notifications**

| Page | Action to test |
|------|---------------|
| `/admin/schedules` | Sync schedules → expect **success** toast bottom-right |
| Any deletion | Simulate network error → expect **error** toast bottom-right |

- [ ] **Step 4: Test dark mode**

Toggle dark mode via the theme button in the header. Verify ConfirmDialog and toasts render correctly in both light and dark mode.

- [ ] **Step 5: Verify no native browser dialogs remain**

```bash
# Should return empty (no more native confirm/alert calls)
grep -r "if (!confirm\|if (confirm\|^  alert\|^    alert\|^      alert" app/ --include="*.tsx" --include="*.ts"
```

Expected: no matches.
