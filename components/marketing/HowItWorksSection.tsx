'use client'

import { motion } from 'framer-motion'
import { ClipboardList, BookOpen, TrendingUp } from 'lucide-react'

const steps = [
  {
    number: '01',
    title: 'Daftar & Konsultasi',
    desc: 'Hubungi kami untuk konsultasi gratis. Kami akan membantu memilih program yang paling sesuai untuk anak Anda.',
    icon: ClipboardList,
    gradient: 'from-indigo-500 to-blue-600',
    shadow: 'shadow-indigo-500/25',
  },
  {
    number: '02',
    title: 'Mulai Belajar',
    desc: 'Anak Anda bergabung dengan kelas pilihan, didampingi tutor berpengalaman dengan metode belajar yang menyenangkan.',
    icon: BookOpen,
    gradient: 'from-emerald-500 to-teal-600',
    shadow: 'shadow-emerald-500/25',
  },
  {
    number: '03',
    title: 'Pantau Progres',
    desc: 'Dapatkan laporan perkembangan belajar berkala langsung di WhatsApp. Pantau kemajuan anak Anda kapan saja.',
    icon: TrendingUp,
    gradient: 'from-purple-500 to-violet-600',
    shadow: 'shadow-purple-500/25',
  },
]

export default function HowItWorksSection() {
  return (
    <section id="cara-kerja" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 border border-purple-100 text-purple-600 text-xs font-bold mb-4">
            Cara Kerja
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
            Mudah Bergabung dalam 3 Langkah
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Proses pendaftaran sederhana dan cepat untuk memulai perjalanan belajar anak Anda bersama Mellyna Education.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          {/* Connector line on desktop */}
          <div className="hidden md:block absolute top-10 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-gradient-to-r from-indigo-200 via-emerald-200 to-purple-200" />

          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.5 }}
              className="relative text-center"
            >
              <div className="flex flex-col items-center">
                <div className="relative mb-6 z-10">
                  <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-xl ${step.shadow}`}>
                    <step.icon className="h-9 w-9 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border-2 border-slate-100 shadow-sm flex items-center justify-center text-[10px] font-black text-slate-500">
                    {step.number}
                  </span>
                </div>
                <h3 className="font-black text-xl text-slate-900 mb-3">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
