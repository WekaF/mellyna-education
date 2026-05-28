describe('tutor dashboard new badge logic', () => {
  it('marks schedule as new if published within last 24 hours', () => {
    const now = Date.now()
    const publishedAt = new Date(now - 2 * 60 * 60 * 1000) // 2 hours ago
    const isNew = publishedAt !== null && (now - publishedAt.getTime()) < 24 * 60 * 60 * 1000
    expect(isNew).toBe(true)
  })

  it('does not mark schedule as new if published over 24 hours ago', () => {
    const now = Date.now()
    const publishedAt = new Date(now - 25 * 60 * 60 * 1000) // 25 hours ago
    const isNew = publishedAt !== null && (now - publishedAt.getTime()) < 24 * 60 * 60 * 1000
    expect(isNew).toBe(false)
  })

  it('does not mark DRAFT schedule as new (no publishedAt)', () => {
    const publishedAt = null as Date | null
    const now = Date.now()
    const isNew = publishedAt !== null && (now - publishedAt.getTime()) < 24 * 60 * 60 * 1000
    expect(isNew).toBe(false)
  })
})
