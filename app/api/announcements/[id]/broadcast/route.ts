import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendWhatsApp, sleep, randomDelay } from '@/lib/waha'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const announcement = await prisma.announcement.findUnique({ where: { id } })
  if (!announcement) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  if (!announcement.published) return NextResponse.json({ error: 'Announcement not published' }, { status: 400 })

  // Fetch all parents and tutors with phone numbers
  const [parents, tutors] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'PARENT', phone: { not: null } },
      select: { name: true, phone: true },
    }),
    prisma.user.findMany({
      where: { role: 'TUTOR', phone: { not: null } },
      select: { name: true, phone: true },
    }),
  ])

  const message = `📢 *Pengumuman dari Mellyna Education*

*${announcement.title}*

${announcement.content}

_Mellyna Education_`

  // Dispatch WA messages asynchronously — doesn't block the API response
  Promise.resolve().then(async () => {
    const recipients = [...parents, ...tutors]
    for (const user of recipients) {
      if (!user.phone) continue
      console.log(`[WAHA Broadcast] Sending announcement "${announcement.title}" to ${user.name} (${user.phone})`)
      const ok = await sendWhatsApp(user.phone, message)
      if (!ok) {
        console.error(`[WAHA Broadcast] Failed to send to ${user.name}`)
      }
      await sleep(randomDelay(3000, 7000))
    }
    console.log(`[WAHA Broadcast] Announcement broadcast complete: ${recipients.length} recipients`)
  }).catch(console.error)

  return NextResponse.json({ ok: true, recipientCount: parents.length + tutors.length })
}
