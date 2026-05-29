const { PrismaClient, Role, InvoiceStatus, PaymentStatus } = require('@prisma/client')

const prisma = new PrismaClient()

// Name mappings for matching spreadsheet names to slightly different database names
const nameMapping = {
  'EL BARIC': 'EL BARIQ',
  'DIAS': 'DIAZ',
  'HANNA': 'HANA',
  'MIKAYLA': 'MIKA',
  'DIAJENG': 'AJENG',
}

const GROUP1_RAW = `1	Almeer	SEMPOA					OFF			3 BLN DR DES'25	OFF HUTANG 360				
2	Kaisya TK	EYL SEMPOA					OFF			OFF BY WA	OFF HUTANG 120				
3	Izora	SEMPOA					OFF			OFF NO CONFIRM	OFF HUTANG 1TM				
4	Zafran	SEMPOA					OFF	31 DES 120rb (sama buku)	120RB	OFF saudara sakit	OFF SIBUK				
5	GILANG	SEMPOA					OFF		4 JAN 120	OFF TAHFIDZ	OFF TAHFIDZ				
6	KEYSA SD	SEMPOA					OFF		4 JAN 125 	OFF TAHFIDZ	OFF TAHFIDZ				
7	Arsy	AHE					OFF		12 DES 130RB	OFF	OFF				
8	Kayzan	SEMPOA					OFF			OFF NO CONFIRM	OFF NO CONFIRM				
9	Fatih	SEMPOA					OFF		13 JAN CASH 120	OFF PER 15 FEB	OFF TAHFIDZ				
10	Raya	SEMPOA					OFF		11 JAN 120 TF	120rb 10 feb shopay	90 (blm byr)	OFF			
11	ADIT	SEMPOA	1-Feb	SEL			OFF			1 FEB REG 135 -off 22 feb sisa 1TM FOR DITA	7 april 40rb	60	OFF		
12	DITA	SEMPOA	15-Feb	SL MG			OFF			D=4TM A+2==6TM +REG (MART ADA 15RB)	7 april 75rb	120	OFF		
13	YAHYA	AHE	18-Apr	SN SB			OFF					18 APRIL 90RB +10RB FOR MAY	OFF		
14	AZRA	B.ING	24-Jan	SN RB			OFF		240rb	INFO TELAT BAYAR	120+90 (blm byr)	TTL FEB MAR APR 120+90+120=330	OFF		
15	DARIS	CALISTUNG	4-Jan	SN RB MG			OFF		11 JAN 180 CASH	11 FEB 180	140rb	13 APRIL 150	OFF		
18	Memey	SEMPOA		SB MG			OFF		12  DES 120 + 29 byr buku 34rb	17 jan 120+35BUKU	14 Mar 90rb	4 APRIL 120	OFF		
19	DIKA	AHE	23-Feb	SN SB			OFF			+REG + 2 MEET (SabSen)	14 Mar 50rb dan depo 40rb 23 feb	9 APRIL 120	120		
26	HAIKAL	SEMPOA	16-Jan	RB JM		off	off		16 JAN 100RB (DISC GURU ICHA)	10 feb 120rb (sisa30)	90RB	10 APRIL 120	150`

