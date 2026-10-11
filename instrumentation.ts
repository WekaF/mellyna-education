// Dijalankan Next.js sekali saat server menyala.
export async function register() {
  // Hanya di server Node production: tidak saat build, tidak di dev, tidak di edge runtime.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  // Saklar darurat: set INTERNAL_CRON=off di environment untuk mematikan timer tanpa deploy kode.
  if (process.env.INTERNAL_CRON === 'off') return

  // Timer gagal dimuat tidak boleh menghalangi server menyala.
  try {
    const { startInternalCron } = await import('@/lib/internal-cron')
    if (startInternalCron()) console.log('[Internal Cron] Aktif: pengingat absen tiap 5 menit.')
  } catch (error) {
    console.error('[Internal Cron] Gagal diaktifkan:', error)
  }
}
