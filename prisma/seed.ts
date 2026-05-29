import { PrismaClient, Role, ScheduleStatus, InvoiceStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = (pw: string) => bcrypt.hash(pw, 12)

  console.log(' Wiping existing database tables to delete all dummy data...')
  
  // Wipe tables in correct order of dependency
  await prisma.media.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.attendance.deleteMany()
  await prisma.learningReport.deleteMany()
  await prisma.enrollment.deleteMany()
  await prisma.student.deleteMany()
  await prisma.schedule.deleteMany()
  await prisma.class.deleteMany()
  await prisma.announcement.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()

  console.log('✅ Wiped out all old dummy data successfully!')

  // 1. Create Super Admin
  const adminPassword = await hash('admin123')
  const admin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'admin@mellyna.id',
      password: adminPassword,
      role: Role.SUPER_ADMIN,
      phone: '6281234567890',
    },
  })

  // 2. Create 3 Tutors
  const tutorPassword = await hash('tutor123')
  const tutors = []
  const tutorData = [
    { name: 'Pak Budi', email: 'tutor@mellyna.id', phone: '6281234567891' },
    { name: 'Ibu Linda', email: 'tutor.linda@mellyna.id', phone: '6281234567894' },
    { name: 'Pak Heri', email: 'tutor.heri@mellyna.id', phone: '6281234567895' },
  ]

  for (const t of tutorData) {
    const user = await prisma.user.create({
      data: {
        name: t.name,
        email: t.email,
        password: tutorPassword,
        role: Role.TUTOR,
        phone: t.phone,
      }
    })
    tutors.push(user)
  }

  // 3. Create 20 Parent Accounts
  console.log('-> Creating 20 Parent Accounts...')
  const parentPassword = await hash('parent123')
  const parents = []
  
  const parentNames = [
    'Bunda Almeer', 'Bunda Izora', 'Ayah Aye', 'Bunda Keysa', 'Ayah Adrian',
    'Bunda Alinda', 'Bunda Memey', 'Ayah Naura', 'Bunda Karin', 'Ayah Zidna',
    'Bunda Ozil', 'Ayah Vina', 'Bunda Silva', 'Ayah Kayra', 'Bunda Glen',
    'Ayah Haikal', 'Bunda Dita', 'Ayah Alby', 'Bunda Ela', 'Ayah Najwa'
  ]

  for (let i = 0; i < parentNames.length; i++) {
    const email = i === 0 ? 'parent@mellyna.id' : `parent.${i + 1}@mellyna.id` // parent 1 gets default parent@mellyna.id
    const user = await prisma.user.create({
      data: {
        name: parentNames[i],
        email: email,
        password: parentPassword,
        role: Role.PARENT,
        phone: `62812999900${i + 1 < 10 ? '0' + (i + 1) : i + 1}`,
      }
    })
    parents.push(user)
  }

  // 4. Create 36 Real Students with program and progress notes
  console.log('-> Seeding 36 Real Students...')
  const studentData = [
    // Parent 1 (Bunda Almeer) - 2 children
    { name: 'Almeer', program: 'SEMPOA', notes: 'TB B', parentIdx: 0, joined: null },
    { name: 'Kaisya TK', program: 'EYL SEMPOA', notes: 'TB B', parentIdx: 0, joined: null },
    // Parent 2 (Bunda Izora) - 2 children
    { name: 'Izora', program: 'SEMPOA', notes: 'TB B', parentIdx: 1, joined: null },
    { name: 'Zafran', program: 'SEMPOA', notes: 'TB B', parentIdx: 1, joined: null },
    // Parent 3 (Ayah Aye) - 2 children
    { name: 'Aye', program: 'SEMPOA', notes: 'TKB', parentIdx: 2, joined: null },
    { name: 'GILANG', program: 'SEMPOA', notes: 'TKB', parentIdx: 2, joined: null },
    // Parent 4 (Bunda Keysa) - 2 children
    { name: 'KEYSA SD', program: 'SEMPOA', notes: 'TKB', parentIdx: 3, joined: null },
    { name: 'Kayzan', program: 'SEMPOA', notes: 'TKB', parentIdx: 3, joined: null },
    // Parent 5 (Ayah Adrian) - 2 children
    { name: 'Adrian', program: 'EYL SEMPOA', notes: '', parentIdx: 4, joined: null },
    { name: 'Raya', program: 'SEMPOA', notes: 'TKB', parentIdx: 4, joined: null },
    // Parent 6 (Bunda Alinda) - 2 children
    { name: 'Alinda', program: 'SEMPOA', notes: 'TB B', parentIdx: 5, joined: null },
    { name: 'Uwais', program: 'SEMPOA', notes: 'TKB', parentIdx: 5, joined: null },
    // Parent 7 (Bunda Memey) - 2 children
    { name: 'Memey', program: 'SEMPOA', notes: 'GAB A', parentIdx: 6, joined: null },
    { name: 'Vira', program: 'SEMPOA', notes: 'GAB B', parentIdx: 6, joined: null },
    // Parent 8 (Ayah Naura) - 2 children
    { name: 'Naura', program: 'SEMPOA', notes: 'GAB A, lat soal tdk teliti dr TB A', parentIdx: 7, joined: null },
    { name: 'Ramdan', program: 'SEMPOA AHE', notes: 'TK B', parentIdx: 7, joined: null },
    // Parent 9 (Bunda Karin) - 2 children
    { name: 'Karin', program: 'SEMPOA', notes: 'TB A', parentIdx: 8, joined: null },
    { name: 'Gita', program: 'EYL SEMPOA', notes: 'TB B', parentIdx: 8, joined: '2025-11-30' },
    // Parent 10 (Ayah Zidna) - 2 children
    { name: 'Zidna', program: 'AHE SEMPOA EFK', notes: 'TK A', parentIdx: 9, joined: '2025-12-01' },
    { name: 'Fatih', program: 'SEMPOA', notes: 'TK B', parentIdx: 9, joined: '2025-12-16' },
    // Parent 11 (Bunda Ozil) - 2 children
    { name: 'Ozil', program: 'EYL SEMPOA', notes: 'TK B EVALUASI', parentIdx: 10, joined: '2026-01-05' },
    { name: 'FANIA', program: 'AHE SEMPOA EFK', notes: 'introduction, color, numbers, frutis, part of body', parentIdx: 10, joined: '2026-01-05' },
    // Parent 12 (Ayah Vina) - 2 children (Vina&WAWAN split)
    { name: 'Vina', program: 'SEMPOA', notes: 'TB B', parentIdx: 11, joined: '2025-09-30' },
    { name: 'Wawan', program: 'SEMPOA', notes: 'TB B', parentIdx: 11, joined: '2025-09-30' },
    // Parent 13 (Bunda Silva) - 2 children
    { name: 'Silva', program: 'SEMPOA', notes: 'TB A', parentIdx: 12, joined: '2026-01-04' },
    { name: 'MITA', program: 'AHE SEMPOA EFK', notes: 'WA', parentIdx: 12, joined: '2026-01-05' },
    // Parent 14 (Ayah Kayra) - 2 children
    { name: 'KAYRA', program: 'SEMPOA EFE', notes: 'TKB', parentIdx: 13, joined: '2026-01-14' },
    { name: 'IRSYA', program: 'SEMPOA', notes: 'TB B', parentIdx: 13, joined: '2026-01-15' },
    // Parent 15 (Bunda Glen) - 2 children
    { name: 'GLEN', program: 'SEMPOA AHE', notes: '', parentIdx: 14, joined: '2026-01-09' },
    { name: 'GISYA', program: 'SEMPOA', notes: '', parentIdx: 14, joined: '2026-02-08' },
    // Parent 16 (Ayah Haikal) - 2 children
    { name: 'HAIKAL', program: 'SEMPOA', notes: 'TB B', parentIdx: 15, joined: '2026-01-16' },
    { name: 'ADIT', program: 'SEMPOA', notes: '', parentIdx: 15, joined: '2026-02-01' },
    // Parent 17 (Bunda Dita) - 1 child
    { name: 'DITA', program: 'SEMPOA', notes: '', parentIdx: 16, joined: '2026-02-15' },
    // Parent 18 (Ayah Alby) - 1 child
    { name: 'ALBY', program: 'SEMPOA', notes: '', parentIdx: 17, joined: '2026-02-13' },
    // Parent 19 (Bunda Ela) - 1 child
    { name: 'ELA', program: 'SEMPOA EFE', notes: '', parentIdx: 18, joined: '2026-02-16' },
    // Parent 20 (Ayah Najwa) - 1 child
    { name: 'NAJWA', program: 'SEMPOA', notes: '', parentIdx: 19, joined: '2026-02-23' },
  ]

  const students = []
  for (let i = 0; i < studentData.length; i++) {
    const sd = studentData[i]
    const parent = parents[sd.parentIdx]
    const createdDate = sd.joined ? new Date(sd.joined) : new Date('2025-08-01') // Default start date or real joined date

    const s = await prisma.student.create({
      data: {
        id: `real-student-${i + 1}`,
        name: sd.name,
        grade: `${sd.program} (${sd.notes || 'No Progress'})`,
        notes: `Program: ${sd.program} | Progres: ${sd.notes || '-'}`,
        parentId: parent.id,
        createdAt: createdDate,
      }
    })
    students.push(s)
  }

  // 5. Create 6 Academic Classes
  console.log('-> Creating 6 Classes...')
  const classes = []
  const classData = [
    { name: 'Sempoa Kelas A',   programs: ['SEMPOA'],               desc: 'Kelas pembelajaran sempoa tingkat dasar A' },
    { name: 'Sempoa Kelas B',   programs: ['SEMPOA'],               desc: 'Kelas pembelajaran sempoa tingkat menengah B' },
    { name: 'Sempoa Kelas EYL', programs: ['EYL', 'SEMPOA'],        desc: 'English for Young Learners Sempoa khusus TK-SD' },
    { name: 'Sempoa Kelas AHE', programs: ['SEMPOA', 'AHE'],        desc: 'Metode AHE Anak Hebat Sempoa Terpadu' },
    { name: 'Sempoa Kelas EFK', programs: ['AHE', 'SEMPOA', 'EFK'], desc: 'Kelas Calistung dan Sempoa EFK' },
    { name: 'Sempoa Kelas EFE', programs: ['SEMPOA', 'EFE'],        desc: 'Sesi latihan Sempoa EFE intensif' },
  ]

  for (let i = 0; i < classData.length; i++) {
    const tutor = tutors[i % tutors.length]
    const c = await prisma.class.create({
      data: {
        id: `real-class-${i + 1}`,
        name: classData[i].name,
        description: classData[i].desc,
        tutorId: tutor.id,
        programs: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: classData[i].programs.map((program) => ({ program: program as any })),
        },
      }
    })
    classes.push(c)

    // Enroll first 3 students per class
    for (const student of students.slice(0, 3)) {
      await prisma.enrollment.upsert({
        where: { studentId_classId: { studentId: student.id, classId: c.id } },
        update: {},
        create: { studentId: student.id, classId: c.id },
      })
    }
  }

  // 6. Create 10 Upcoming Schedules
  console.log('-> Creating 10 Schedules...')
  for (let i = 0; i < 10; i++) {
    const date = new Date()
    date.setDate(date.getDate() + (i + 1)) // Future dates

    const startTimes = ['08:00', '10:00', '13:00', '15:30', '19:00']
    const endTimes = ['10:00', '12:00', '15:00', '17:30', '21:00']
    const timeIdx = i % 5

    await prisma.schedule.create({
      data: {
        id: `real-schedule-${i + 1}`,
        classId: classes[i % classes.length].id,
        date: date,
        startTime: startTimes[timeIdx],
        endTime: endTimes[timeIdx],
        topic: `Sesi Belajar ${classes[i % classes.length].name} - Modul Ke-${i + 1}`,
        location: i % 2 === 0 ? 'Ruang Belajar Utama' : 'Ruang Belajar B',
        status: ScheduleStatus.PUBLISHED,
        publishedAt: new Date(),
      }
    })
  }

  // 7. Create 10 Invoices
  console.log('-> Creating 10 Invoices...')
  for (let i = 0; i < 10; i++) {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + (i * 3) + 7) 

    const student = students[i * 3] // Assign invoices to some real students
    const amount = 250000 

    await prisma.invoice.create({
      data: {
        id: `real-invoice-${i + 1}`,
        studentId: student.id,
        amount: amount,
        description: `SPP Bulan Juni 2026 - ${student.name}`,
        dueDate: dueDate,
        status: i < 3 ? InvoiceStatus.PAID : InvoiceStatus.PENDING,
        paidAt: i < 3 ? new Date() : null,
      }
    })
  }

  // 8. Create 10 Announcements
  console.log('-> Creating 10 Announcements...')
  const announcementData = [
    { title: 'Pembagian Buku Modul Sempoa Baru', content: 'Buku panduan dan modul sempoa edisi revisi terbaru sudah tiba di bimbel. Orang tua dapat mengambilnya langsung di kantor administrasi pada jam kerja.' },
    { title: 'Jadwal Libur Idul Adha 2026', content: 'Diberitahukan kepada seluruh siswa dan wali murid bahwa kegiatan belajar mengajar diliburkan sementara selama hari raya Idul Adha.' },
    { title: 'Workshop Mental Aritmatika', content: 'Kami menyelenggarakan workshop khusus mental aritmatika dasar guna melatih ketangkasan berhitung kilat anak tanpa alat bantu.' },
    { title: 'Simulasi Try-Out Sempoa Bulanan', content: 'Simulasi ujian sempoa berkala akan dilaksanakan pada Sabtu ini untuk menguji pencapaian bab (TKB, TB B, dsb.) siswa.' },
    { title: 'Evaluasi Pembelajaran Kelas EYL', content: 'Mengingatkan wali murid EYL Sempoa bahwa sesi evaluasi portofolio belajar anak akan diadakan bersama tutor pendamping minggu ini.' },
    { title: 'Tips Latihan Sempoa di Rumah', content: 'Ajak anak berlatih 10 menit setiap hari secara konsisten. Ini jauh lebih efektif dibanding latihan 1 jam penuh hanya sekali seminggu.' },
    { title: 'Integrasi Pembayaran Digital Midtrans', content: 'Untuk mempermudah wali murid, pembayaran SPP kini mendukung QRIS, GoPay, OVO, ShopeePay, serta Virtual Account Bank Mandiri/BCA secara instan.' },
    { title: 'Konsultasi Belajar Tatap Muka Gratis', content: 'Orang tua siswa dapat menjadwalkan konsultasi tatap muka gratis dengan tim psikolog belajar kami untuk mendiskusikan hambatan belajar anak.' },
    { title: 'Laporan Progres Belajar Rilis', content: 'Laporan perkembangan (rapor bulanan) siswa sudah diunggah oleh para tutor. Silakan cek menu Laporan Perkembangan pada dashboard Anda.' },
    { title: 'Layanan WhatsApp Notifikasi Jadwal Aktif', content: 'Sistem notifikasi WhatsApp otomatis via WAHA telah aktif. Anda akan menerima rincian kelas secara berkala langsung ke nomor handphone terdaftar.' },
  ]

  for (let i = 0; i < announcementData.length; i++) {
    await prisma.announcement.create({
      data: {
        id: `real-announcement-${i + 1}`,
        title: announcementData[i].title,
        content: announcementData[i].content,
        authorId: admin.id,
        published: true,
      }
    })
  }

  console.log('[Mellyna Education] Real Students Seeding Completed Successfully! 🚀')
}

main().catch(console.error).finally(() => prisma.$disconnect())
