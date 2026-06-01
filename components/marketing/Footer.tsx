import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Phone, Mail } from 'lucide-react'

const programs = ['SEMPOA', 'Calistung', 'English For Kids', 'AHE', 'English Everyday']

export default function Footer() {
  return (
    <footer className="bg-[#0C1A5C] text-[#6A8CC0] py-16">
      {/* Yellow top accent */}
      <div className="h-1 bg-me-yellow w-full -mt-16 mb-16" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-5 group w-fit">
              <Image
                src="/icons/mellyna-icon-192.svg"
                alt="Mellyna"
                width={40}
                height={40}
                className="h-10 w-10 rounded-xl"
              />
              <div className="flex flex-col leading-none gap-1">
                <span className="font-heading text-[20px] font-bold tracking-tight text-white">mellyna</span>
                <span className="font-body font-black text-[8px] tracking-[3px] uppercase text-me-yellow">education</span>
              </div>
            </Link>
            <p className="text-sm leading-relaxed max-w-sm">
              Bimbingan belajar terpercaya untuk mendampingi anak meraih prestasi terbaik
              dengan program unggulan dan tutor berpengalaman bersertifikat.
            </p>
          </div>

          {/* Programs */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4 font-body">Program</h4>
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
            <h4 className="text-white font-bold text-sm mb-4 font-body">Kontak</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-me-yellow" />
                <a
                  href="https://maps.app.goo.gl/ZFnnCMCh7yo27j9m7"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors duration-200 leading-snug"
                >
                  Lihat Lokasi di Google Maps
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-me-green" />
                <span>Hubungi via WhatsApp</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-me-primary-light" />
                <span>info@mellyna.id</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#1A3080] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs">© {new Date().getFullYear()} Mellyna Education. Hak cipta dilindungi.</p>
          <div className="flex items-center gap-6 text-xs">
            <a href="#" className="hover:text-white transition-colors">Kebijakan Privasi</a>
            <a href="#" className="hover:text-white transition-colors">Syarat &amp; Ketentuan</a>
            <Link href="/login" className="text-me-yellow hover:brightness-110 transition-all font-bold">
              Portal Login →
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
