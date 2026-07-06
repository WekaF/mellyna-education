describe('tutor reports list — where clause scoping (class-based: primary tutor OR co-teacher)', () => {
  function buildWhere(tutorId: string, search: string, classId: string, dateFrom: string, dateTo: string) {
    const scheduleFilter: Record<string, unknown> = {
      class: {
        OR: [
          { tutorId },
          { additionalTutors: { some: { tutorId } } },
        ],
      },
    }
    if (classId) scheduleFilter.classId = classId
    if (dateFrom || dateTo) {
      scheduleFilter.date = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) } : {}),
      }
    }

    const where: Record<string, unknown> = { schedule: scheduleFilter }
    if (search) {
      where.OR = [
        { student: { name: { contains: search, mode: 'insensitive' } } },
        { schedule: { class: { name: { contains: search, mode: 'insensitive' } } } },
      ]
    }
    return where
  }

  it('scopes by class ownership (primary or co-teacher), not by report author', () => {
    const where: any = buildWhere('tutor-1', '', '', '', '')
    expect(where.tutorId).toBeUndefined()
    expect(where.schedule.class.OR).toEqual([
      { tutorId: 'tutor-1' },
      { additionalTutors: { some: { tutorId: 'tutor-1' } } },
    ])
  })

  it('adds search OR clause alongside the class-ownership scope (both apply, AND-ed)', () => {
    const where: any = buildWhere('tutor-1', 'Andi', '', '', '')
    expect(where.schedule.class.OR).toBeDefined()
    expect(where.OR).toHaveLength(2)
  })

  it('adds schedule.classId filter without dropping the class-ownership scope', () => {
    const where: any = buildWhere('tutor-1', '', 'class-9', '', '')
    expect(where.schedule.classId).toBe('class-9')
    expect(where.schedule.class.OR).toBeDefined()
  })

  it('a different tutor id produces a different scope (still class-based, not global)', () => {
    const whereA = buildWhere('tutor-1', '', '', '', '')
    const whereB = buildWhere('tutor-2', '', '', '', '')
    expect(whereA).not.toEqual(whereB)
  })
})

describe('tutor reports list — auth', () => {
  function isAuthorized(session: { user: { role: string; suspended?: boolean } } | null) {
    if (!session) return false
    const role = session.user.role
    if (role !== 'TUTOR' && role !== 'SUPER_ADMIN') return false
    if (session.user.suspended) return false
    return true
  }

  it('rejects when there is no session', () => {
    expect(isAuthorized(null)).toBe(false)
  })

  it('authorizes an active TUTOR session', () => {
    expect(isAuthorized({ user: { id: 'tutor-1', role: 'TUTOR' } } as any)).toBe(true)
  })

  it('authorizes a SUPER_ADMIN session', () => {
    expect(isAuthorized({ user: { id: 'admin-1', role: 'SUPER_ADMIN' } } as any)).toBe(true)
  })

  it('rejects a PARENT session', () => {
    expect(isAuthorized({ user: { id: 'parent-1', role: 'PARENT' } } as any)).toBe(false)
  })

  it('rejects a suspended TUTOR session', () => {
    expect(isAuthorized({ user: { id: 'tutor-1', role: 'TUTOR', suspended: true } } as any)).toBe(false)
  })
})
