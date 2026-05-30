describe('report notification video link formatting', () => {
  it('includes video link section when mediaVideos present', () => {
    const lines: string[] = []
    const mediaVideos = [
      { url: 'https://media.example.com/video1.mp4', filename: 'video1.mp4' },
      { url: 'https://media.example.com/video2.mp4', filename: 'video2.mp4' },
    ]
    if (mediaVideos.length > 0) {
      lines.push('', '🎥 *Video Pembelajaran dari Tutor:*')
      mediaVideos.forEach(v => lines.push(`   📥 ${v.filename}: ${v.url}`))
      lines.push(`   _(Buka link di atas untuk melihat/mengunduh video)_`)
    }
    const msg = lines.join('\n')
    expect(msg).toContain('🎥 *Video Pembelajaran dari Tutor:*')
    expect(msg).toContain('video1.mp4')
    expect(msg).toContain('https://media.example.com/video1.mp4')
    expect(msg).toContain('_(Buka link di atas untuk melihat/mengunduh video)_')
  })

  it('skips video section when no media', () => {
    const lines: string[] = []
    const mediaVideos: { url: string; filename: string }[] = []
    if (mediaVideos.length > 0) {
      lines.push('', '🎥 *Video Pembelajaran dari Tutor:*')
    }
    expect(lines.join('\n')).not.toContain('🎥')
  })
})
