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
    if (resolverRef.current) return Promise.resolve(false)
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
