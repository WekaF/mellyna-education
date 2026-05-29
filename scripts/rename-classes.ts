import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DAY_LABELS = ['Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu', 'Minggu']
const DAY_PATTERN = DAY_LABELS.join('|')
const NAME_SUFFIX_RE = new RegExp(`\\s+(${DAY_PATTERN})\\s+.+$`)

function stripSuffix(name: string): string {
  return name.replace(NAME_SUFFIX_RE, '').trim()
}

function hasLegacyName(name: string): boolean {
  return NAME_SUFFIX_RE.test(name)
}

async function main() {
  const classes = await prisma.class.findMany({ select: { id: true, name: true } })

  // Only process classes that still have the legacy "X Day Time" pattern
  const legacy = classes.filter(c => hasLegacyName(c.name))
  const clean = classes.filter(c => !hasLegacyName(c.name))

  if (legacy.length === 0) {
    console.log('No legacy class names found — nothing to rename.')
    return
  }

  console.log(`Found ${legacy.length} legacy names to rename. ${clean.length} already clean.`)

  // Existing clean names (to avoid collision)
  const takenNames = new Set(clean.map(c => c.name))

  // Group legacy by base name
  const groups = new Map<string, string[]>()
  for (const cls of legacy) {
    const base = stripSuffix(cls.name)
    if (!groups.has(base)) groups.set(base, [])
    groups.get(base)!.push(cls.id)
  }

  let renamed = 0
  for (const [base, ids] of groups) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    // Find next available letter not already taken
    let letterIndex = 0
    for (let i = 0; i < ids.length; i++) {
      let newName: string
      if (ids.length === 1 && !takenNames.has(base)) {
        newName = base
      } else {
        while (takenNames.has(`${base} ${letters[letterIndex] ?? letterIndex + 1}`)) letterIndex++
        newName = `${base} ${letters[letterIndex] ?? letterIndex + 1}`
        letterIndex++
      }
      takenNames.add(newName)
      const cls = legacy.find(c => c.id === ids[i])!
      await prisma.class.update({ where: { id: ids[i] }, data: { name: newName } })
      console.log(`✓ "${cls.name}" → "${newName}"`)
      renamed++
    }
  }

  console.log(`\nDone: ${renamed} classes renamed.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
