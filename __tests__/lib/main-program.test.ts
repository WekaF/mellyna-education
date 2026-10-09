jest.mock('@/lib/db', () => ({
  prisma: { mainProgram: { findUnique: jest.fn(), findMany: jest.fn() } },
}))

import { prisma } from '@/lib/db'
import { toMainProgramCode, sessionTopic, resolveMainProgram } from '@/lib/main-program'
import { isEnumProgram } from '@/lib/program-config'

describe('toMainProgramCode', () => {
  it('uppercases and joins words with underscore', () => {
    expect(toMainProgramCode('Coding Kids')).toBe('CODING_KIDS')
    expect(toMainProgramCode('  bahasa-arab  ')).toBe('BAHASA_ARAB')
  })
  it('returns empty string for no alphanumerics', () => {
    expect(toMainProgramCode('!!!')).toBe('')
  })
})

describe('isEnumProgram', () => {
  it('detects legacy enum codes', () => {
    expect(isEnumProgram('SEMPOA')).toBe(true)
    expect(isEnumProgram('CODING')).toBe(false)
  })
})

describe('sessionTopic', () => {
  it('uses sub-programs when present', () => {
    expect(sessionTopic({ mainProgram: 'SEMPOA', programs: [{ program: 'SEMPOA' }, { program: 'AHE' }] }))
      .toBe('Sesi Belajar SEMPOA + AHE - Rutin')
  })
  it('falls back to main program', () => {
    expect(sessionTopic({ mainProgram: 'CODING', programs: [] })).toBe('Sesi Belajar CODING - Rutin')
  })
  it('falls back to "Kelas" when nothing set', () => {
    expect(sessionTopic({ mainProgram: null, programs: [] })).toBe('Sesi Belajar Kelas - Rutin')
  })
})

describe('resolveMainProgram', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns requested code when it exists', async () => {
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue({ code: 'CODING' })
    await expect(resolveMainProgram('CODING', [])).resolves.toBe('CODING')
  })
  it('returns undefined when requested code is unknown', async () => {
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue(null)
    await expect(resolveMainProgram('XYZ', [])).resolves.toBeUndefined()
  })
  it('picks first program that is a main program', async () => {
    ;(prisma.mainProgram.findMany as jest.Mock).mockResolvedValue([{ code: 'SEMPOA' }])
    await expect(resolveMainProgram(undefined, ['AHE', 'SEMPOA'])).resolves.toBe('SEMPOA')
  })
  it('returns null without querying when nothing given', async () => {
    await expect(resolveMainProgram(undefined, [])).resolves.toBeNull()
    expect(prisma.mainProgram.findMany).not.toHaveBeenCalled()
  })
})
