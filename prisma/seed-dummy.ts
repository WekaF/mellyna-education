import { PrismaClient, Role, ScheduleStatus, InvoiceStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = (pw: string) => bcrypt.hash(pw, 12)

  // 1. Get or Create Super Admin (for Announcements author)
  let admin = await prisma.user.findUnique({
    where: { email: 'admin@mellyna.id' }
  })
  
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: 'admin@mellyna.id',
        password: await hash('admin123'),
        role: Role.SUPER_ADMIN,
        phone: '6281234567890',
      }
    })
  }

  // 2. Get or Create Parent (Bu Sari) for mapping additional students
  let parent = await prisma.user.findUnique({
    where: { email: 'parent@mellyna.id' }
  })
  
  if (!parent) {
    parent = await prisma.user.create({
      data: {
        name: 'Bu Sari',
        email: 'parent@mellyna.id',
        password: await hash('parent123'),
        role: Role.PARENT,
        phone: '6281234567892',
      }
    })
  }

  // Get or Create Parent 2 (Bu Shinta) to demonstrate student filtering
  let parent2 = await prisma.user.findUnique({
    where: { email: 'parent2@mellyna.id' }
  })
  
  if (!parent2) {
    parent2 = await prisma.user.create({
      data: {
        name: 'Bu Shinta',
        email: 'parent2@mellyna.id',
        password: await hash('parent123'),
        role: Role.PARENT,
        phone: '6281234567893',
      }
    })
  }

  // 3. Get or Create Student
  let primaryStudent = await prisma.student.findUnique({
    where: { id: 'seed-student-1' }
  })

  if (!primaryStudent) {
    primaryStudent = await prisma.student.create({
      data: {
        id: 'seed-student-1',
        name: 'Andi Pratama',
        grade: 'Kelas 5 SD',
        parentId: parent.id,
      }
    })
  } else {
    // Make sure Andi is assigned to parent 1
    await prisma.student.update({
      where: { id: 'seed-student-1' },
      data: { parentId: parent.id }
    })
  }

  // Create additional students and assign them properly:
  // - Budi Santoso (assigned to Bu Sari / parent 1)
  // - Chandra Wijaya & Dewi Lestari (assigned to Bu Shinta / parent 2)
  const studentData = [
    { id: 'dummy-student-1', name: 'Budi Santoso', grade: 'Kelas 4 SD', parentId: parent.id },
    { id: 'dummy-student-2', name: 'Chandra Wijaya', grade: 'Kelas 5 SD', parentId: parent2.id },
    { id: 'dummy-student-3', name: 'Dewi Lestari', grade: 'Kelas 6 SD', parentId: parent2.id },
  ]
  const additionalStudents = []
  
  for (const s of studentData) {
    const student = await prisma.student.upsert({
      where: { id: s.id },
      update: { parentId: s.parentId },
      create: {
        id: s.id,
        name: s.name,
        grade: s.grade,
        parentId: s.parentId,
      }
    })
    additionalStudents.push(student)
  }
  
  const allStudents = [primaryStudent, ...additionalStudents]

  console.log('-> Seeding 10 Tutors...')
  const tutors = []
  const tutorData = [
    { name: 'Tutor Budi', email: 'tutor.budi@mellyna.id', phone: '6281200000001' },
    { name: 'Tutor Cici', email: 'tutor.cici@mellyna.id', phone: '6281200000002' },
    { name: 'Tutor Dedi', email: 'tutor.dedi@mellyna.id', phone: '6281200000003' },
    { name: 'Tutor Efi', email: 'tutor.efi@mellyna.id', phone: '6281200000004' },
    { name: 'Tutor Fani', email: 'tutor.fani@mellyna.id', phone: '6281200000005' },
    { name: 'Tutor Gani', email: 'tutor.gani@mellyna.id', phone: '6281200000006' },
    { name: 'Tutor Hari', email: 'tutor.hari@mellyna.id', phone: '6281200000007' },
    { name: 'Tutor Indah', email: 'tutor.indah@mellyna.id', phone: '6281200000008' },
    { name: 'Tutor Joko', email: 'tutor.joko@mellyna.id', phone: '6281200000009' },
    { name: 'Tutor Kiki', email: 'tutor.kiki@mellyna.id', phone: '6281200000010' },
  ]

  for (const t of tutorData) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: {
        name: t.name,
        email: t.email,
        password: await hash('tutor123'),
        role: Role.TUTOR,
        phone: t.phone,
      }
    })
    tutors.push(user)
  }

  console.log('-> Seeding 10 Classes...')
  const classes = []
  const classData = [
    { name: 'Matematika SD 6',           programs: ['SEMPOA'],            desc: 'Pendalaman materi ujian sekolah SD kelas 6' },
    { name: 'Fisika SMP 8',              programs: ['SEMPOA'],            desc: 'Membahas bab mekanika dan termodinamika dasar' },
    { name: 'Kimia SMA 10',              programs: ['SEMPOA'],            desc: 'Membahas pengenalan tabel periodik dan stoikiometri' },
    { name: 'Bahasa Inggris Percakapan', programs: ['ENGLISH'],           desc: 'Praktik berbicara aktif sehari-hari' },
    { name: 'Biologi SMP 9',             programs: ['SEMPOA'],            desc: 'Pendalaman materi sistem pencernaan dan ekosistem' },
    { name: 'IPS Dasar',                 programs: ['SEMPOA'],            desc: 'Pengenalan sejarah nasional dan geografi regional' },
    { name: 'PKN Menengah',              programs: ['SEMPOA'],            desc: 'Pemahaman nilai pancasila dan tata negara dasar' },
    { name: 'Belajar Membaca',           programs: ['CALISTUNG'],         desc: 'Bimbingan calistung untuk anak usia dini (PAUD/TK)' },
    { name: 'Algoritma Dasar',           programs: ['SEMPOA'],            desc: 'Pengenalan pemrograman dengan bahasa visual Scratch' },
    { name: 'Persiapan UTBK',            programs: ['SEMPOA', 'ENGLISH'], desc: 'Latihan soal skolastik dan pembahasan intensif' },
  ]

  for (let i = 0; i < classData.length; i++) {
    const c = await prisma.class.upsert({
      where: { id: `dummy-class-${i + 1}` },
      update: {},
      create: {
        id: `dummy-class-${i + 1}`,
        name: classData[i].name,
        description: classData[i].desc,
        tutorId: tutors[i].id,
        programs: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: classData[i].programs.map((program) => ({ program: program as any })),
        },
      }
    })
    classes.push(c)

    // Enroll students randomly to these new classes so they show up in lists
    for (const student of allStudents) {
      if (Math.random() > 0.4) {
        await prisma.enrollment.upsert({
          where: { studentId_classId: { studentId: student.id, classId: c.id } },
          update: {},
          create: {
            studentId: student.id,
            classId: c.id,
          }
        })
      }
    }
  }

  console.log('-> Seeding 10 Schedules...')
  for (let i = 0; i < 10; i++) {
    const date = new Date()
    date.setDate(date.getDate() + (i + 1)) // Spread schedules in upcoming days

    const startTimes = ['08:00', '10:00', '13:00', '15:30', '19:00']
    const endTimes = ['10:00', '12:00', '15:00', '17:30', '21:00']
    const timeIdx = i % 5

    await prisma.schedule.upsert({
      where: { id: `dummy-schedule-${i + 1}` },
      update: {},
      create: {
        id: `dummy-schedule-${i + 1}`,
        classId: classes[i].id,
        date: date,
        startTime: startTimes[timeIdx],
        endTime: endTimes[timeIdx],
        topic: `Pertemuan Ke-${i + 1}: Pembahasan Modul Utama`,
        location: Math.random() > 0.5 ? 'Ruang Kelas A' : 'Ruang Kelas B',
        status: ScheduleStatus.PUBLISHED,
        publishedAt: new Date(),
      }
    })
  }

  console.log('-> Seeding 10 Invoices...')
  for (let i = 0; i < 10; i++) {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + (i * 3) + 5) // due dates scattered in next 30 days

    const student = allStudents[i % allStudents.length]
    const amount = 200000 + (i * 25000) // prices from 200k to 425k

    await prisma.invoice.upsert({
      where: { id: `dummy-invoice-${i + 1}` },
      update: {},
      create: {
        id: `dummy-invoice-${i + 1}`,
        studentId: student.id,
        amount: amount,
        description: `SPP Bimbingan Belajar Bulan ${dueDate.toLocaleString('id-ID', { month: 'long' })} - ${student.name}`,
        dueDate: dueDate,
        status: i < 3 ? InvoiceStatus.PAID : InvoiceStatus.PENDING, // seed a few paid ones too
        paidAt: i < 3 ? new Date() : null,
      }
    })
  }

  console.log('-> Seeding 10 Announcements...')
  const announcementData = [
    { title: 'Libur Hari Raya Keagamaan', content: 'Diberitahukan kepada seluruh siswa dan wali murid bahwa kegiatan belajar mengajar akan diliburkan sementara untuk menghormati hari raya keagamaan nasional.' },
    { title: 'Pendaftaran Bimbel Gelombang Baru', content: 'Pendaftaran untuk bimbingan belajar intensif semester ganjil kini telah dibuka. Dapatkan diskon 15% untuk pendaftar sebelum akhir bulan ini.' },
    { title: 'Jadwal Simulasi Ujian Akhir', content: 'Simulasi ujian akhir (try-out) tingkat nasional akan diselenggarakan hari Sabtu ini secara serentak untuk mengukur kesiapan mental dan akademis siswa.' },
    { title: 'Workshop Parenting Gratis', content: 'Ikuti workshop bertajuk "Mendampingi Belajar Anak Tanpa Stres di Rumah" bersama psikolog terkemuka, khusus gratis untuk orang tua siswa Mellyna.' },
    { title: 'Pembagian Buku Panduan Belajar', content: 'Buku modul pembelajaran terpadu edisi revisi terbaru sudah tersedia di resepsionis. Siswa dapat mengambilnya dengan membawa bukti pendaftaran.' },
    { title: 'Pengumuman Pemenang Kuis Bulanan', content: 'Selamat kepada para pemenang kuis akademis bulanan yang berhasil mendapatkan nilai sempurna dalam pemecahan masalah logika terapan.' },
    { title: 'Tips Menghadapi Ujian Tanpa Gugup', content: 'Tips utama untuk meraih hasil terbaik: atur jadwal tidur, pelajari poin-poin ringkasan materi, dan pastikan sarapan pagi sebelum ujian dimulai.' },
    { title: 'Layanan Pembagian Rapor Bulanan', content: 'Laporan perkembangan belajar (rapor) untuk bulan ini sudah dirilis. Orang tua dapat melihat grafik nilai dan catatan tutor di panel dashboard masing-masing.' },
    { title: 'Hari Konsultasi Siswa & Orang Tua', content: 'Kami membuka layanan sesi tatap muka interaktif antara orang tua, siswa, dan tim tutor untuk mendiskusikan target universitas maupun perbaikan nilai.' },
    { title: 'Kemudahan Pembayaran SPP lewat Midtrans', content: 'Pembayaran biaya SPP bulanan kini lebih mudah, aman, dan instan menggunakan metode Virtual Account, E-Wallet (GoPay/ShopeePay), dan QRIS via Midtrans.' },
  ]

  for (let i = 0; i < announcementData.length; i++) {
    await prisma.announcement.upsert({
      where: { id: `dummy-announcement-${i + 1}` },
      update: {},
      create: {
        id: `dummy-announcement-${i + 1}`,
        title: announcementData[i].title,
        content: announcementData[i].content,
        authorId: admin.id,
        published: true,
      }
    })
  }

  console.log('[Mellyna Education] Dummy Seeding Complete!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
