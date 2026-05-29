import Link from 'next/link'
import { BookOpen, MapPin, Phone, Mail } from 'lucide-react'

const programs = ['SEMPOA', 'Calistung', 'English For Kids', 'AHE', 'English Everyday']

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md group-hover:shadow-indigo-500/30 transition-shadow">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <span className="font-black text-lg text-white">
                Mellyna <span className="text-indigo-400">Education</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed max-w-sm">
              Bimbingan belajar terpercaya untuk mendampingi anak meraih prestasi terbaik
              dengan program unggulan dan tutor berpengalaman bersertifikat.
            </p>
          </div>

          {/* Programs */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4">Program</h4>
            <ul className="space-y-2.5 text-sm">
              {programs.map((p) => (
                <li key={p}>
                  <a href="#program" className="hover:text-white transition-colors duration-200">
                    {p}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4">Kontak</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-indigo-400" />
                <span>Mellyna Education, Indonesia</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-emerald-400" />
                <span>Hubungi via WhatsApp</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-blue-400" />
                <span>info@mellyna.id</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs">© {new Date().getFullYear()} Mellyna Education. Hak cipta dilindungi.</p>
          <div className="flex items-center gap-6 text-xs">
            <a href="#" className="hover:text-white transition-colors">Kebijakan Privasi</a>
            <a href="#" className="hover:text-white transition-colors">Syarat & Ketentuan</a>
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors font-bold">
              Portal Login →
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
