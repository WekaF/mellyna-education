import { sendCheckInReminders } from '@/lib/checkin-reminders'

export const INTERNAL_CRON_INTERVAL_MS = 5 * 60 * 1000

// Disimpan di globalThis supaya tidak dobel kalau modul ini dimuat ulang.
const g = globalThis as { __internalCronTimer?: ReturnType<typeof setInterval> }

// ponytail: timer dalam proses, aman selama aplikasi jalan satu instance.
// Kalau nanti lebih dari satu instance, pindahkan ke penjadwal luar (klaim per jadwal tetap mencegah WA dobel).
export function startInternalCron(): boolean {
  if (g.__internalCronTimer) return false

  let running = false
  g.__internalCronTimer = setInterval(async () => {
    if (running) return
    running = true
    try {
      const result = await sendCheckInReminders()
      if (result.sent > 0) {
        console.log(`[Internal Cron] Pengingat absen: ${result.sent} WA untuk ${result.schedules} jadwal.`)
      }
    } catch (error) {
      console.error('[Internal Cron] Pengingat absen gagal:', error)
    } finally {
      running = false
    }
  }, INTERNAL_CRON_INTERVAL_MS)

  return true
}

export function stopInternalCron(): void {
  if (g.__internalCronTimer) clearInterval(g.__internalCronTimer)
  g.__internalCronTimer = undefined
}
