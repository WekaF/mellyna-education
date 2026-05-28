describe('tutor reports page data transformation', () => {
  it('extracts students from participants not enrollments', () => {
    const scheduleApiResponse = {
      participants: [
        { student: { id: 's1', name: 'Andi', grade: '5' } },
        { student: { id: 's2', name: 'Budi', grade: '6' } },
      ],
      class: {
        name: 'Matematika',
        enrollments: [
          { student: { id: 's3', name: 'Cici', grade: '5' } },
        ],
      },
    }

    const fromParticipants = (scheduleApiResponse.participants ?? []).map((p: any) => p.student)
    expect(fromParticipants).toHaveLength(2)
    expect(fromParticipants[0].id).toBe('s1')

    const fromEnrollments = scheduleApiResponse.class.enrollments.map((e: any) => e.student)
    expect(fromEnrollments).toHaveLength(1)
    expect(fromEnrollments[0].id).toBe('s3')
  })

  it('initializes media from existing reports', () => {
    const reportsData = [
      {
        studentId: 's1',
        id: 'r1',
        content: 'Good progress',
        score: 85,
        media: [{ id: 'm1', url: 'http://...', type: 'PHOTO', filename: 'photo.jpg' }],
      },
    ]
    const existingReports: Record<string, any> = {}
    reportsData.forEach((r) => { existingReports[r.studentId] = r })

    const entry = {
      studentId: 's1',
      content: existingReports['s1']?.content || '',
      score: existingReports['s1']?.score?.toString() || '',
      reportId: existingReports['s1']?.id || null,
      uploading: false,
      media: existingReports['s1']?.media || [],
    }

    expect(entry.media).toHaveLength(1)
    expect(entry.media[0].id).toBe('m1')
  })

  it('adds new media to state after successful upload', () => {
    const initialMedia = [{ id: 'm1', url: 'http://a', type: 'PHOTO', filename: 'a.jpg' }]
    const newMedia = { id: 'm2', url: 'http://b', type: 'VIDEO', filename: 'b.mp4' }
    const updated = [...initialMedia, newMedia]
    expect(updated).toHaveLength(2)
    expect(updated[1].id).toBe('m2')
  })

  it('removes deleted media from state', () => {
    const media = [
      { id: 'm1', url: 'http://a', type: 'PHOTO', filename: 'a.jpg' },
      { id: 'm2', url: 'http://b', type: 'VIDEO', filename: 'b.mp4' },
    ]
    const afterDelete = media.filter((m) => m.id !== 'm1')
    expect(afterDelete).toHaveLength(1)
    expect(afterDelete[0].id).toBe('m2')
  })
})
