import { PrismaClient, InvoiceStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('-> Seeding Dummy Invoices for Billing Reminder Testing...')

  // 1. Fetch first two students from DB to ensure valid student IDs
  const students = await prisma.student.findMany({
    take: 2,
    include: { parent: true },
  })

  if (students.length < 2) {
    console.error('⚠️ Gagal menemukan minimal 2 siswa di database. Silakan jalankan seeder terlebih dahulu.')
    return
  }

  const s1 = students[0]
  const s2 = students[1]

  // 2. Clear old test invoices for these students to prevent bloating
  await prisma.invoice.deleteMany({
    where: {
      description: {
        in: [
          `Uji Coba SPP Jatuh Tempo 7 Hari - ${s1.name}`,
          `Uji Coba SPP Menunggak - ${s2.name}`,
        ],
      },
    },
  })

  // 3. Create invoice due in exactly 7 days (today + 7 days)
  const due7Days = new Date()
  due7Days.setDate(due7Days.getDate() + 7)
  due7Days.setHours(12, 0, 0, 0) // Mid-day clean date

  const inv1 = await prisma.invoice.create({
    data: {
      id: `test-invoice-due-7-days`,
      studentId: s1.id,
      amount: 275000,
      description: `Uji Coba SPP Jatuh Tempo 7 Hari - ${s1.name}`,
      dueDate: due7Days,
      status: InvoiceStatus.PENDING,
    },
  })

  // 4. Create overdue invoice (today - 3 days)
  const overdueDate = new Date()
  overdueDate.setDate(overdueDate.getDate() - 3)
  overdueDate.setHours(12, 0, 0, 0)

  const inv2 = await prisma.invoice.create({
    data: {
      id: `test-invoice-overdue`,
      studentId: s2.id,
      amount: 320000,
      description: `Uji Coba SPP Menunggak - ${s2.name}`,
      dueDate: overdueDate,
      status: InvoiceStatus.PENDING,
    },
  })

  console.log('✅ Successfully created 2 Dummy Invoices for testing!')
  console.log(`- Invoice 1 (Due in 7 days): ${inv1.id} for Student "${s1.name}" (Parent: ${s1.parent.name}, Due: ${due7Days.toDateString()})`)
  console.log(`- Invoice 2 (Overdue -3 days): ${inv2.id} for Student "${s2.name}" (Parent: ${s2.parent.name}, Due: ${overdueDate.toDateString()})`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
