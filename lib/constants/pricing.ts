export interface SppTier {
  name: string
  price: number
  period: string
  desc: string
  badge: string | null
  features: string[]
}

export interface AdminFee {
  name: string
  price: number
  period: string
  desc: string
  features: string[]
}

export const defaultSppTiers: SppTier[] = [
  {
    name: 'Tingkat 1',
    price: 150000,
    period: '/bulan',
    desc: 'Untuk pemula dan level dasar materi bimbingan.',
    badge: 'Terpopuler',
    features: [
      'Bimbingan materi dasar terpadu',
      '8-12 sesi bimbingan interaktif per bulan',
      'Laporan progres belajar bulanan',
      'Notifikasi kehadiran & laporan via WhatsApp',
      'Konsultasi berkala orang tua & tutor',
    ],
  },
  {
    name: 'Tingkat 2',
    price: 160000,
    period: '/bulan',
    desc: 'Untuk level pemantapan bimbingan tingkat menengah.',
    badge: null,
    features: [
      'Bimbingan pemantapan tingkat lanjut',
      '8-12 sesi bimbingan interaktif per bulan',
      'Laporan progres belajar bulanan lengkap',
      'Notifikasi kehadiran & laporan via WhatsApp',
      'Konsultasi berkala orang tua & tutor',
    ],
  },
  {
    name: 'Tingkat 3',
    price: 170000,
    period: '/bulan',
    desc: 'Untuk level mahir dan bimbingan akselerasi 1.',
    badge: null,
    features: [
      'Bimbingan akselerasi tingkat tinggi',
      '8-12 sesi bimbingan intensif per bulan',
      'Laporan progres belajar bulanan mendalam',
      'Notifikasi kehadiran & laporan via WhatsApp',
      'Konsultasi berkala orang tua & tutor',
    ],
  },
  {
    name: 'Tingkat 4',
    price: 180000,
    period: '/bulan',
    desc: 'Level bimbingan tingkat tertinggi & modul akselerasi 2.',
    badge: 'Termaju',
    features: [
      'Bimbingan tingkat tertinggi / advance',
      '8-12 sesi bimbingan intensif per bulan',
      'Laporan progres belajar bulanan mendalam',
      'Notifikasi kehadiran & laporan via WhatsApp',
      'Konsultasi berkala orang tua & tutor',
      'Ujian kompetensi kelulusan tingkat gratis',
    ],
  },
]

export const defaultAdminFees: AdminFee[] = [
  {
    name: 'Paket Registrasi Baru',
    price: 400000,
    period: 'sekali bayar',
    desc: 'Paket pendaftaran lengkap bagi siswa baru yang baru bergabung.',
    features: [
      'Sudah TERMASUK SPP bulan pertama (Diskon subsidi Rp135.000)',
      'Sudah TERMASUK buku modul bimbingan awal',
      'Sudah TERMASUK tas & atribut bimbel Mellyna Education',
      'Biaya administrasi pendaftaran siswa',
    ],
  },
  {
    name: 'Kenaikan Tingkat',
    price: 120000,
    period: 'per naik level',
    desc: 'Biaya kenaikan jenjang tingkat belajar di bimbel.',
    features: [
      'Buku modul tingkat baru lengkap',
      'Biaya ujian sertifikasi kenaikan tingkat',
      'Sertifikat kelulusan level resmi',
      'Pembaruan media & alat peraga bimbingan',
    ],
  },
]
