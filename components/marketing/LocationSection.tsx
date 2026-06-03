'use client'

import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { MapPin, ExternalLink, Clock, Phone } from 'lucide-react'

const LeafletMap = dynamic(() => import('./LeafletMap'), { ssr: false })

export default function LocationSection() {
  return (
    <section id="lokasi" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold mb-4">
            Lokasi Kami
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
            Temukan Kami di Sini
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto leading-relaxed">
            Kunjungi kantor Mellyna Education atau hubungi kami untuk informasi lebih lanjut.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-stretch">
          {/* Info card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-2 flex flex-col gap-5"
          >
            {/* Address */}
            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 flex-1">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shrink-0">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 mb-1">Alamat</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-3">
                    Mellyna Education<br />
                    Jawa Timur, Indonesia
                  </p>
                  <a
                    href="https://maps.app.goo.gl/ZFnnCMCh7yo27j9m7"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Buka di Google Maps
                  </a>
                </div>
              </div>
            </div>

            {/* Hours */}
            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shrink-0">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 mb-2">Jam Operasional</h3>
                  <div className="space-y-1 text-sm text-slate-500">
                    <div className="flex justify-between gap-6">
                      <span>Senin – Jumat</span>
                      <span className="font-semibold text-slate-700">08.00 – 17.00</span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span>Sabtu</span>
                      <span className="font-semibold text-slate-700">08.00 – 15.00</span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span>Minggu</span>
                      <span className="font-semibold text-slate-700">Libur</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Phone className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black">Konsultasi Gratis</h3>
                  <p className="text-indigo-100 text-xs mt-0.5">Hubungi kami sekarang</p>
                </div>
              </div>
              <p className="text-white/90 text-sm font-semibold mb-3">+62 857-3100-8212</p>
              <a
                href="https://wa.me/6285731008212"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-2.5 rounded-xl bg-white text-indigo-600 text-sm font-bold hover:bg-indigo-50 transition-colors"
              >
                WhatsApp Kami
              </a>
            </div>
          </motion.div>

          {/* Leaflet Map */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-3 rounded-3xl overflow-hidden border border-slate-100 shadow-lg min-h-[420px]"
          >
            <LeafletMap />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