const GROUP2_RAW = `1	Aye	SEMPOA				120	135		7 JAN TF 120	OFF TAHFIDZ	OFF TAHFIDZ	10 APRIL 120	6 MAY 135		
2	Adrian	SEMPOA				240	270		240 tf 10 jan	OFF PER 15 FEB tahfidd	OFF TAHFIDZ	10 APRIL 240 TF	10 MAY 270RB TF		
3	Alinda	SEMPOA		SL SB		240	255		10 Jan 120	120rb 10 feb	14 mar 120rb	10 APRIL 90	10 MAY 250RB KURG 5RB		
4	Uwais	SEMPOA		SL SB		120	135		2 JAN 120	7 FEB 120	7 Mar 90rb	7 APRIL 120	"6 MAY 135		
5	Vira 	SEMPOA		RB JM		120	150	21 nov, 22 des	23 Jan 120rb	18 FEB 120	13 Mar 90rb	11 APRIL 120	21 may 150		
6	Naura	SEMPOA		JUMING		120	135		8 Jan 120	8 FEB 120RB	13 Mar90+5rb buku kotak	5 APRIL 120	1 may 135 rb		
7	Ramdan	SEMPOA AHE		JM MG		180	200		190  cash	14 feb 170 cash	14 Mar 140rb	14 april 180	12 May 200rb+buku		
8	Karin 	SEMPOA		SN JM		120	135		12 JAN 240 TF	SAKIT	OFF	3 APRIL 120	15 may 135 rb		
9	Gita 	EYL SEMPOA	30-Nov	SN RB		120	150		5 JAN 240 TF	4 feb 240 by tf	7 Mar 90rb by tf	12 APRIL 240	15 may 150 rb		
10	Biboy	EFK		JM MG		120	120		9 JAN TF 100	12 FEB BY TF 120	10 MARET 90	10 APRIL 90	10 MAY 120RB		
11	Ozil	EYL SEMPOA	5-Jan	SN RB JM		120	135		10 jan tf 60	120rb tf	12 Mar 120rb (90rb+buku 30)	12 APRIL 120 TF	75+60 BY TF		75
12	GINA 	EYL		JM		60	60		16 JAN 120	RABU 4 FEB JADI 1 + buku	OFF	12 APRIL 60	6 MAY60		60
13	GIBRAN	EYL		RB		60	60		16 JAN 120	RABU 4 FEB JADI 1 + buku	OFF	12 APRIL 60	6 MAY60		
14	FANIA	AHE SEMPOA EFK	5-Jan	SN RB MG		180	180		5 JAN 300RB (DAFTAR)	8&11 FEB 180	100 +40	8 APRIL 180	11 MAY 180		
15	VINA	SEMPOA		MG		60	75		4 JAN 120+60 BUKU	8 FEB 120RB	11 Mar 50rb	5 APRIL 60RB	3 mei 75		
16	WAWAN	SEMPOA		MG		60	75		4 JAN 120+60 BUKU	8 FEB 120RB	OFF	5 APRIL 60RB	3 mei 75		
17	Silva	SEMPOA	4-Jan	MG		60	75		4 JAN 60RB	8 FEB 60RB	8 Mar 60rb	5 APRIL 60RB	3 mei 75		
18	MITA	AHE SEMPOA EFK	5-Jan	SN RB JM		180	180		5 JAN 300RB (DAFTAR)	4 feb 180rb	6 Mar 140 rb	12 APRIL 180 TF	1 MAY 180 TF		
19	KIA	AHE EFK SEMPOA	7-Jan	SN MG		255	140		7 JAN TF 130(DAFTAR	8 FEB 120RB	8 Mar 90rb by tf	 	120+20 LV2	150	
20	KAYRA 	SEMPOA EFE	14-Jan	SN RB SB		180	310		14 JAN 195 DAFTAR	2 FEB 180	7 Mar 140rb	1 April 180	4 MEY 210+ BUKU 100	60	
21	IRSYA	SEMPOA	15-Jan	SB JM		120	135		15 jan 150 DAFTAR	3 FEB 120	6 Mar 90 rb	1 April 120	????		
22	GLEN	SEMPOA AHE	9-Jan	SL SB		240	255		150-50-30(REG+2TM) =70 -35(buku)=35	120	11 mar 300	21 APRIL 210	255		
23	LINTANG	AHE	9-Jan	SN RB		180	180		TF jd satu sama glen		OFF	21 APRIL 165	180		
24	GISYA	SEMPOA	8-Feb	SB MG SN RB		240	250			8 FEB 120RB	8 Mar 90rb	5 APRIL 120+22 APRIL 140	3 mei 250, 5rb ny di juni	JUNI 260	
25	NUVAL	CALISTUNG	16-Jan	SL RB JM		180	180		16 JAN 100RB (KRG 40RB)	3FEB 100RB 	6 Mar 140 rb	12 APRIL 180	14 MAY 160		
26	GIO	AHE	6-Feb	JM MG		120	120			+REG 13 feb =150	13 Mar 90rb	12 APRIL 120RB TF	6 MAY 120		
27	ALBY	SEMPOA	13-Feb	JM MG		180	120			+REG + 5TM =150	13 Mar 90rb	12 APRIL 120	10 MAY 120RB  KURNG 105	105	
28	ELA	SEMPOA EFE	16-Feb	SN MG		120	120			+REG 35+6 TM (MingsenRab) 125	6 Mar 140 rb	5 APRIL 120	8 MAY 120RB		
29	MAMAD	CALISTUNG	15-Feb	SL SB MG		180	180			+REG+6 MEET (RabSabMing) 125	7 Mar 140rb	5 April 180	3 MAY180		
30	NAJWA	SEMPOA	23-Feb	SENMING		120	135			REG +2 meet = 105rb	8 Mar 90 rb	6 APRIL 120	10 MEY 135		
31	DIAJENG	AHE	10-Mar	SL RB MG		180	180				10 Mar 95 +reg +4TM	12 APRIL 165	19 may 180		
32	VIA	SEMPOA	5-Apr	SENMING		120	120					6 APRIL 200	11 MAY 120		
33	RIFQI	AHE	3-Apr	JM MG		120	120					3 APRIL 150	8 MAY 120		
34	AURA	CALISTUNG	3-Apr	SN RB		180	195			7		6 APRIL 210+60	11 MAY 195		
35	ARJUN	SEMPOA EFE	3-Apr	PLAN		240	270					9 APRIL 200+120	270		
36	ABROR	CALISTUNG	7-Apr	SL SB MG		180	200					7 APRIL 180	3 may 200rb +buku 20rb 		
37	KEVIN 	CALISTUNG	6-Apr			180	200					6 APRIL +165+30	10 MAY 180+BUKU20		
38	ZAFRAN	SEMPOA AHE	6-Apr			330	330					TF	6 MAY 330		
39	GABBY	CALISTUNG	6-Apr			330	330			8		TF	6 MAY 330		
40	YUNDA	CALISTUNG	13-Apr			180	180					13 APRIL 165RB	180		
41	IHID	ENGLISH	21-Apr				150					21 APRIL 165	16 MAY 150		
42	CEISYA	PRACALIS	22-Apr	SN RB		160	160					22 APRIL +75	22 APRIL 160	22 APRIL 15RB	
43	REZA	AHE	28-Apr			180	180					28 april 50rb	9 mey 180rb		
44	CLARA	EFE	24-Apr			120	120						10 MAY 120		
45	CLARISA	EFE	24-Apr			120	120						10 MAY 120		
46	RAISHA	EFE	1 MAY			140	140						1 may 140rb		
47	EL BARIC	EFE	1 MAY			140	140						1 may 140rb		
48	ZAFRAN SD	SEMPOA				120	200						22 mei  byr 200 kurang 70rb(135+135)		
49	ZIDNA	AHE EFK SEMPOA	1-Dec	JM MG		120	120		2 JAN 180	6 FEB 180	OFF	OFF 12 APRIL 15RB+BUKU35	8 MAY 120		
50	MIKAYLA	SEMPOA				120	350						TF 350		
51	RAFA	AHE	6-Feb	JM MG		120	165			150 6 FEB +REG	13 Mar 90rb + buku 10	OFF	17 MAY 120+45		
52	FAWAS	AHE	6-Feb	JM MG		120	185			150 6 FEB +REG	13 Mar 90rb	OFF	17 MAY '120+45+20  BUKULV2		
53	AYUMA	AHE	1MAY			180	180						180 ????		
54	DIAS	SEMPOA EFE				120	410						410 BY TF		
55	ROSA	AHE	6 MAY			180	230						6 MAY 230		
56	AGUSTIN	sempoa xl	9 MAY			120	400						9 may 400		
57	BERYL	PRACALIS	9 MAY			160	195						9 may 200rb		
58	HANNA	SEMPOA XL + EFE	10 MAY			270	520						10 MAY 520		
59	ZARA	SEMPOA XL 	13 MAY	RB SB		120	400						13 MAY 400		
60	FIKA	SEMPOA XL	13 MAY			120	365						13 MAY 365		
61	KEKEY	SEMPOA													
62	VINDRA	CALISTUNG			26-May	180							26 may 65	26 may 180	
63	OKTA	CALISTUNG			2-Jun	180`

