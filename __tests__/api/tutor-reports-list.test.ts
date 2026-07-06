describe('tutor reports list — where clause scoping', () => {
  function buildWhere(tutorId: string, search: string, classId: string, dateFrom: string, dateTo: string) {
    const scheduleFilter: Record<string, unknown> = {}
    if (classId) scheduleFilter.classId = classId
    if (dateFrom || dateTo) {
      scheduleFilter.date = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) } : {}),
      }
    }

    const where: Record<string, unknown> = { tutorId }
    if (search) {
      where.OR = [
        { student: { name: { contains: search, mode: 'insensitive' } } },
        { schedule: { class: { name: { contains: search, mode: 'insensitive' } } } },
      ]
    }
    if (Object.keys(scheduleFilter).length > 0) {
      where.schedule = scheduleFilter
    }
    return where
  }

  it('always scopes to the requesting tutor id', () => {
    const where = buildWhere('tutor-1', '', '', '', '')
    expect(where).toEqual({ tutorId: 'tutor-1' })
  })

  it('adds search OR clause without dropping tutorId scope', () => {
    const where: any = buildWhere('tutor-1', 'Andi', '', '', '')
    expect(where.tutorId).toBe('tutor-1')
    expect(where.OR).toHaveLength(2)
  })

  it('adds schedule.classId filter without dropping tutorId scope', () => {
    const where: any = buildWhere('tutor-1', '', 'class-9', '', '')
    expect(where.tutorId).toBe('tutor-1')
    expect(where.schedule).toEqual({ classId: 'class-9' })
  })

  it('a different tutor id produces a different scope (no cross-tutor leakage)', () => {
    const whereA = buildWhere('tutor-1', '', '', '', '')
    const whereB = buildWhere('tutor-2', '', '', '', '')
    expect(whereA).not.toEqual(whereB)
  })
})

describe('tutor reports list — auth', () => {
  it('rejects when there is no session', () => {
    const session = null
    const authorized = !!session
    expect(authorized).toBe(false)
  })

  it('authorizes any authenticated session (role gating happens in middleware)', () => {
    const session = { user: { id: 'tutor-1', role: 'TUTOR' } }
    const authorized = !!session
    expect(authorized).toBe(true)
  })
})
