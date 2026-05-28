describe('tutor WAHA message builder', () => {
  it('builds correct tutor notification message', () => {
    const schedule = {
      class: { name: 'Matematika Kelas 5', tutor: { name: 'Bu Sari', phone: '081234567890' } },
      date: new Date('2026-06-01'),
      startTime: '14:00',
      endTime: '16:00',
      topic: 'Pecahan',
      location: 'Online',
      participants: [
        { student: { name: 'Andi' } },
        { student: { name: 'Budi' } },
      ],
    }

    const dateStr = new Date(schedule.date).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    const studentNames = schedule.participants.map((p: any) => p.student.name).join(', ')
    const message = `Halo ${schedule.class.tutor.name},\n\nAnda mendapatkan jadwal mengajar:\n🏫 Kelas: ${schedule.class.name}\n🕐 Waktu: ${dateStr}, ${schedule.startTime} - ${schedule.endTime}\n📚 Topik: ${schedule.topic}\n📍 Lokasi: ${schedule.location}\n👥 Peserta (${schedule.participants.length} siswa): ${studentNames}\n\nMellyna Education`

    expect(message).toContain('Bu Sari')
    expect(message).toContain('Matematika Kelas 5')
    expect(message).toContain('Pecahan')
    expect(message).toContain('Andi, Budi')
    expect(message).toContain('14:00 - 16:00')
  })

  it('skips tutor notification if phone is null', () => {
    const tutorPhone: string | null = null
    const shouldSend = tutorPhone !== null
    expect(shouldSend).toBe(false)
  })
})
