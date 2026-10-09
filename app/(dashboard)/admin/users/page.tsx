import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import UsersClient from './UsersClient'

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/admin')

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, phone: true, role: true, suspended: true, createdAt: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return (
    <UsersClient
      currentUserId={(session.user as any).id}
      initialUsers={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
    />
  )
}
