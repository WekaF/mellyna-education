describe('fetchParents sync logic', () => {
  it('finds updated student from fresh parent list', () => {
    const freshParents = [
      {
        id: 'parent-1',
        children: [
          { id: 'student-1', name: 'Budi', programEnrollments: [{ id: 'pe-1', program: 'SEMPOA', status: 'ACTIVE', startedAt: '2026-01-01T00:00:00.000Z' }] },
        ],
      },
    ]
    const prevStudent = { id: 'student-1', name: 'Budi', programEnrollments: [] }

    let result: typeof prevStudent | null = prevStudent
    result = (() => {
      if (!prevStudent) return null
      for (const parent of freshParents) {
        const found = parent.children.find((c) => c.id === prevStudent.id)
        if (found) return found as typeof prevStudent
      }
      return prevStudent
    })()

    expect(result?.programEnrollments).toHaveLength(1)
    expect((result?.programEnrollments as any[])[0].program).toBe('SEMPOA')
  })

  it('returns null when no student was selected', () => {
    const freshParents = [{ id: 'parent-1', children: [{ id: 'student-1', name: 'Budi' }] }]
    const prevStudent = null

    const result = (() => {
      if (!prevStudent) return null
      for (const parent of freshParents) {
        const found = parent.children.find((c) => (c as any).id === (prevStudent as any).id)
        if (found) return found
      }
      return prevStudent
    })()

    expect(result).toBeNull()
  })

  it('finds updated parent from fresh parent list', () => {
    const freshParents = [
      { id: 'parent-1', name: 'Ibu Ani', children: [{ id: 'student-1', programEnrollments: [{ program: 'SEMPOA' }] }] },
    ]
    const prevParent = { id: 'parent-1', name: 'Ibu Ani', children: [] }

    const result = (() => {
      if (!prevParent) return null
      return freshParents.find((p) => p.id === prevParent.id) ?? prevParent
    })()

    expect((result as any)?.children).toHaveLength(1)
  })
})
