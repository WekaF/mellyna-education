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
  X 
} from 'lucide-react'

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
          { name: 'Tagihan', href: '/admin/billing', icon: CreditCard },
          { name: 'Pengumuman', href: '/admin/announcements', icon: Megaphone },
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
    signOut({ callbackUrl: '/login' })
  }

  const isActiveLink = (href: string) => {
    if (href === '/admin' || href === '/tutor' || href === '/parent') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100 p-6 border-r border-slate-800 shadow-xl">
      {/* Brand Header */}
      <div className="flex items-center gap-3 pb-6 border-b border-slate-800 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-xl shadow-md shadow-indigo-600/20">
          🎓
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight tracking-tight text-white">
            Mellyna Education
          </h1>
          <p className="text-xs text-slate-400 font-medium">Bimbel Anak Terpercaya</p>
        </div>
      </div>

      {/* User Session Profile Card */}
      <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-slate-800/40 border border-slate-800/50 mb-6">
        <div className="text-sm font-semibold truncate text-white">
          {user.name || 'User'}
        </div>
        <div className="text-xs text-slate-400 truncate mb-1">
          {user.email || ''}
        </div>
        <span className={`inline-block self-start text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${getRoleBadge(user.role)}`}>
          {getRoleLabel(user.role)}
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {links.length > 0 ? (
          links.map((link) => {
            const active = isActiveLink(link.href)
            const Icon = link.icon
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 transition-colors ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                <span>{link.name}</span>
              </Link>
            )
          })
        ) : (
          <div className="text-xs text-slate-500 text-center py-4 bg-slate-800/40 rounded-xl border border-slate-800/50">
            Tidak ada menu untuk role: <br/>
            <span className="font-bold text-slate-300 mt-1 inline-block">{user.role || 'UNDEFINED'}</span>
          </div>
        )}
      </nav>

      {/* Footer Sign Out */}
      <div className="pt-6 border-t border-slate-800 mt-auto">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all duration-200 cursor-pointer border border-transparent hover:border-rose-500/20 active:scale-98"
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
      <div className="flex items-center justify-between bg-slate-900 border-b border-slate-800 px-6 py-4 text-white md:hidden sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <span className="text-xl">🎓</span>
          <span className="font-bold tracking-tight">Mellyna Education</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
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
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 transition-opacity"
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
