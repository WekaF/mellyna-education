'use client'

import { motion } from 'framer-motion'
import { Users, BookOpen, Award, Clock } from 'lucide-react'

const stats = [
  { value: '500+', label: 'Siswa Aktif', icon: Users, bg: 'bg-indigo-50', color: 'text-indigo-600' },
  { value: '20+', label: 'Tutor Berpengalaman', icon: Award, bg: 'bg-emerald-50', color: 'text-emerald-600' },
  { value: '6', label: 'Program Unggulan', icon: BookOpen, bg: 'bg-purple-50', color: 'text-purple-600' },
  { value: '5+', label: 'Tahun Berdiri', icon: Clock, bg: 'bg-amber-50', color: 'text-amber-600' },
]

export default function StatsSection() {
  return (
    <section className="py-16 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="text-center"
            >
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${stat.bg} mb-4`}>
                <stat.icon className={`h-7 w-7 ${stat.color}`} />
              </div>
              <div className="text-3xl font-black text-slate-900 mb-1">{stat.value}</div>
              <div className="text-sm text-slate-500 font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
