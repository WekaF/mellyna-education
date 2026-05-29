import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { DayOfWeek } from '@prisma/client'

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'MONDAY',    label: 'Senin' },
  { key: 'TUESDAY',   label: 'Selasa' },
  { key: 'WEDNESDAY', label: 'Rabu' },
  { key: 'THURSDAY',  label: 'Kamis' },
  { key: 'FRIDAY',    label: "Jum'at" },
  { key: 'SATURDAY',  label: 'Sabtu' },
  { key: 'SUNDAY',    label: 'Minggu' },
]

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  'JAM 1', 'JAM 2', 'JAM 3', 'JAM 4', 'JAM 7',
]

const PIKET: Record<string, string> = {
  'Senin':   'ANI, LISA, DANI',
  'Selasa':  'LISA, ELA',
  'Rabu':    'ELA, VIN, DANI',
  'Kamis':   '—',
  "Jum'at":  'ANI, LISA, VIN',
  'Sabtu':   'DANI, ELA',
  'Minggu':  'ANI, LISA, VIN',
}

const SUBJECT_COLORS: Record<string, string> = {
  ENGLISH:   'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  CALISTUNG: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  SEMPOA:    'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
}

export default async function TimetablePage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/login')

  const classes = await prisma.class.findMany({
    where: { dayOfWeek: { not: null } },
    include: {
      tutor: { select: { name: true } },
      enrollments: {
        include: { student: { select: { name: true } } },
        orderBy: { student: { name: 'asc' } },
      },
    },
  })

  type ClassWithRelations = (typeof classes)[number]
  const grid: Record<string, Record<string, ClassWithRelations[]>> = {}
  for (const cls of classes) {
    const day = cls.dayOfWeek!
    const slot = cls.timeSlot!
    if (!grid[day]) grid[day] = {}
    if (!grid[day][slot]) grid[day][slot] = []
    grid[day][slot].push(cls)
  }

  const dayTotals = DAYS.map(d => ({
    label: d.label,
    count: Object.values(grid[d.key] ?? {})
      .flat()
      .reduce((sum, c) => sum + c.enrollments.length, 0),
  }))

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Jadwal Mingguan</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Timetable tetap bimbel — semua sesi per hari &amp; jam
      </p>

      <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 text-xs">
        {DAYS.map(d => (
          <div key={d.key} className="border rounded-lg p-2 bg-gray-50 dark:bg-gray-800/40">
            <div className="font-semibold text-gray-700 dark:text-gray-300">{d.label}</div>
            <div className="text-gray-500 dark:text-gray-400">Piket: {PIKET[d.label]}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full border-collapse text-xs min-w-[900px]">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="border-b border-r p-2 text-center w-16 font-semibold text-gray-600 dark:text-gray-300">
                Jam
              </th>
              {DAYS.map(d => (
                <th key={d.key} className="border-b border-r p-2 text-center font-semibold text-gray-600 dark:text-gray-300">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot, rowIdx) => (
              <tr key={slot} className={rowIdx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-900/20'}>
                <td className="border-b border-r p-2 text-center font-medium text-gray-500 dark:text-gray-400">
                  {slot}
                </td>
                {DAYS.map(day => {
                  const cellClasses = grid[day.key]?.[slot] ?? []
                  return (
                    <td key={day.key} className="border-b border-r p-1.5 align-top min-w-[110px]">
                      {cellClasses.map(cls => (
                        <div key={cls.id} className="mb-2 last:mb-0">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mb-0.5 ${SUBJECT_COLORS[cls.subject] ?? 'bg-gray-100 text-gray-800'}`}>
                            {cls.subject}
                          </span>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">
                            {cls.tutor.name}
                          </div>
                          <ul className="space-y-0">
                            {cls.enrollments.map(e => (
                              <li key={e.student.name} className="text-[11px] text-gray-700 dark:text-gray-300">
                                {e.student.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 dark:bg-gray-800 font-semibold">
              <td className="border-t p-2 text-center text-gray-600 dark:text-gray-300 text-xs">TTL</td>
              {dayTotals.map(d => (
                <td key={d.label} className="border-t border-r p-2 text-center text-gray-700 dark:text-gray-200 text-xs">
                  {d.count}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
        <span>Total sesi: <strong className="text-gray-800 dark:text-white">{classes.length}</strong></span>
        <span>Total siswa unik: <strong className="text-gray-800 dark:text-white">{new Set(classes.flatMap(c => c.enrollments.map(e => e.student.name))).size}</strong></span>
      </div>
    </div>
  )
}
