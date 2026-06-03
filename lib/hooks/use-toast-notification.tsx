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
