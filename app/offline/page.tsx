'use client'

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-white">
      <h1 className="text-2xl font-bold">Tidak ada koneksi internet</h1>
      <p className="text-slate-400">Periksa koneksi Anda dan coba lagi.</p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-700"
      >
        Coba Lagi
      </button>
    </div>
  )
}
