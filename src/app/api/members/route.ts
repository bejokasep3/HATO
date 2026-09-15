import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const memberSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  phone: z.string().min(8, 'Nomor HP tidak valid'),
  level: z.number().int().min(1).max(3),
  groupId: z.string().uuid(),
  role: z.enum(['anggota', 'pj', 'pengurus']).default('anggota'),
  isActive: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')
    const level = searchParams.get('level')
    const search = searchParams.get('search')
    const activeOnly = searchParams.get('active') === 'true'

    const where: any = {}
    if (activeOnly) where.isActive = true
    if (groupId) where.groupId = groupId
    if (level) where.level = parseInt(level, 10)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ]
    }

    const members = await prisma.member.findMany({
      where,
      include: {
        group: true,
        _count: {
          select: { orders: true },
        },
      },
      orderBy: [{ group: { name: 'asc' } }, { name: 'asc' }],
    })

    return NextResponse.json(members)
  } catch (error) {
    console.error('Error fetching members:', error)
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = memberSchema.parse(body)

    const member = await prisma.member.create({
      data: validated,
      include: { group: true },
    })

    // If role is PJ, also update group's pjMemberId
    if (validated.role === 'pj') {
      await prisma.group.update({
        where: { id: validated.groupId },
        data: { pjMemberId: member.id },
      })
    }

    return NextResponse.json(member, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating member:', error)
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 })
    }

    if (data.level) data.level = Number(data.level)

    const updated = await prisma.member.update({
      where: { id },
      data,
      include: { group: true },
    })

    // If role changed to PJ, update group's pjMemberId
    if (data.role === 'pj' && data.groupId) {
      await prisma.group.update({
        where: { id: data.groupId },
        data: { pjMemberId: id },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating member:', error)
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 })
    }

    const ordersCount = await prisma.order.count({ where: { memberId: id } })
    if (ordersCount > 0) {
      await prisma.member.update({
        where: { id },
        data: { isActive: false },
      })
      return NextResponse.json({
        message: 'Anggota telah dinonaktifkan karena memiliki riwayat pesanan.',
        softDeleted: true,
      })
    }

    // Clear PJ reference in any groups
    await prisma.group.updateMany({
      where: { pjMemberId: id },
      data: { pjMemberId: null },
    })

    // Delete rotation schedules
    await prisma.rotationSchedule.deleteMany({
      where: { memberId: id },
    })

    // Delete member
    await prisma.member.delete({
      where: { id },
    })

    return NextResponse.json({
      message: 'Anggota berhasil dihapus permanen.',
      softDeleted: false,
    })
  } catch (error) {
    console.error('Error deleting member:', error)
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 })
  }
}
