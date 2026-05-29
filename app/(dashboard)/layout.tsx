import React from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import Sidebar from '@/components/dashboard/sidebar'
import { ThemeToggleButton } from '@/components/common/ThemeToggleButton'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  // Route protection - if no active session, redirect to login page
  if (!session || !session.user) {
    redirect('/login')
  }

  // Cast user role
  const user = {
    name: session.user.name,
    email: session.user.email,
    role: (session.user as any).role as 'SUPER_ADMIN' | 'TUTOR' | 'PARENT',
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Decorative blobs — fixed overlay so they never break position:fixed on modals */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-500/5 blur-[120px]" />
      </div>

      {/* Dynamic role-based responsive Sidebar */}
      <Sidebar user={user} />

      {/* Main content area with dynamic margins for desktop layout */}
      <div className="md:pl-64 lg:pl-72 flex flex-col min-h-screen transition-all duration-300">
        {/* Top Header bar inside the dashboard */}
        <header className="hidden md:flex items-center justify-between px-8 py-5 border-b border-slate-200 dark:border-slate-800/60 bg-white/45 dark:bg-[#151f32]/45 backdrop-blur-md sticky top-0 z-30 transition-all duration-300">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wider uppercase">Portal Akademik</span>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Mellyna Education System</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/30 text-xs text-slate-600 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sistem Aktif</span>
            </div>
            <ThemeToggleButton />
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 lg:p-10 w-full mx-auto max-w-7xl">
          {children}
        </main>
      </div>
    </div>
  )
}
