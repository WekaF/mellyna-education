import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any).role
    if (role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rawParents = await prisma.user.findMany({
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

    const parents = (rawParents as any[]).map((p: any) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      suspended: p.suspended,
      createdAt: p.createdAt.toISOString(),
      children: p.children.map((child: any) => ({
        id: child.id,
        name: child.name,
        grade: child.grade,
        notes: child.notes,
        isActive: child.isActive,
        createdAt: child.createdAt.toISOString(),
        enrollments: child.enrollments.map((enr: any) => ({
          id: enr.id,
          class: {
            id: enr.class.id,
            name: enr.class.name,
            subject: enr.class.description ?? '',
            tutor: { name: enr.class.tutor.name },
          },
        })),
        invoices: child.invoices.map((inv: any) => ({
          id: inv.id,
          amount: inv.amount,
          description: inv.description,
          dueDate: inv.dueDate.toISOString(),
          status: inv.status,
          paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
          createdAt: inv.createdAt.toISOString(),
        })),
        attendances: child.attendances.map((att: any) => ({
          id: att.id,
          status: att.status,
          notes: att.notes,
          markedAt: att.markedAt.toISOString(),
        })),
        reports: child.reports.map((rep: any) => ({
          id: rep.id,
          content: rep.content,
          score: rep.score,
          createdAt: rep.createdAt.toISOString(),
          tutor: { name: rep.tutor.name },
          schedule: {
            date: rep.schedule.date.toISOString(),
            topic: rep.schedule.topic,
          },
        })),
        programEnrollments: child.programEnrollments.map((pe: any) => ({
          id: pe.id,
          program: pe.program,
          status: pe.status,
          startedAt: pe.startedAt.toISOString(),
        })),
      })),
    }))

    return NextResponse.json(parents)
  } catch (error: any) {
    console.error('Parents API error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    )
  }
}
