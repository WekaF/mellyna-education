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
