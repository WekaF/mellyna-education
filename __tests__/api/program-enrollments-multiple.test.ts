describe('program enrollment multiple constraint', () => {
  it('blocks duplicate enrollment for same program', () => {
    const existing = [
      { program: 'SEMPOA', status: 'ACTIVE' },
      { program: 'AHE', status: 'ACTIVE' },
    ]
    const newProgram = 'SEMPOA'
    const isDuplicate = existing.some(
      (e) => e.program === newProgram && e.status === 'ACTIVE'
    )
    expect(isDuplicate).toBe(true)
  })

  it('allows adding a different program when student has active enrollments', () => {
    const existing = [
      { program: 'SEMPOA', status: 'ACTIVE' },
      { program: 'AHE', status: 'ACTIVE' },
    ]
    const newProgram = 'EFK'
    const isDuplicate = existing.some(
      (e) => e.program === newProgram && e.status === 'ACTIVE'
    )
    expect(isDuplicate).toBe(false)
  })

  it('allows adding first program when student has no active enrollments', () => {
    const existing: { program: string; status: string }[] = []
    const newProgram = 'SEMPOA'
    const isDuplicate = existing.some(
      (e) => e.program === newProgram && e.status === 'ACTIVE'
    )
    expect(isDuplicate).toBe(false)
  })

  it('allows adding program when existing enrollment is not ACTIVE', () => {
    const existing = [{ program: 'SEMPOA', status: 'COMPLETED' }]
    const newProgram = 'SEMPOA'
    const isDuplicate = existing.some(
      (e) => e.program === newProgram && e.status === 'ACTIVE'
    )
    expect(isDuplicate).toBe(false)
  })
})
