import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any).role
    if (role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const parents = await prisma.user.findMany({
      where: {
        role: 'PARENT',
      },
      include: {
        children: {
          include: {
            enrollments: {
              include: {
                class: {
                  include: {
                    tutor: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
            invoices: {
              orderBy: {
                dueDate: 'desc',
              },
            },
            attendances: {
              orderBy: {
                markedAt: 'desc',
              },
            },
            reports: {
              include: {
                tutor: {
                  select: {
                    name: true,
                  },
                },
                schedule: {
                  select: {
                    date: true,
                    topic: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
            programEnrollments: {
              orderBy: {
                startedAt: 'desc',
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(parents)
  } catch (error: any) {
    console.error('Parents API error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    )
  }
}
