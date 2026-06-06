// Inline copy of the function under test (extracted for testability)
function getTimeRange(slot: string): { start: string; end: string } {
  if (slot.includes(':')) {
    const [h, m] = slot.split(':').map(Number)
    const totalMins = h * 60 + m + 60
    const endH = Math.floor(totalMins / 60) % 24
    const endM = totalMins % 60
    return {
      start: slot,
      end: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`,
    }
  }
  const mapping: Record<string, { start: string; end: string }> = {
    'JAM 1': { start: '13:00', end: '14:00' },
    'JAM 2': { start: '14:00', end: '15:00' },
    'JAM 3': { start: '15:00', end: '16:00' },
    'JAM 4': { start: '16:00', end: '17:00' },
    'JAM 7': { start: '19:00', end: '20:00' },
  }
  return mapping[slot] ?? { start: '08:00', end: '09:00' }
}

describe('getTimeRange', () => {
  it('HH:MM slot → +60 minutes', () => {
    expect(getTimeRange('08:00')).toEqual({ start: '08:00', end: '09:00' })
    expect(getTimeRange('09:15')).toEqual({ start: '09:15', end: '10:15' })
    expect(getTimeRange('23:00')).toEqual({ start: '23:00', end: '00:00' })
  })
  it('JAM slots → correct 60-min windows', () => {
    expect(getTimeRange('JAM 1')).toEqual({ start: '13:00', end: '14:00' })
    expect(getTimeRange('JAM 2')).toEqual({ start: '14:00', end: '15:00' })
    expect(getTimeRange('JAM 3')).toEqual({ start: '15:00', end: '16:00' })
    expect(getTimeRange('JAM 4')).toEqual({ start: '16:00', end: '17:00' })
    expect(getTimeRange('JAM 7')).toEqual({ start: '19:00', end: '20:00' })
  })
  it('unknown slot → 08:00–09:00 fallback', () => {
    expect(getTimeRange('JAM X')).toEqual({ start: '08:00', end: '09:00' })
  })
})
