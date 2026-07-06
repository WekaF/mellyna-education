describe('schedule publish — broadcast result summary', () => {
  function summarizeBroadcast(results: { name: string; success: boolean }[]) {
    return {
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).map(r => r.name),
    }
  }

  it('counts all-success broadcast with no failures', () => {
    const results = [
      { name: 'Ortu Vina', success: true },
      { name: 'Melly', success: true },
    ]
    expect(summarizeBroadcast(results)).toEqual({ sent: 2, failed: [] })
  })

  it('lists failed recipients by name and counts only successes as sent', () => {
    const results = [
      { name: 'Ortu Vina', success: true },
      { name: 'Ortu Budi', success: false },
      { name: 'Melly', success: false },
    ]
    expect(summarizeBroadcast(results)).toEqual({ sent: 1, failed: ['Ortu Budi', 'Melly'] })
  })

  it('returns zero sent and empty failed for an empty recipient list', () => {
    expect(summarizeBroadcast([])).toEqual({ sent: 0, failed: [] })
  })
})