// Months under track in the columns
const MONTHS_CONFIG = [
  { name: 'Desember 2025', dueDay: 10, monthIdx: 11, year: 2025 },
  { name: 'Januari 2026', dueDay: 10, monthIdx: 0, year: 2026 },
  { name: 'Februari 2026', dueDay: 10, monthIdx: 1, year: 2026 },
  { name: 'Maret 2026', dueDay: 10, monthIdx: 2, year: 2026 },
  { name: 'April 2026', dueDay: 10, monthIdx: 3, year: 2026 },
  { name: 'Mei 2026', dueDay: 10, monthIdx: 4, year: 2026 },
  { name: 'Juni 2026', dueDay: 10, monthIdx: 5, year: 2026 },
  { name: 'Juli 2026', dueDay: 10, monthIdx: 6, year: 2026 },
]

function parseCell(cellText, defaultAmount, monthConfig) {
  const clean = cellText.trim().toUpperCase()
  if (!clean || clean === 'OFF' || clean.startsWith('OFF ') || clean === 'SAKIT' || clean === 'SIBUK' || clean === 'TAHFIDZ') {
    if (clean.includes('HUTANG') || clean.includes('BYR')) {
      const numMatch = clean.match(/\d+/)
      const amount = numMatch ? parseInt(numMatch[0]) * (parseInt(numMatch[0]) < 1000 ? 1000 : 1) : defaultAmount
      return { status: 'PENDING', amount }
    }
    return { status: 'OFF', amount: 0 }
  }

  if (clean.includes('BLM BYR') || clean.includes('HUTANG') || clean === '????' || clean.includes('TELAT') || clean.includes('KURANG') || clean.includes('KURNG')) {
    const numMatch = clean.match(/\d+/)
    const amount = numMatch ? parseInt(numMatch[0]) * (parseInt(numMatch[0]) < 1000 ? 1000 : 1) : defaultAmount
    return { status: 'PENDING', amount }
  }

  const numbers = (clean.match(/\d+/g) || []).map(Number)
  if (numbers.length === 0) {
    return { status: 'PENDING', amount: defaultAmount }
  }

  let amount = defaultAmount
  let day = monthConfig.dueDay

  if (numbers.length === 1) {
    const num = numbers[0]
    if (num >= 35) {
      amount = num < 1000 ? num * 1000 : num
    } else {
      if (clean.includes('RB') || clean.includes('RIBU') || clean.includes('TF') || clean.includes('CASH')) {
        amount = num * 1000
      } else {
        return { status: 'PENDING', amount: defaultAmount }
      }
    }
  } else {
    const sorted = [...numbers].sort((a, b) => b - a)
    const maxNum = sorted[0]
    const secondMax = sorted[1]

    if (maxNum >= 35) {
      amount = maxNum < 1000 ? maxNum * 1000 : maxNum
      if (secondMax <= 31) {
        day = secondMax
      }
    } else {
      amount = maxNum * 1000
      if (secondMax <= 31) {
        day = secondMax
      }
    }
  }

  const paidAt = new Date(monthConfig.year, monthConfig.monthIdx, day)
  return { status: 'PAID', amount, paidAt, note: cellText }
}

