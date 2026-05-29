'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, MessageCircle } from 'lucide-react'

export default function CTASection() {
  return (
    <section id="contact" className="py-24 bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-bold mb-6">
            Siap Bergabung?
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight">
            Bergabunglah dengan{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              500+ Keluarga
            </span>{' '}
            Mellyna Education
          </h2>
          <p className="text-slate-300 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            Mulai perjalanan belajar anak Anda hari ini. Konsultasi pertama gratis, tanpa komitmen.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="group flex items-center gap-2 px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1 transition-all duration-300"
            >
              Masuk ke Portal
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#program"
              className="flex items-center gap-2 px-8 py-4 text-base font-bold text-white border border-white/20 rounded-2xl hover:bg-white/10 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1"
            >
              <MessageCircle className="h-5 w-5 text-emerald-400" />
              Lihat Program Kami
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
