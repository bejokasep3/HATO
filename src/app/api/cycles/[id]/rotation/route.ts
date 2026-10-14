import { withAdmin } from '@/lib/auth/admin'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasOperationalSchema } from '@/lib/services/schema-capabilities'

async function GETImpl(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!await hasOperationalSchema(prisma)) {
      const schedules = await prisma.rotationSchedule.findMany({
        where: { cycleId: id },
        select: { id: true, cycleId: true, memberId: true, status: true, createdAt: true, updatedAt: true, member: { select: { id: true, name: true, phone: true, role: true, group: { select: { id: true, name: true } } } } },
        orderBy: [{ member: { group: { name: 'asc' } } }, { member: { name: 'asc' } }],
      })
      return NextResponse.json(schedules)
    }
    const schedules = await prisma.rotationSchedule.findMany({
      where: { cycleId: id },
      include: {
        member: {
          include: {
            group: true,
          },
        },
      },
      orderBy: [{ member: { group: { name: 'asc' } } }, { member: { name: 'asc' } }],
    })

    return NextResponse.json(schedules)
  } catch (error) {
    console.error('Error fetching rotation schedules:', error)
    return NextResponse.json({ error: 'Failed to fetch rotation schedules' }, { status: 500 })
  }
}

async function removedRotation() {
  return NextResponse.json({ error: { code: 'ROTATION_REMOVED', message: 'Rotasi anggota sudah dihapus. Semua anggota dapat memesan.' }, requestId: crypto.randomUUID() }, { status: 410 })
}

export const GET = withAdmin(GETImpl)
export const POST = withAdmin(removedRotation)
export const DELETE = withAdmin(removedRotation)