async function main() {
  console.log('🧹 Wiping existing invoices and payments for fresh import...')
  await prisma.payment.deleteMany()
  await prisma.invoice.deleteMany()
  console.log('✅ Wiped successfully!')

  // Find or create default parent account
  let parent = await prisma.user.findFirst({ where: { role: Role.PARENT } })
  if (!parent) {
    console.log('Parent not found. Creating default Parent Admin account...')
    parent = await prisma.user.create({
      data: {
        name: 'Admin Bimbel',
        email: 'parent@mellyna.id',
        password: '$2a$12$hPz8K4sJ2mN9bV3xW6cR7tY1uI0oP9qA8sS7dD6fF5gG4hH3', // dummy encrypted password
        role: Role.PARENT,
        phone: '628000000001'
      }
    })
  }

  const allLines = [...GROUP1_RAW.split('\n'), ...GROUP2_RAW.split('\n')]
  console.log(`Processing ${allLines.length} raw student rows...`)

  let createdStudents = 0
  let createdInvoices = 0
  let createdPayments = 0

  for (const line of allLines) {
    if (!line.trim()) continue
    const cols = line.split('\t').map(c => c.trim())
    if (cols.length < 3) continue

    const nameRaw = cols[1]
    const program = cols[2]
    const joinedStr = cols[3] || ''
    const jadwal = cols[4] || ''
    
    // Parse bimbel fee or total monthly fee
    const bimbelRaw = cols[6] || ''
    const ttlRaw = cols[7] || ''
    const bimbelNum = parseInt(bimbelRaw.replace(/\D/g, '')) || 0
    const ttlNum = parseInt(ttlRaw.replace(/\D/g, '')) || 0
    const defaultFee = (ttlNum || bimbelNum || 120) * 1000 // In thousands, default to 120,000 IDR if none is specified

    // Perform case-insensitive student lookup (applying spreadsheet to DB name adjustments)
    const normalizedName = nameRaw.toUpperCase()
    const finalSearchName = nameMapping[normalizedName] || normalizedName

    let student = await prisma.student.findFirst({
      where: { name: { equals: finalSearchName, mode: 'insensitive' } }
    })

    if (!student) {
      console.log(`👤 Student not found: "${nameRaw}". Registering as new student under "${finalSearchName}"...`)
      
      // Parse joined date if available, e.g. "1-Feb"
      let createdAt = new Date('2025-08-01')
      if (joinedStr) {
        const parts = joinedStr.split('-')
        const day = parseInt(parts[0]) || 1
        const monthMap = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        }
        const month = monthMap[parts[1]] !== undefined ? monthMap[parts[1]] : 0
        createdAt = new Date(2026, month, day)
      }

      student = await prisma.student.create({
        data: {
          name: finalSearchName,
          grade: `${program}${jadwal ? ' | Jadwal: ' + jadwal : ''}`,
          notes: `Program: ${program} | Masuk: ${joinedStr || '-'} | Jadwal: ${jadwal || '-'}`,
          parentId: parent.id,
          createdAt
        }
      })
      createdStudents++

      // Enroll in the matching program class if exists
      const matchingClass = await prisma.class.findFirst({
        where: { subject: { equals: program, mode: 'insensitive' } }
      })
      if (matchingClass) {
        await prisma.enrollment.upsert({
          where: { studentId_classId: { studentId: student.id, classId: matchingClass.id } },
          update: {},
          create: { studentId: student.id, classId: matchingClass.id }
        })
      }
    }

    // Process monthly SPP columns: DES (col 8) to JULY (col 15)
    for (let i = 0; i < MONTHS_CONFIG.length; i++) {
      const monthConfig = MONTHS_CONFIG[i]
      const colIndex = 8 + i
      const cellValue = cols[colIndex] || ''

      const parsed = parseCell(cellValue, defaultFee, monthConfig)
      if (parsed.status === 'OFF') {
        continue // Student was off, skip invoice generation for this month
      }

      const dueDate = new Date(monthConfig.year, monthConfig.monthIdx, monthConfig.dueDay)

      const invoice = await prisma.invoice.create({
        data: {
          studentId: student.id,
          amount: parsed.amount,
          description: `SPP Bulan ${monthConfig.name} - ${finalSearchName}${parsed.note ? ' (' + parsed.note + ')' : ''}`,
          dueDate,
          status: parsed.status === 'PAID' ? InvoiceStatus.PAID : InvoiceStatus.PENDING,
          paidAt: parsed.paidAt || null,
        }
      })
      createdInvoices++

      if (parsed.status === 'PAID') {
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: parsed.amount,
            method: cellValue.toUpperCase().includes('TF') ? 'TRANSFER' : 'CASH',
            status: PaymentStatus.SUCCESS,
            paidAt: parsed.paidAt || new Date()
          }
        })
        createdPayments++
      }
    }
  }

  console.log('\n======================================')
  console.log('🎉 SPP IMPORT COMPLETED SUCCESSFULLY!')
  console.log(`👉 Registered new students:    ${createdStudents}`)
  console.log(`👉 Created billing Invoices:   ${createdInvoices}`)
  console.log(`👉 Registered Payments:        ${createdPayments}`)
  console.log('======================================')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
