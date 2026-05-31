import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const classes = await prisma.class.findMany({
    where: { mainProgram: null },
    include: { programs: { take: 1, orderBy: { program: 'asc' } } },
  })

  console.log(`Found ${classes.length} classes without mainProgram`)

  for (const kelas of classes) {
    const mainProgram = kelas.programs[0]?.program ?? 'SEMPOA'
    await prisma.class.update({
      where: { id: kelas.id },
      data: { mainProgram },
    })
    console.log(`  ${kelas.name} → mainProgram: ${mainProgram}`)
  }

  console.log('Done.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
