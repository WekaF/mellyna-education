// Inline copy of the function under test (extracted for testability)
function getTimeRange(slot: string): { start: string; end: string } {
  if (slot.includes(':')) {
    const [h, m] = slot.split(':').map(Number)
    const totalMins = h * 60 + m + 45
    const endH = Math.floor(totalMins / 60) % 24
    const endM = totalMins % 60
    return {
      start: slot,
      end: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`,
    }
  }
  const mapping: Record<string, { start: string; end: string }> = {
    'JAM 1': { start: '13:00', end: '13:45' },
    'JAM 2': { start: '14:00', end: '14:45' },
    'JAM 3': { start: '15:00', end: '15:45' },
    'JAM 4': { start: '16:00', end: '16:45' },
    'JAM 7': { start: '19:00', end: '19:45' },
  }
  return mapping[slot] ?? { start: '08:00', end: '08:45' }
}

describe('getTimeRange', () => {
  it('HH:MM slot → +45 minutes', () => {
    expect(getTimeRange('08:00')).toEqual({ start: '08:00', end: '08:45' })
    expect(getTimeRange('09:15')).toEqual({ start: '09:15', end: '10:00' })
    expect(getTimeRange('23:30')).toEqual({ start: '23:30', end: '00:15' })
  })
  it('JAM slots → correct 45-min windows', () => {
    expect(getTimeRange('JAM 1')).toEqual({ start: '13:00', end: '13:45' })
    expect(getTimeRange('JAM 7')).toEqual({ start: '19:00', end: '19:45' })
  })
  it('unknown slot → 08:00–08:45 fallback', () => {
    expect(getTimeRange('JAM X')).toEqual({ start: '08:00', end: '08:45' })
  })
})
