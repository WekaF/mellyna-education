'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, Star, UserPlus, Award } from 'lucide-react'
import { defaultSppTiers, defaultAdminFees, SppTier, AdminFee } from '@/lib/constants/pricing'
import { formatRupiah } from '@/lib/utils'

const tierStyles = [
  { gradient: 'from-emerald-500 to-teal-600', ring: 'ring-2 ring-emerald-200', badgeBg: 'from-emerald-500 to-teal-600', cta: 'from-emerald-500 to-teal-600' },
  { gradient: 'from-indigo-500 to-blue-600', ring: '', badgeBg: '', cta: 'from-indigo-500 to-blue-600' },
  { gradient: 'from-violet-500 to-purple-600', ring: '', badgeBg: '', cta: 'from-violet-500 to-purple-600' },
  { gradient: 'from-amber-500 to-orange-600', ring: 'ring-2 ring-amber-200', badgeBg: 'from-amber-500 to-orange-600', cta: 'from-amber-500 to-orange-600' },
]

const feeIcons = [UserPlus, Award]
const feeBgs = [
  'bg-indigo-50 border-indigo-100',
  'bg-amber-50 border-amber-100',
]
const feeIconBgs = [
  'from-indigo-500 to-blue-600',
  'from-amber-500 to-orange-600',
]

export default function PricingSection() {
  const [sppTiers, setSppTiers] = useState<SppTier[]>(defaultSppTiers)
  const [adminFees, setAdminFees] = useState<AdminFee[]>(defaultAdminFees)

  useEffect(() => {
    fetch('/api/pricing')
      .then(r => r.json())
      .then(data => {
        if (data.sppTiers?.length) setSppTiers(data.sppTiers)
        if (data.adminFees?.length) setAdminFees(data.adminFees)
      })
      .catch(() => {})
  }, [])

  return (
    <section id="harga" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold mb-4">
            Paket Harga
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
            Harga Transparan, Tanpa Biaya Tersembunyi
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Pilih tingkat bimbingan yang sesuai dengan kebutuhan dan perkembangan anak Anda.
          </p>
        </motion.div>

        {/* SPP label */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-8"
        >
          SPP Bulanan
        </motion.p>

        {/* SPP Tier cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
          {sppTiers.map((tier, index) => {
            const styles = tierStyles[index]
            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{ y: -6, scale: 1.02 }}
                className={`relative bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-300 ${styles.ring}`}
              >
                {tier.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r ${styles.badgeBg} text-white text-[10px] font-black uppercase tracking-wide shadow-md whitespace-nowrap`}>
                    {tier.badge}
                  </div>
                )}

                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${styles.gradient} flex items-center justify-center shadow-md mb-4`}>
                  <Star className="h-5 w-5 text-white fill-white" />
                </div>

                <h3 className="font-black text-base text-slate-900 mb-1">{tier.name}</h3>
                <p className="text-xs text-slate-500 mb-4 min-h-[32px] leading-relaxed">{tier.desc}</p>

                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-2xl font-black text-slate-900">{formatRupiah(tier.price)}</span>
                  <span className="text-xs text-slate-400 font-medium">{tier.period}</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-slate-600">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="#contact"
                  className={`block w-full text-center py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r ${styles.cta} text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`}
                >
                  Daftar Sekarang
                </a>
              </motion.div>
            )
          })}
        </div>

        {/* Admin fees label */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-8"
        >
          Biaya Pendaftaran & Kenaikan Tingkat
        </motion.p>

        {/* Admin fee cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {adminFees.map((fee, index) => {
            const Icon = feeIcons[index]
            return (
              <motion.div
                key={fee.name}
                initial={{ opacity: 0, x: index === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + index * 0.1, duration: 0.5 }}
                className={`bg-white rounded-3xl p-7 border shadow-sm hover:shadow-lg transition-all duration-300 ${feeBgs[index]}`}
              >
                <div className="flex items-start gap-4 mb-5">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${feeIconBgs[index]} flex items-center justify-center shadow-md shrink-0`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-black text-lg text-slate-900">{fee.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{fee.desc}</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 mb-5 border-b border-slate-100 pb-5">
                  <span className="text-3xl font-black text-slate-900">{formatRupiah(fee.price)}</span>
                  <span className="text-xs text-slate-400 font-medium">/ {fee.period}</span>
                </div>
                <ul className="space-y-2">
                  {fee.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span className={f.includes('TERMASUK') ? 'font-bold text-slate-800' : ''}>{f}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
