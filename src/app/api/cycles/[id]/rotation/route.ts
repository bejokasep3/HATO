import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    // Check which members have already ordered in this cycle
    const cycleOrders = await prisma.order.findMany({
      where: { cycleId: id },
      select: { memberId: true },
    })
    const orderedMemberIds = new Set(cycleOrders.map((o) => o.memberId))

    // 1. Manual Single Member Addition
    if (body.memberId) {
      const status = orderedMemberIds.has(body.memberId) ? 'ordered' : (body.status || 'scheduled')
      const schedule = await prisma.rotationSchedule.upsert({
        where: {
          cycleId_memberId: {
            cycleId: id,
            memberId: body.memberId,
          },
        },
        update: { status },
        create: {
          cycleId: id,
          memberId: body.memberId,
          status,
        },
        include: {
          member: { include: { group: true } },
        },
      })
      return NextResponse.json(schedule, { status: 201 })
    }

    // 2. Manual Batch Member Addition
    if (body.memberIds && Array.isArray(body.memberIds)) {
      const created = await prisma.$transaction(
        body.memberIds.map((mId: string) => {
          const status = orderedMemberIds.has(mId) ? 'ordered' : 'scheduled'
          return prisma.rotationSchedule.upsert({
            where: {
              cycleId_memberId: {
                cycleId: id,
                memberId: mId,
              },
            },
            update: { status },
            create: {
              cycleId: id,
              memberId: mId,
              status,
            },
          })
        })
      )
      return NextResponse.json({
        message: `Berhasil menambahkan ${created.length} anggota ke jadwal rotasi.`,
        count: created.length,
      })
    }

    // 3. Auto-Generate Rotation (Includes all active groups L2 & L3, including PJ & Pengurus)
    const countPerGroup = body.countPerGroup || 2

    // Fetch all active groups (Level 2 sub-groups and Level 3 manager group)
    const allGroups = await prisma.group.findMany({
      where: { isActive: true },
      include: {
        members: {
          where: { isActive: true },
          include: {
            rotationSchedules: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    })

    const membersToSchedule: string[] = []

    for (const group of allGroups) {
      if (!group.members || group.members.length === 0) continue

      // Sort members in group by last rotation date (null first, then oldest)
      const sorted = [...group.members].sort((a, b) => {
        const aLast = a.rotationSchedules[0]?.createdAt.getTime() || 0
        const bLast = b.rotationSchedules[0]?.createdAt.getTime() || 0
        return aLast - bLast
      })

      const selected = sorted.slice(0, countPerGroup)
      for (const m of selected) {
        membersToSchedule.push(m.id)
      }
    }

    // Upsert into RotationSchedule
    const created = await prisma.$transaction(
      membersToSchedule.map((memberId) => {
        const status = orderedMemberIds.has(memberId) ? 'ordered' : 'scheduled'
        return prisma.rotationSchedule.upsert({
          where: {
            cycleId_memberId: {
              cycleId: id,
              memberId,
            },
          },
          update: { status },
          create: {
            cycleId: id,
            memberId,
            status,
          },
        })
      })
    )

    return NextResponse.json({
      message: `Berhasil menjadwalkan ${created.length} anggota untuk rotasi.`,
      count: created.length,
    })
  } catch (error) {
    console.error('Error generating rotation:', error)
    return NextResponse.json({ error: 'Failed to generate rotation' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const scheduleId = searchParams.get('id')
    const memberId = searchParams.get('memberId')

    if (scheduleId) {
      await prisma.rotationSchedule.delete({
        where: { id: scheduleId },
      })
    } else if (memberId) {
      await prisma.rotationSchedule.delete({
        where: {
          cycleId_memberId: {
            cycleId: id,
            memberId,
          },
        },
      })
    } else {
      return NextResponse.json({ error: 'ID jadwal atau memberId wajib diisi' }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Jadwal rotasi berhasil dihapus' })
  } catch (error) {
    console.error('Error deleting rotation schedule:', error)
    return NextResponse.json({ error: 'Failed to delete rotation schedule' }, { status: 500 })
  }
}
