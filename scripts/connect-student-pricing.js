const { PrismaClient, Role } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const PARENT_GROUPINGS = [
  { parentName: 'Bunda Almeer', email: 'parent.almeer@mellyna.id', phone: '6281299990001', children: ['ALMEER', 'KAISYA TK'] },
  { parentName: 'Bunda Izora', email: 'parent.izora@mellyna.id', phone: '6281299990002', children: ['IZORA', 'ZAFRAN'] },
  { parentName: 'Ayah Aye', email: 'parent.aye@mellyna.id', phone: '6281299990003', children: ['AYE', 'GILANG'] },
  { parentName: 'Bunda Keysa', email: 'parent.keysa@mellyna.id', phone: '6281299990004', children: ['KEYSA SD', 'KAYZAN'] },
  { parentName: 'Ayah Adrian', email: 'parent.adrian@mellyna.id', phone: '6281299990005', children: ['ADRIAN', 'RAYA'] },
  { parentName: 'Bunda Alinda', email: 'parent.alinda@mellyna.id', phone: '6281299990006', children: ['ALINDA', 'UWAIS'] },
  { parentName: 'Bunda Memey', email: 'parent.memey@mellyna.id', phone: '6281299990007', children: ['MEMEY', 'VIRA'] },
  { parentName: 'Ayah Naura', email: 'parent.naura@mellyna.id', phone: '6281299990008', children: ['NAURA', 'RAMDAN'] },
  { parentName: 'Bunda Karin', email: 'parent.karin@mellyna.id', phone: '6281299990009', children: ['KARIN', 'GITA'] },
  { parentName: 'Ayah Zidna', email: 'parent.zidna@mellyna.id', phone: '6281299990010', children: ['ZIDNA', 'FATIH'] },
  { parentName: 'Bunda Ozil', email: 'parent.ozil@mellyna.id', phone: '6281299990011', children: ['OZIL', 'FANIA'] },
  { parentName: 'Ayah Vina', email: 'parent.vina@mellyna.id', phone: '6281299990012', children: ['VINA', 'WAWAN'] },
  { parentName: 'Bunda Silva', email: 'parent.silva@mellyna.id', phone: '6281299990013', children: ['SILVA', 'MITA'] },
  { parentName: 'Ayah Kayra', email: 'parent.kayra@mellyna.id', phone: '6281299990014', children: ['KAYRA', 'IRSYA'] },
  { parentName: 'Bunda Glen', email: 'parent.glen@mellyna.id', phone: '6281299990015', children: ['GLEN', 'GISYA'] },
  { parentName: 'Ayah Haikal', email: 'parent.haikal@mellyna.id', phone: '6281299990016', children: ['HAIKAL', 'ADIT'] },
  { parentName: 'Bunda Dita', email: 'parent.dita@mellyna.id', phone: '6281299990017', children: ['DITA'] },
  { parentName: 'Ayah Alby', email: 'parent.alby@mellyna.id', phone: '6281299990018', children: ['ALBY'] },
  { parentName: 'Bunda Ela', email: 'parent.ela@mellyna.id', phone: '6281299990019', children: ['ELA'] },
  { parentName: 'Ayah Najwa', email: 'parent.najwa@mellyna.id', phone: '6281299990020', children: ['NAJWA'] },
]

async function main() {
  const passwordHash = await bcrypt.hash('parent123', 12)

  // 1. Get all students
  const students = await prisma.student.findMany({
    include: { invoices: true }
  })
  console.log(`Processing ${students.length} students...`)

  let updatedParents = 0
  let updatedPricing = 0

  for (let idx = 0; idx < students.length; idx++) {
    const student = students[idx]
    const upperName = student.name.toUpperCase()

    // 2. Identify the correct parent groupings
    let targetParentGroup = PARENT_GROUPINGS.find(g => 
      g.children.some(c => upperName.includes(c) || c.includes(upperName))
    )

    let parentName, parentEmail, parentPhone
    if (targetParentGroup) {
      parentName = targetParentGroup.parentName
      parentEmail = targetParentGroup.email
      parentPhone = targetParentGroup.phone
    } else {
      // Create fallback individual parent details
      const cleanName = student.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      parentName = `Orang Tua ${student.name}`
      parentEmail = `parent.${cleanName}@mellyna.id`
      parentPhone = `628129999${String(100 + idx).padStart(3, '0')}`
    }

    // Upsert the parent user account
    const parentUser = await prisma.user.upsert({
      where: { email: parentEmail },
      update: { name: parentName, phone: parentPhone },
      create: {
        name: parentName,
        email: parentEmail,
        password: passwordHash,
        role: Role.PARENT,
        phone: parentPhone
      }
    })

    // Link the student to this parent
    await prisma.student.update({
      where: { id: student.id },
      data: { parentId: parentUser.id }
    })
    updatedParents++

    // 3. Determine pricing connection based on invoices
    const amounts = student.invoices.map(inv => inv.amount)
    let baseFee = 150000 // default monthly fee to Tingkat 1

    if (amounts.length > 0) {
      // Find the most common invoice amount
      const frequency = {}
      amounts.forEach(a => {
        frequency[a] = (frequency[a] || 0) + 1
      })
      const sorted = Object.entries(frequency).sort((a, b) => b[1] - a[1])
      baseFee = parseInt(sorted[0][0])
    }

    let pricingTierLabel = ''
    if (baseFee === 150000) {
      pricingTierLabel = 'Tingkat 1 (Rp150.000/bln)'
    } else if (baseFee === 160000) {
      pricingTierLabel = 'Tingkat 2 (Rp160.000/bln)'
    } else if (baseFee === 170000) {
      pricingTierLabel = 'Tingkat 3 (Rp170.000/bln)'
    } else if (baseFee === 180000) {
      pricingTierLabel = 'Tingkat 4 (Rp180.000/bln)'
    } else if (baseFee === 120000) {
      pricingTierLabel = 'Tingkat 1 (Diskon Khas Rp120.000/bln)'
    } else if (baseFee === 135000) {
      pricingTierLabel = 'Tingkat 1 (Subsidi Pendaftaran Rp135.000/bln)'
    } else if (baseFee === 400000) {
      pricingTierLabel = 'Paket Registrasi Baru (Rp400.000 termasuk Buku + SPP Bulan 1)'
    } else {
      pricingTierLabel = `Paket Khusus (Rp${baseFee.toLocaleString('id-ID')}/bln)`
    }

    // Connect student notes and grade to show pricing info
    const cleanNotes = student.notes || ''
    const pricingMarker = ' | Harga Paket: '
    let updatedNotes = cleanNotes
    if (cleanNotes.includes(pricingMarker)) {
      updatedNotes = cleanNotes.split(pricingMarker)[0] + pricingMarker + pricingTierLabel
    } else {
      updatedNotes = cleanNotes + pricingMarker + pricingTierLabel
    }

    // Update grade description to show pricing in lists
    const baseGrade = student.grade ? student.grade.split(' | ')[0] : 'Siswa Bimbel'
    const updatedGrade = `${baseGrade} | ${pricingTierLabel}`

    await prisma.student.update({
      where: { id: student.id },
      data: {
        grade: updatedGrade,
        notes: updatedNotes
      }
    })
    updatedPricing++
  }

  console.log('\n================================================')
  console.log('✅ PARENT AND PRICING CONNECTIONS COMPLETED!')
  console.log(`👉 Linked students to real parent accounts:  ${updatedParents}`)
  console.log(`👉 Attached matching pricing tiers to students: ${updatedPricing}`)
  console.log('================================================')
}

main().catch(console.error).finally(() => prisma.$disconnect())
