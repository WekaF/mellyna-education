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
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    type="button"
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
