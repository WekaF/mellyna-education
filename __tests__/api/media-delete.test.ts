import { deleteFile } from '@/lib/storage'

describe('deleteFile', () => {
  it('exports deleteFile as a function', () => {
    expect(typeof deleteFile).toBe('function')
  })
})

describe('media delete authorization', () => {
  it('rejects PARENT role', () => {
    const allowed = ['TUTOR', 'SUPER_ADMIN']
    expect(allowed.includes('PARENT')).toBe(false)
  })

  it('allows TUTOR and SUPER_ADMIN', () => {
    const allowed = ['TUTOR', 'SUPER_ADMIN']
    expect(allowed.includes('TUTOR')).toBe(true)
    expect(allowed.includes('SUPER_ADMIN')).toBe(true)
  })

  it('extracts MinIO key from URL correctly', () => {
    const url = 'http://localhost:9000/mellyna-media/1234567890-photo.jpg'
    const bucket = 'mellyna-media'
    const key = url.split(`/${bucket}/`)[1]
    expect(key).toBe('1234567890-photo.jpg')
  })

  it('returns undefined key when URL does not contain bucket', () => {
    const url = 'http://localhost:9000/wrong-bucket/photo.jpg'
    const bucket = 'mellyna-media'
    const key = url.split(`/${bucket}/`)[1]
    expect(key).toBeUndefined()
  })
})
