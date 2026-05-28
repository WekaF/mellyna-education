import React from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Sidebar from '@/components/dashboard/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

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
    <div className="min-h-screen bg-[#151f32] text-slate-100 font-sans relative overflow-hidden">
      {/* Dynamic subtle glowing background effects */}
      <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none z-0" />

      {/* Dynamic role-based responsive Sidebar */}
      <Sidebar user={user} />

      {/* Main content area with dynamic margins for desktop layout */}
      <div className="md:pl-64 lg:pl-72 flex flex-col min-h-screen transition-all duration-300 relative z-10">
        {/* Top Header bar inside the dashboard */}
        <header className="hidden md:flex items-center justify-between px-8 py-5 border-b border-slate-800/60 bg-[#151f32]/45 backdrop-blur-md sticky top-0 z-30">
          <div>
            <span className="text-xs text-slate-400 font-medium tracking-wider uppercase">Portal Akademik</span>
            <h2 className="text-sm font-semibold text-white">Mellyna Education System</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/40 border border-slate-700/30 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sistem Aktif</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 lg:p-10 w-full mx-auto max-w-7xl">
          <div className="animate-fade-in duration-300">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
