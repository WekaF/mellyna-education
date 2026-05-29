import { PrismaClient, Program } from '@prisma/client'

const prisma = new PrismaClient()

const SUBJECT_TO_PROGRAMS: Record<string, Program[]> = {
  'SEMPOA':          ['SEMPOA'],
  'EYL SEMPOA':      ['EYL', 'SEMPOA'],
  'SEMPOA AHE':      ['SEMPOA', 'AHE'],
  'AHE SEMPOA EFK':  ['AHE', 'SEMPOA', 'EFK'],
  'SEMPOA EFE':      ['SEMPOA', 'EFE'],
  'CALISTUNG':       ['CALISTUNG'],
  'ENGLISH':         ['ENGLISH'],
}

async function main() {
  // subject column was dropped — this script has already run and is kept for reference only
  const classes = await (prisma.class as any).findMany({ select: { id: true, subject: true } })
  let ok = 0, warn = 0

  for (const cls of classes) {
    const programs = SUBJECT_TO_PROGRAMS[(cls as any).subject] ?? []
    if (programs.length === 0) {
      console.warn(`WARN: Unknown subject "${(cls as any).subject}" for class ${cls.id} — skipping`)
      warn++
      continue
    }
    await prisma.classProgram.createMany({
      data: programs.map(program => ({ classId: cls.id, program })),
      skipDuplicates: true,
    })
    console.log(`✓ ${cls.id} (${(cls as any).subject}) → [${programs.join(', ')}]`)
    ok++
  }

  console.log(`\nDone: ${ok} migrated, ${warn} warnings`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
