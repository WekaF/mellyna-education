import { readFileSync } from 'fs'
import { join } from 'path'

// ponytail: cek teks config, bukan import next.config (withPWA berat di jest). Ganti ke import kalau securityHeaders dipindah ke modul sendiri.
describe('Permissions-Policy header', () => {
  const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')

  it('allows geolocation for own origin (needed for tutor check-in)', () => {
    expect(config).toMatch(/geolocation=\(self\)/)
  })

  it('does not block geolocation for every origin', () => {
    expect(config).not.toMatch(/geolocation=\(\)/)
  })
})
