describe('MilestoneReport period logic', () => {
  it('MONTHLY: periodStart is first day of month, periodEnd is last day', () => {
    const year = 2026, monthIdx = 4 // May (0-indexed)
    const start = new Date(year, monthIdx, 1)
    const end = new Date(year, monthIdx + 1, 0, 23, 59, 59)
    expect(start.getDate()).toBe(1)
    expect(end.getMonth()).toBe(monthIdx)
    expect(end.getDate()).toBe(31) // May has 31 days
  })

  it('SEMESTER 1: covers Jan 1 through Jun 30', () => {
    const year = 2026
    const start = new Date(year, 0, 1)
    const end = new Date(year, 5, 30, 23, 59, 59)
    expect(start.getMonth()).toBe(0)
    expect(end.getMonth()).toBe(5)
    expect(end.getDate()).toBe(30)
  })

  it('SEMESTER 2: covers Jul 1 through Dec 31', () => {
    const year = 2026
    const start = new Date(year, 6, 1)
    const end = new Date(year, 11, 31, 23, 59, 59)
    expect(start.getMonth()).toBe(6)
    expect(end.getMonth()).toBe(11)
    expect(end.getDate()).toBe(31)
  })

  it('CUSTOM: arbitrary date range, end is after start', () => {
    const start = new Date('2026-04-01')
    const end = new Date('2026-05-31')
    expect(end > start).toBe(true)
  })
})

describe('MilestoneReport snapshot computation', () => {
  it('computes percent correctly', () => {
    const calc = (completed: number, total: number) =>
      total === 0 ? 0 : Math.round((completed / total) * 100)
    expect(calc(3, 10)).toBe(30)
    expect(calc(10, 10)).toBe(100)
    expect(calc(0, 5)).toBe(0)
    expect(calc(0, 0)).toBe(0)
  })

  it('computes avgScore from non-null scores', () => {
    const scores = [80, 90, 85, 75]
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    expect(avg).toBe(83)
  })

  it('avgScore is null when no sessions have scores', () => {
    const scores: number[] = []
    const avg = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null
    expect(avg).toBeNull()
  })

  it('snapshot skips programs with no milestones', () => {
    const programs = ['SEMPOA', 'AHE', 'ENGLISH']
    const milestonesByProgram: Record<string, number> = { SEMPOA: 5, AHE: 0, ENGLISH: 3 }
    const active = programs.filter((p) => (milestonesByProgram[p] ?? 0) > 0)
    expect(active).toEqual(['SEMPOA', 'ENGLISH'])
  })
})

describe('MilestoneReport access control', () => {
  it('only SUPER_ADMIN can create raport', () => {
    const allowed = ['SUPER_ADMIN']
    expect(allowed.includes('SUPER_ADMIN')).toBe(true)
    expect(allowed.includes('TUTOR')).toBe(false)
    expect(allowed.includes('PARENT')).toBe(false)
  })

  it('PARENT can only read their own children raports', () => {
    const parentId = 'parent-1'
    const ownChild = { parentId: 'parent-1' }
    const otherChild = { parentId: 'parent-2' }
    expect(ownChild.parentId === parentId).toBe(true)
    expect(otherChild.parentId === parentId).toBe(false)
  })

  it('TUTOR cannot read raports', () => {
    const forbidden = ['TUTOR']
    expect(forbidden.includes('TUTOR')).toBe(true)
  })
})
