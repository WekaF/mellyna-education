'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('pwa-prompt-dismissed') === '1'
  )
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const installedHandler = () => setIsInstalled(true)

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleDismiss = () => {
    localStorage.setItem('pwa-prompt-dismissed', '1')
    setIsDismissed(true)
  }

  const handleInstall = async () => {
    if (!deferredPrompt || installing) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
    } finally {
      setInstalling(false)
    }
  }

  if (isInstalled || isDismissed || !deferredPrompt) return null

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 right-4 z-50 rounded-xl bg-indigo-600 p-4 shadow-lg md:left-auto md:right-4 md:w-80"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Install Mellyna Education</p>
          <p className="mt-0.5 text-xs text-indigo-200">
            Pasang aplikasi untuk akses lebih cepat tanpa buka browser.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-indigo-300 hover:text-white"
          aria-label="Tutup"
        >
          ✕
        </button>
      </div>
      <button
        type="button"
        onClick={handleInstall}
        disabled={installing}
        className="mt-3 w-full rounded-lg bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
      >
        {installing ? 'Menginstall...' : 'Install Aplikasi'}
      </button>
    </div>
  )
}
