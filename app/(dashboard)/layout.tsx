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
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Dynamic role-based responsive Sidebar */}
      <Sidebar user={user} />

      {/* Main content grid/layout with dynamic margins for desktop layout */}
      <div className="md:pl-64 lg:pl-72 flex flex-col min-h-screen transition-all duration-300">
        <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl w-full mx-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}
