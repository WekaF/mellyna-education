'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

const partners = [
  {
    name: 'Sempoa Kreatif',
    description: 'Mitra resmi program Mental Aritmetika & SEMPOA',
    logo: 'https://sempoakreatif.com/wp-content/uploads/2021/11/logo-sempoa-komplit.png',
    href: 'https://sempoakreatif.com/',
    bg: 'bg-white',
  },
  {
    name: 'AHE Pusat',
    description: 'Mitra resmi program Baca Anak Asyik & Menyenangkan',
    logo: 'https://ahe.education/logo.png',
    href: 'https://ahe.education/',
    bg: 'bg-white',
  },
]

export default function PartnersSection() {
  return (
    <section className="py-16 bg-slate-50 border-y border-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            Tersertifikasi & Terafiliasi Resmi dengan
          </p>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">
            Platform Pendidikan Terpercaya
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {partners.map((partner, index) => (
            <motion.a
              key={partner.name}
              href={partner.href}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.12, duration: 0.5 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className="group flex flex-col items-center gap-5 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300"
            >
              <div className="relative w-48 h-20 flex items-center justify-center">
                <Image
                  src={partner.logo}
                  alt={`Logo ${partner.name}`}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
              <div className="text-center">
                <p className="font-black text-slate-900 text-base group-hover:text-indigo-600 transition-colors">
                  {partner.name}
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {partner.description}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-bold uppercase tracking-wide">
                Afiliasi Resmi
              </span>
            </motion.a>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-center text-xs text-slate-400 mt-8"
        >
          Mellyna Education adalah mitra terdaftar dan tersertifikasi dari kedua platform di atas.
        </motion.p>
      </div>
    </section>
  )
}
