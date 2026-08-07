import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import AnnouncementsClient from './AnnouncementsClient'

export default async function AdminAnnouncementsPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/admin')

  const rawAnnouncements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const announcements = rawAnnouncements.map((ann) => ({
    id: ann.id,
    title: ann.title,
    content: ann.content,
    published: ann.published,
    createdAt: ann.createdAt.toISOString(),
  }))

  return <AnnouncementsClient initialAnnouncements={announcements} />
}
