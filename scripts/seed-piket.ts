import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INITIAL_PIKET = [
  { day: 'Senin',   staff: 'ANI, LISA, DANI' },
  { day: 'Selasa',  staff: 'LISA, ELA' },
  { day: 'Rabu',    staff: 'ELA, VIN, DANI' },
  { day: 'Kamis',   staff: '—' },
  { day: "Jum'at",  staff: 'ANI, LISA, VIN' },
  { day: 'Sabtu',   staff: 'DANI, ELA' },
  { day: 'Minggu',  staff: 'ANI, LISA, VIN' },
]

async function main() {
  console.log('-> Seeding Daily Piket configuration...')
  for (const item of INITIAL_PIKET) {
    await prisma.dailyPiket.upsert({
      where: { day: item.day },
      update: {},
      create: item,
    })
  }
  console.log('✅ Daily Piket configuration seeded successfully!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
