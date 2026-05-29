'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Star, Users, Trophy, Sparkles } from 'lucide-react'

const floatingCards = [
  { icon: Star, text: '4.9/5 Rating Orang Tua', color: 'text-yellow-400', pos: 'top-32 left-8 lg:left-24', delay: 0 },
  { icon: Users, text: '500+ Siswa Aktif', color: 'text-emerald-400', pos: 'bottom-40 right-8 lg:right-24', delay: 1 },
  { icon: Trophy, text: 'Bimbel Terpercaya', color: 'text-amber-400', pos: 'top-48 right-12 lg:right-40', delay: 2 },
]

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Floating cards */}
      {floatingCards.map((card, i) => (
        <motion.div
          key={card.text}
          className={`absolute hidden md:flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 text-white text-xs font-bold shadow-xl ${card.pos}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: [0, -10, 0] }}
          transition={{
            opacity: { delay: 0.8 + i * 0.2, duration: 0.5 },
            y: { delay: card.delay, duration: 3 + i * 0.5, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <card.icon className={`h-4 w-4 ${card.color} fill-current`} />
          <span>{card.text}</span>
        </motion.div>
      ))}

      {/* Main content */}
      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto pt-20">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-bold mb-6 backdrop-blur-sm"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Mellyna Education — Bimbingan Belajar Modern
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[1.1] mb-6"
        >
          Wujudkan{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Prestasi Terbaik
          </span>
          <br />
          Anak Anda
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Platform bimbingan belajar dengan program SEMPOA, English, Calistung, dan banyak lagi.
          Laporan progres real-time langsung ke WhatsApp orang tua.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/login"
            className="group flex items-center gap-2 px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1 transition-all duration-300"
          >
            Mulai Sekarang
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="#harga"
            className="flex items-center gap-2 px-8 py-4 text-base font-bold text-white border border-white/20 rounded-2xl hover:bg-white/10 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1"
          >
            Lihat Paket Harga
          </a>
        </motion.div>

        {/* Social proof row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-6 text-slate-400 text-sm"
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {['bg-indigo-400', 'bg-purple-400', 'bg-pink-400', 'bg-amber-400'].map((color, i) => (
                <div
                  key={i}
                  className={`w-7 h-7 rounded-full ${color} border-2 border-slate-900 flex items-center justify-center text-[9px] font-black text-white`}
                >
                  {['A', 'B', 'C', '+'][i]}
                </div>
              ))}
            </div>
            <span>500+ keluarga bergabung</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-slate-600 hidden sm:block" />
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
            ))}
            <span className="ml-1">4.9 / 5.0</span>
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-500 text-xs"
      >
        <span>Gulir ke bawah</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-5 h-8 rounded-full border-2 border-slate-600 flex items-start justify-center pt-1.5"
        >
          <div className="w-1 h-2 rounded-full bg-slate-500" />
        </motion.div>
      </motion.div>
    </section>
  )
}
