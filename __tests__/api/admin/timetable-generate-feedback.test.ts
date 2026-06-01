describe('timetable generate feedback', () => {
  function buildResultMessage(created: number, skipped: number, wahaStatus: string): string {
    let msg = `${created} jadwal berhasil dibuat.`
    if (skipped > 0) msg += ` ${skipped} dilewati (jadwal sudah ada).`
    if (wahaStatus !== 'WORKING') {
      msg += ` ⚠️ Notifikasi WA tidak terkirim — WAHA ${wahaStatus}.`
    } else if (created > 0) {
      msg += ' Notifikasi WA sedang dikirim.'
    }
    return msg
  }

  it('shows only created count when all created and waha ok', () => {
    expect(buildResultMessage(3, 0, 'WORKING')).toBe(
      '3 jadwal berhasil dibuat. Notifikasi WA sedang dikirim.'
    )
  })

  it('shows skipped count when some schedules already exist', () => {
    expect(buildResultMessage(0, 1, 'WORKING')).toBe(
      '0 jadwal berhasil dibuat. 1 dilewati (jadwal sudah ada).'
    )
  })

  it('shows waha warning when session not WORKING', () => {
    expect(buildResultMessage(2, 0, 'OFFLINE')).toBe(
      '2 jadwal berhasil dibuat. ⚠️ Notifikasi WA tidak terkirim — WAHA OFFLINE.'
    )
  })

  it('shows both skipped and waha warning', () => {
    expect(buildResultMessage(1, 2, 'SCAN_QR_CODE')).toBe(
      '1 jadwal berhasil dibuat. 2 dilewati (jadwal sudah ada). ⚠️ Notifikasi WA tidak terkirim — WAHA SCAN_QR_CODE.'
    )
  })
})
