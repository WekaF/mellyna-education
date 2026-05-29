'use client'

import { motion } from 'framer-motion'
import { Calculator, BookOpen, Globe, Star, Zap, GraduationCap } from 'lucide-react'

const programs = [
  {
    name: 'SEMPOA',
    desc: 'Berhitung cepat mental aritmetika dengan teknik sempoa. Melatih daya konsentrasi dan kecepatan berpikir anak.',
    icon: Calculator,
    gradient: 'from-indigo-500 to-blue-600',
    shadowColor: 'shadow-indigo-500/25',
    tag: 'Unggulan',
  },
  {
    name: 'Calistung',
    desc: 'Membaca, menulis, dan berhitung untuk anak usia dini. Fondasi kuat untuk jenjang pendidikan selanjutnya.',
    icon: BookOpen,
    gradient: 'from-emerald-500 to-teal-600',
    shadowColor: 'shadow-emerald-500/25',
    tag: null,
  },
  {
    name: 'English For Kids (EFK)',
    desc: 'Program bahasa Inggris interaktif untuk anak. Berbicara, menulis, dan memahami dengan cara menyenangkan.',
    icon: Globe,
    gradient: 'from-purple-500 to-violet-600',
    shadowColor: 'shadow-purple-500/25',
    tag: 'Populer',
  },
  {
    name: 'English Young Learner',
    desc: 'Kurikulum English terstruktur untuk siswa lanjut dengan fokus pada grammar dan percakapan aktif.',
    icon: Star,
    gradient: 'from-amber-500 to-orange-600',
    shadowColor: 'shadow-amber-500/25',
    tag: null,
  },
  {
    name: 'AHE (Aritmatika)',
    desc: 'Aritmatika hitung ekspres untuk meningkatkan kemampuan berhitung dengan cepat dan akurat.',
    icon: Zap,
    gradient: 'from-pink-500 to-rose-600',
    shadowColor: 'shadow-pink-500/25',
    tag: null,
  },
  {
    name: 'English Everyday',
    desc: 'Bahasa Inggris untuk kehidupan sehari-hari. Praktis, komunikatif, dan langsung bisa diterapkan.',
    icon: GraduationCap,
    gradient: 'from-cyan-500 to-sky-600',
    shadowColor: 'shadow-cyan-500/25',
    tag: null,
  },
]

export default function ProgramsSection() {
  return (
    <section id="program" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold mb-4">
            Program Unggulan
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
            Program Bimbingan Pilihan
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Berbagai program bimbingan dirancang untuk mendukung setiap tahap perkembangan belajar anak,
            dipandu tutor berpengalaman bersertifikat.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map((program, index) => (
            <motion.div
              key={program.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.5 }}
              whileHover={{ y: -6 }}
              className="group bg-white rounded-3xl p-6 border border-slate-100 hover:border-indigo-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-default"
            >
              <div className="flex items-start justify-between mb-5">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${program.gradient} flex items-center justify-center shadow-lg ${program.shadowColor}`}>
                  <program.icon className="h-6 w-6 text-white" />
                </div>
                {program.tag && (
                  <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold border border-indigo-100">
                    {program.tag}
                  </span>
                )}
              </div>
              <h3 className="font-black text-lg text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
                {program.name}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">{program.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
