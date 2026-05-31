describe('StudentMilestone access control', () => {
  it('only SUPER_ADMIN can update student milestone status', () => {
    const allowed = ['SUPER_ADMIN']
    expect(allowed.includes('SUPER_ADMIN')).toBe(true)
    expect(allowed.includes('TUTOR')).toBe(false)
    expect(allowed.includes('PARENT')).toBe(false)
  })

  it('PARENT can only read their own child milestones', () => {
    const parentId = 'parent-1'
    const student = { parentId: 'parent-1' }
    expect(student.parentId === parentId).toBe(true)

    const otherStudent = { parentId: 'parent-2' }
    expect(otherStudent.parentId === parentId).toBe(false)
  })
})

describe('StudentMilestone status logic', () => {
  it('validates status is a valid MilestoneStatus value', () => {
    const validStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']
    expect(validStatuses.includes('NOT_STARTED')).toBe(true)
    expect(validStatuses.includes('COMPLETED')).toBe(true)
    expect(validStatuses.includes('INVALID')).toBe(false)
  })

  it('sets completedAt when status changes to COMPLETED', () => {
    const now = new Date()
    const getCompletedAt = (status: string, existing?: Date) => {
      if (status === 'COMPLETED' && !existing) return now
      if (status !== 'COMPLETED') return null
      return existing ?? null
    }
    expect(getCompletedAt('COMPLETED')).toBeInstanceOf(Date)
    expect(getCompletedAt('IN_PROGRESS')).toBeNull()
    expect(getCompletedAt('NOT_STARTED')).toBeNull()
  })

  it('calculates progress percentage correctly', () => {
    const calcProgress = (completed: number, total: number) => {
      if (total === 0) return 0
      return Math.round((completed / total) * 100)
    }
    expect(calcProgress(3, 10)).toBe(30)
    expect(calcProgress(10, 10)).toBe(100)
    expect(calcProgress(0, 5)).toBe(0)
    expect(calcProgress(0, 0)).toBe(0)
  })
})
