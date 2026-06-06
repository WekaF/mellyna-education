'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
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
  BarChart3,
  Tag,
  Grid3x3,
  UsersRound,
  ChevronDown,
  Trophy,
  BookMarked,
  Scroll,
  UserCheck,
} from 'lucide-react'
import { ThemeToggleButton } from '../common/ThemeToggleButton'

interface SidebarProps {
  user: {
    name?: string | null
    email?: string | null
    role: 'SUPER_ADMIN' | 'TUTOR' | 'PARENT'
  }
}

interface SubItem {
  name: string
  href: string
  icon: React.ComponentType<any>
}

interface NavItem {
  name: string
  href?: string
  icon: React.ComponentType<any>
  subItems?: SubItem[]
}

export default function Sidebar({ user }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({})
  const pathname = usePathname()

  // Dynamic links based on user's role
  const getNavLinks = (): NavItem[] => {
    switch (user.role) {
      case 'SUPER_ADMIN':
        return [
          {
            name: 'Dashboard',
            icon: LayoutDashboard,
            subItems: [
              { name: 'Dashboard Utama', href: '/admin', icon: LayoutDashboard },
              { name: 'Analitik', href: '/admin/analytics', icon: BarChart2 },
              { name: 'Monitoring Tutor', href: '/admin/tutor-monitoring', icon: UserCheck },
            ],
          },
          {
            name: 'User',
            icon: Users,
            subItems: [
              { name: 'Siswa', href: '/admin/students', icon: GraduationCap },
              { name: 'Tutor', href: '/admin/tutors', icon: Users },
              { name: 'Wali Murid / Parent', href: '/admin/parents', icon: UsersRound },
            ],
          },
          {
            name: 'Schedule',
            icon: Calendar,
            subItems: [
              { name: 'Kelas', href: '/admin/classes', icon: BookOpen },
              { name: 'Jadwal', href: '/admin/schedules', icon: Calendar },
              { name: 'Timetable', href: '/admin/timetable', icon: Grid3x3 },
            ],
          },
          {
            name: 'Billing',
            icon: CreditCard,
            subItems: [
              { name: 'Tagihan', href: '/admin/billing', icon: CreditCard },
              { name: 'Laporan Keuangan', href: '/admin/financial-report', icon: BarChart3 },
              { name: 'Paket Harga', href: '/admin/pricing', icon: Tag },
            ],
          },
          { name: 'Laporan', href: '/admin/reports', icon: FileText },
          {
            name: 'Kurikulum',
            icon: Trophy,
            subItems: [
              { name: 'Master Program', href: '/admin/programs', icon: BookOpen },
              { name: 'Milestone', href: '/admin/milestones', icon: BookMarked },
              { name: 'Progress Siswa', href: '/admin/milestones/progress', icon: TrendingUp },
              { name: 'Raport', href: '/admin/milestones/reports', icon: Scroll },
            ],
          },
          { name: 'Pengumuman', href: '/admin/announcements', icon: Megaphone },
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
          { name: 'Milestone Belajar', href: '/parent/milestones', icon: Trophy },
          { name: 'Raport Milestone', href: '/parent/milestone-reports', icon: Scroll },
          { name: 'Riwayat Belajar', href: '/parent/history', icon: BookOpen },
          { name: 'Jadwal', href: '/parent/schedule', icon: Calendar },
          { name: 'Tagihan', href: '/parent/billing', icon: CreditCard },
          { name: 'Profil Saya', href: '/parent/profile', icon: Settings },
        ]
      default:
        return []
    }
  }

  const links = getNavLinks()

  const toggleMenu = (name: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [name]: !prev[name],
    }))
  }

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

  const isGroupActive = (subItems?: SubItem[]) => {
    if (!subItems) return false
    return subItems.some((subItem) => isActiveLink(subItem.href))
  }

  // Auto-expand parent menu when pathname matches a child menu on load
  React.useEffect(() => {
    const activeMenu = links.find((link) =>
      link.subItems?.some((sub) => isActiveLink(sub.href))
    )
    if (activeMenu) {
      setOpenMenus({ [activeMenu.name]: true })
    } else {
      setOpenMenus({})
    }
  }, [pathname])

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-white dark:bg-[#111a2e] text-slate-700 dark:text-slate-200 p-6 border-r border-slate-200 dark:border-slate-800/60 shadow-2xl relative overflow-hidden select-none transition-all duration-300">
      {/* Dynamic background glow */}
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none z-0" />

      {/* Brand Header / Company Switcher style */}
      <div className="relative z-10 flex items-center gap-3 pb-6 border-b border-slate-200 dark:border-slate-800/60 mb-6">
        <Image
          src="/icons/mellyna-icon-192.svg"
          alt="Mellyna"
          width={44}
          height={44}
          className="h-11 w-11 rounded-xl"
        />
        <div>
          <h1 className="font-heading font-bold text-[15px] leading-tight tracking-wide text-me-primary-dark dark:text-white uppercase">
            Mellyna Ed.
          </h1>
          <p className="text-[10px] text-me-muted dark:text-slate-400 font-semibold tracking-wider uppercase mt-0.5">Academic System</p>
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
            if (link.subItems) {
              const isExpanded = !!openMenus[link.name]
              const groupActive = isGroupActive(link.subItems)
              const Icon = link.icon
              return (
                <div key={link.name} className="space-y-1">
                  <button
                    onClick={() => toggleMenu(link.name)}
                    className={`group flex w-full items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide uppercase transition-all duration-200 cursor-pointer text-left border-l-4 ${
                      groupActive
                        ? 'bg-[#EEF4FF]/40 dark:bg-[#1A56DB]/5 border-[#1A56DB] text-me-primary dark:text-[#5B8AF5] font-bold'
                        : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <Icon className={`h-4.5 w-4.5 transition-colors ${groupActive ? 'text-me-primary dark:text-[#5B8AF5]' : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'}`} />
                    <span>{link.name}</span>
                    <ChevronDown className={`ml-auto h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out pl-4 space-y-1 ${
                      isExpanded ? 'max-h-60 opacity-100 py-1' : 'max-h-0 opacity-0'
                    }`}
                  >
                    {link.subItems.map((subItem) => {
                      const subActive = isActiveLink(subItem.href)
                      const SubIcon = subItem.icon
                      return (
                        <Link
                          key={subItem.name}
                          href={subItem.href}
                          onClick={() => setIsOpen(false)}
                          className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl text-[11px] font-semibold tracking-wide uppercase transition-all duration-200 cursor-pointer ${
                            subActive
                              ? 'bg-me-surface dark:bg-[#1A56DB]/15 text-me-primary dark:text-white font-bold shadow-xs'
                              : 'text-slate-550 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/40 dark:hover:bg-slate-800/15'
                          }`}
                        >
                          <SubIcon className={`h-3.5 w-3.5 transition-colors ${subActive ? 'text-me-primary dark:text-[#5B8AF5]' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white'}`} />
                          <span>{subItem.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            }

            if (link.href) {
              const active = isActiveLink(link.href)
              const Icon = link.icon
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide uppercase transition-all duration-200 cursor-pointer ${
                    active
                      ? 'bg-me-surface dark:bg-[#1A56DB]/20 border-l-4 border-[#1A56DB] text-me-primary dark:text-white font-bold shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 border-l-4 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 transition-colors ${active ? 'text-me-primary dark:text-[#5B8AF5]' : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'}`} />
                  <span>{link.name}</span>
                </Link>
              )
            }
            return null
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
          <Image
            src="/icons/mellyna-icon-192.svg"
            alt="Mellyna"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg"
          />
          <span className="font-heading font-bold tracking-tight text-sm uppercase text-me-primary-dark dark:text-white">Mellyna Education</span>
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

