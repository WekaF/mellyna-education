import {
  buildAdminDailyDigestMessage,
  buildParentWeeklyDigestMessage,
} from '@/lib/report-notify'

describe('buildAdminDailyDigestMessage', () => {
  it('includes report count and class grouping', () => {
    const date = new Date('2026-05-29T00:00:00Z')
    const reports = [
      { studentName: 'Andi', className: 'Sempoa A', tutorName: 'Tutor X', score: 85 },
      { studentName: 'Budi', className: 'Sempoa A', tutorName: 'Tutor X', score: null },
      { studentName: 'Cici', className: 'Bahasa B', tutorName: 'Tutor Y', score: 90 },
    ]
    const msg = buildAdminDailyDigestMessage(date, reports)
    expect(msg).toContain('3')
    expect(msg).toContain('Sempoa A')
    expect(msg).toContain('Bahasa B')
    expect(msg).toContain('Andi')
    expect(msg).toContain('85')
  })

  it('handles empty report list', () => {
    const msg = buildAdminDailyDigestMessage(new Date(), [])
    expect(msg).toContain('0')
  })
})

describe('buildParentWeeklyDigestMessage', () => {
  it('includes parent name, student name, and score', () => {
    const start = new Date('2026-05-25T00:00:00Z')
    const end = new Date('2026-05-31T00:00:00Z')
    const reports = [
      {
        studentName: 'Andi',
        className: 'Sempoa A',
        score: 85,
        content: 'Sudah bisa penjumlahan 3 digit.',
        tutorName: 'Tutor X',
      },
    ]
    const msg = buildParentWeeklyDigestMessage('Bunda Sari', start, end, reports)
    expect(msg).toContain('Bunda Sari')
    expect(msg).toContain('Andi')
    expect(msg).toContain('85')
    expect(msg).toContain('Sempoa A')
  })

  it('truncates long content to 120 chars', () => {
    const longContent = 'A'.repeat(200)
    const msg = buildParentWeeklyDigestMessage(
      'Ortu',
      new Date(),
      new Date(),
      [{ studentName: 'S', className: 'C', score: null, content: longContent, tutorName: 'T' }]
    )
    expect(msg).toContain('…')
    expect(msg).not.toContain('A'.repeat(121))
  })
})
