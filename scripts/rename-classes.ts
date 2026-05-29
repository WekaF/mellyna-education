import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DAY_LABELS = ['Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu', 'Minggu']
const DAY_PATTERN = DAY_LABELS.join('|')
const NAME_SUFFIX_RE = new RegExp(`\\s+(${DAY_PATTERN})\\s+\\S+$`)

function stripSuffix(name: string): string {
  return name.replace(NAME_SUFFIX_RE, '').trim()
}

async function main() {
  const classes = await prisma.class.findMany({ select: { id: true, name: true } })

  // Group by base name (after stripping day/time suffix)
  const groups = new Map<string, string[]>()
  for (const cls of classes) {
    const base = stripSuffix(cls.name)
    if (!groups.has(base)) groups.set(base, [])
    groups.get(base)!.push(cls.id)
  }

  let renamed = 0
  for (const [base, ids] of groups) {
    if (ids.length === 1) {
      // Only one class with this base — rename to base directly
      const cls = classes.find(c => c.id === ids[0])!
      if (cls.name !== base) {
        await prisma.class.update({ where: { id: ids[0] }, data: { name: base } })
        console.log(`✓ "${cls.name}" → "${base}"`)
        renamed++
      }
    } else {
      // Multiple classes with same base — append A, B, C...
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      for (let i = 0; i < ids.length; i++) {
        const newName = `${base} ${letters[i] ?? i + 1}`
        const cls = classes.find(c => c.id === ids[i])!
        if (cls.name !== newName) {
          await prisma.class.update({ where: { id: ids[i] }, data: { name: newName } })
          console.log(`✓ "${cls.name}" → "${newName}"`)
          renamed++
        }
      }
    }
  }

  console.log(`\nDone: ${renamed} classes renamed.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
