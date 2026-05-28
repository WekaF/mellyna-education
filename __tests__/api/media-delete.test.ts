import { deleteFile } from '@/lib/storage'

describe('deleteFile', () => {
  it('exports deleteFile as a function', () => {
    expect(typeof deleteFile).toBe('function')
  })
})
