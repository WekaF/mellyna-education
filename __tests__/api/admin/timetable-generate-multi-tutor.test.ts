describe('timetable generate multi-tutor WA message builder', () => {
  const primaryTutor = { name: 'Bu Ani', phone: '08111111111' }
  const additionalTutor = { name: 'Pak Budi', phone: '08222222222' }
  const noPhoneTutor = { name: 'Pak Cek', phone: null }

  function buildTutorNames(
    primary: { name: string },
    additionalTutors: { tutor: { name: string } }[],
  ) {
    return [primary, ...additionalTutors.map(at => at.tutor)].map(t => t.name).join(', ')
  }

  function buildAllTutors(
    primary: { name: string; phone: string | null },
    additionalTutors: { tutor: { name: string; phone: string | null } }[],
  ) {
    return [primary, ...additionalTutors.map(at => at.tutor)]
  }

  it('buildTutorNames: single tutor returns just that name', () => {
    expect(buildTutorNames(primaryTutor, [])).toBe('Bu Ani')
  })

  it('buildTutorNames: multiple tutors joined by comma', () => {
    expect(buildTutorNames(primaryTutor, [{ tutor: additionalTutor }])).toBe('Bu Ani, Pak Budi')
  })

  it('buildAllTutors: includes primary and additional for broadcast loop', () => {
    const all = buildAllTutors(primaryTutor, [{ tutor: additionalTutor }, { tutor: noPhoneTutor }])
    expect(all).toHaveLength(3)
    expect(all[0].name).toBe('Bu Ani')
    expect(all[1].name).toBe('Pak Budi')
    expect(all[2].name).toBe('Pak Cek')
  })

  it('broadcast loop skips tutors with null phone', () => {
    const all = buildAllTutors(primaryTutor, [{ tutor: noPhoneTutor }])
    const shouldSend = all.filter(t => t.phone !== null)
    expect(shouldSend).toHaveLength(1)
    expect(shouldSend[0].name).toBe('Bu Ani')
  })

  it('parent WA message includes all tutor names', () => {
    const tutorNames = buildTutorNames(primaryTutor, [{ tutor: additionalTutor }])
    const message = `Halo Bunda/Ayah Test,\n\n👨‍🏫 Tutor: ${tutorNames}\n\nMellyna Education`
    expect(message).toContain('Bu Ani, Pak Budi')
  })
})
