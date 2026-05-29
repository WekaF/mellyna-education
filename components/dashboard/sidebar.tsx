'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  CreditCard,
  Megaphone,
  TrendingUp,
  LogOut,
  Menu,
  X,
  Settings,
  FileText,
  BarChart2,
  Tag,
  Grid3x3
} from 'lucide-react'
import { ThemeToggleButton } from '../common/ThemeToggleButton'

interface SidebarProps {
  user: {
    name?: string | null
    email?: string | null
    role: 'SUPER_ADMIN' | 'TUTOR' | 'PARENT'
  }
}

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<any>
}

export default function Sidebar({ user }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  // Dynamic links based on user's role
  const getNavLinks = (): NavItem[] => {
    switch (user.role) {
      case 'SUPER_ADMIN':
        return [
          { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
          { name: 'Siswa', href: '/admin/students', icon: GraduationCap },
          { name: 'Tutor', href: '/admin/tutors', icon: Users },
          { name: 'Kelas', href: '/admin/classes', icon: BookOpen },
          { name: 'Jadwal', href: '/admin/schedules', icon: Calendar },
          { name: 'Timetable', href: '/admin/timetable', icon: Grid3x3 },
          { name: 'Tagihan', href: '/admin/billing', icon: CreditCard },
          { name: 'Pengumuman', href: '/admin/announcements', icon: Megaphone },
          { name: 'Analitik', href: '/admin/analytics', icon: BarChart2 },
          { name: 'Laporan', href: '/admin/reports', icon: FileText },
          { name: 'Paket Harga', href: '/admin/pricing', icon: Tag },
          { name: 'Pengaturan', href: '/admin/settings', icon: Settings },
        ]
      case 'TUTOR':
        return [
          { name: 'Dashboard', href: '/tutor', icon: LayoutDashboard },
        ]
      case 'PARENT':
        return [
          { name: 'Dashboard', href: '/parent', icon: LayoutDashboard },
          { name: 'Perkembangan', href: '/parent/progress', icon: TrendingUp },
          { name: 'Jadwal', href: '/parent/schedule', icon: Calendar },
          { name: 'Tagihan', href: '/parent/billing', icon: CreditCard },
        ]
      default:
        return []
    }
  }

  const links = getNavLinks()

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
      case 'TUTOR':
        return 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
      case 'PARENT':
        return 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white'
      default:
        return 'bg-slate-500 text-white'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Super Admin'
      case 'TUTOR':
        return 'Tutor'
      case 'PARENT':
        return 'Orang Tua'
      default:
        return role
    }
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  const isActiveLink = (href: string) => {
    if (href === '/admin' || href === '/tutor' || href === '/parent') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-white dark:bg-[#111a2e] text-slate-700 dark:text-slate-200 p-6 border-r border-slate-200 dark:border-slate-800/60 shadow-2xl relative overflow-hidden select-none transition-all duration-300">
      {/* Dynamic background glow */}
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none z-0" />

      {/* Brand Header / Company Switcher style */}
      <div className="relative z-10 flex items-center gap-3 pb-6 border-b border-slate-200 dark:border-slate-800/60 mb-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-2xl shadow-lg shadow-blue-500/20 text-white font-bold transform transition-transform hover:rotate-6">
          M
        </div>
        <div>
          <h1 className="font-extrabold text-[15px] leading-tight tracking-wide text-slate-800 dark:text-white uppercase">
            Mellyna Ed.
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold tracking-wider uppercase mt-0.5">Academic System</p>
        </div>
      </div>

      {/* User Session Profile Card */}
      <div className="relative z-10 flex flex-col gap-2 p-4 rounded-xl bg-slate-100/70 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800/40 mb-6 backdrop-blur-xs transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-sm text-blue-600 dark:text-blue-400 uppercase">
            {(user.name || 'U').substring(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate text-slate-900 dark:text-white">
              {user.name || 'User'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {user.email || ''}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800/60 pt-2.5 mt-1">
          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Role</span>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${getRoleBadge(user.role)}`}>
            {getRoleLabel(user.role)}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="relative z-10 flex-1 space-y-1 overflow-y-auto pr-1">
        {links.length > 0 ? (
          links.map((link) => {
            const active = isActiveLink(link.href)
            const Icon = link.icon
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide uppercase transition-all duration-200 cursor-pointer ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-600/20 border-l-4 border-blue-500 text-blue-600 dark:text-white font-bold shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 border-l-4 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/30'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 transition-colors ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-450 group-hover:text-slate-900 dark:group-hover:text-white'}`} />
                <span>{link.name}</span>
              </Link>
            )
          })
        ) : (
          <div className="text-[11px] text-slate-500 text-center py-4 bg-slate-100/50 dark:bg-slate-800/20 rounded-xl border border-slate-200 dark:border-slate-800/40 transition-colors duration-300">
            Tidak ada menu untuk role: <br/>
            <span className="font-bold text-slate-600 dark:text-slate-300 mt-1 inline-block">{user.role || 'UNDEFINED'}</span>
          </div>
        )}
      </nav>

      {/* Footer Sign Out */}
      <div className="relative z-10 pt-4 border-t border-slate-200 dark:border-slate-800/60 mt-auto">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400/80 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 transition-all duration-200 cursor-pointer border border-transparent hover:border-rose-100 dark:hover:border-rose-500/10 active:scale-98"
        >
          <LogOut className="h-4.5 w-4.5" />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Top Header (only visible on mobile screens) */}
      <div className="flex items-center justify-between bg-white dark:bg-[#111a2e] border-b border-slate-200 dark:border-slate-800 px-6 py-4 text-slate-800 dark:text-white md:hidden sticky top-0 z-40 transition-colors duration-300 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-lg shadow-md text-white font-bold">
            M
          </div>
          <span className="font-bold tracking-tight text-sm uppercase">Mellyna Education</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggleButton />
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 md:flex-col md:fixed md:inset-y-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Slide-Out Drawer / Backdrop Overlay */}
      {isOpen && (
        <div className="md:hidden">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40 transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
          />
          {/* Drawer Panel */}
          <aside className="fixed inset-y-0 left-0 w-72 max-w-xs z-50 transform transition-transform duration-300 animate-slide-in">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
