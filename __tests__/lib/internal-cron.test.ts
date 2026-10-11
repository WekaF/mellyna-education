import { INTERNAL_CRON_INTERVAL_MS, startInternalCron, stopInternalCron } from '@/lib/internal-cron'
import { sendCheckInReminders } from '@/lib/checkin-reminders'

jest.mock('@/lib/checkin-reminders', () => ({
  sendCheckInReminders: jest.fn().mockResolvedValue({ schedules: 0, sent: 0 }),
}))

const tick = async () => {
  jest.advanceTimersByTime(INTERNAL_CRON_INTERVAL_MS)
  // biarkan callback async selesai
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('internal cron', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    ;(sendCheckInReminders as jest.Mock).mockResolvedValue({ schedules: 0, sent: 0 })
  })

  afterEach(() => {
    stopInternalCron()
    jest.useRealTimers()
  })

  it('runs every 5 minutes', () => {
    expect(INTERNAL_CRON_INTERVAL_MS).toBe(5 * 60 * 1000)
  })

  it('does nothing until the first interval passes, then sends reminders each interval', async () => {
    startInternalCron()
    expect(sendCheckInReminders).not.toHaveBeenCalled()
    await tick()
    expect(sendCheckInReminders).toHaveBeenCalledTimes(1)
    await tick()
    expect(sendCheckInReminders).toHaveBeenCalledTimes(2)
  })

  it('starts only one timer even if called twice', async () => {
    expect(startInternalCron()).toBe(true)
    expect(startInternalCron()).toBe(false)
    await tick()
    expect(sendCheckInReminders).toHaveBeenCalledTimes(1)
  })

  it('skips a tick while the previous run is still sending', async () => {
    let finish: () => void = () => {}
    ;(sendCheckInReminders as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = () => resolve({ schedules: 1, sent: 1 })
      }),
    )
    startInternalCron()
    await tick()
    await tick()
    expect(sendCheckInReminders).toHaveBeenCalledTimes(1)
    finish()
    for (let i = 0; i < 5; i++) await Promise.resolve() // biarkan run pertama selesai
    await tick()
    expect(sendCheckInReminders).toHaveBeenCalledTimes(2)
  })

  it('keeps running after a failed run', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(sendCheckInReminders as jest.Mock).mockRejectedValueOnce(new Error('db down'))
    startInternalCron()
    await tick()
    await tick()
    expect(sendCheckInReminders).toHaveBeenCalledTimes(2)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
