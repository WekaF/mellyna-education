import Link from 'next/link'

export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl">🔒</div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Akun Ditangguhkan</h1>
          <p className="mt-3 text-slate-500 text-sm leading-relaxed">
            Akun Anda sementara tidak dapat mengakses portal. Silakan hubungi administrator
            Mellyna Education untuk informasi lebih lanjut.
          </p>
        </div>
        <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-left space-y-1">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Butuh bantuan?</p>
          <p className="text-sm text-amber-600">Hubungi admin melalui WhatsApp atau email yang terdaftar.</p>
        </div>
        <Link
          href="/login"
          className="inline-block bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Kembali ke Halaman Login
        </Link>
      </div>
    </div>
  )
}
