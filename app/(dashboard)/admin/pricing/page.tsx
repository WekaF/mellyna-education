import { Check } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'

const tiers = [
  {
    name: 'Paket Basic',
    price: 300000,
    period: '/bulan',
    color: 'border-slate-200',
    badge: null as string | null,
    sessions: 8,
    frequency: '2x pertemuan/minggu',
    features: [
      'Bimbingan 1 mata pelajaran',
      '8 sesi per bulan (60 menit/sesi)',
      'Laporan belajar bulanan',
      'Notifikasi jadwal via WhatsApp',
    ],
  },
  {
    name: 'Paket Standard',
    price: 500000,
    period: '/bulan',
    color: 'border-indigo-400',
    badge: 'Terpopuler' as string | null,
    sessions: 12,
    frequency: '3x pertemuan/minggu',
    features: [
      'Bimbingan 2 mata pelajaran',
      '12 sesi per bulan (60 menit/sesi)',
      'Laporan belajar mingguan',
      'Notifikasi jadwal via WhatsApp',
      'Konsultasi progres dengan orang tua',
    ],
  },
  {
    name: 'Paket Premium',
    price: 750000,
    period: '/bulan',
    color: 'border-amber-400',
    badge: 'Terlengkap' as string | null,
    sessions: 20,
    frequency: '5x pertemuan/minggu',
    features: [
      'Bimbingan semua mata pelajaran',
      '20 sesi per bulan (60 menit/sesi)',
      'Laporan belajar mingguan + nilai',
      'Notifikasi jadwal via WhatsApp',
      'Konsultasi progres dengan orang tua',
      'Try-out simulasi ujian bulanan',
      'Modul latihan soal digital',
    ],
  },
]

export default function AdminPricingPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">💰 Tabel Paket Harga</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Daftar paket bimbingan belajar Mellyna Education.{' '}
          <span className="text-amber-600 font-medium">(Data dummy — perbarui dengan harga resmi)</span>
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <div key={tier.name} className={`rounded-2xl bg-white border-2 ${tier.color} p-6 space-y-5 relative shadow-xs hover:shadow-md transition-shadow`}>
            {tier.badge && (
              <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full ${
                tier.badge === 'Terpopuler' ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white'
              }`}>
                {tier.badge}
              </div>
            )}

            <div>
              <h2 className="font-extrabold text-lg text-slate-800">{tier.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{tier.frequency}</p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-slate-800">{formatRupiah(tier.price)}</span>
              <span className="text-sm text-slate-400">{tier.period}</span>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2 text-center">
              <span className="text-lg font-extrabold text-indigo-600">{tier.sessions}</span>
              <span className="text-xs text-slate-500 ml-1">sesi per bulan</span>
            </div>

            <ul className="space-y-2">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-amber-50 border border-amber-100 p-5 text-sm text-amber-700 space-y-1">
        <p className="font-bold">📝 Catatan Admin</p>
        <p>Halaman ini menggunakan data dummy. Edit file <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">app/(dashboard)/admin/pricing/page.tsx</code> untuk memperbarui harga dan fitur sesuai paket resmi Mellyna Education.</p>
      </div>
    </div>
  )
}
