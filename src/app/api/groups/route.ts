import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const groupSchema = z.object({
  name: z.string().min(2, 'Nama sub-grup minimal 2 karakter'),
  level: z.number().int().min(1).max(4).default(2),
  parentGroupId: z.string().uuid().nullable().optional(),
  pjMemberId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
})

export async function GET() {
  try {
    const groups = await prisma.group.findMany({
      include: {
        parentGroup: true,
        pjMember: true,
        members: {
          where: { isActive: true },
          select: { id: true, name: true, phone: true, role: true },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: [{ level: 'desc' }, { name: 'asc' }],
    })

    return NextResponse.json(groups)
  } catch (error) {
    console.error('Error fetching groups:', error)
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = groupSchema.parse(body)

    const group = await prisma.group.create({
      data: validated,
      include: { pjMember: true },
    })

    if (validated.pjMemberId) {
      await prisma.member.update({
        where: { id: validated.pjMemberId },
        data: { role: 'pj', level: 2, groupId: group.id },
      })
    }

    return NextResponse.json(group, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating group:', error)
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, pjMemberId, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (pjMemberId !== undefined) updateData.pjMemberId = pjMemberId || null
    if (isActive !== undefined) updateData.isActive = isActive

    const updated = await prisma.group.update({
      where: { id },
      data: updateData,
      include: { pjMember: true },
    })

    // If new PJ assigned, update member role to 'pj' and link to this group
    if (pjMemberId) {
      await prisma.member.update({
        where: { id: pjMemberId },
        data: { role: 'pj', level: 2, groupId: id },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating group:', error)
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 })
    }

    // Check if group has members
    const membersCount = await prisma.member.count({
      where: { groupId: id },
    })

    if (membersCount > 0) {
      return NextResponse.json(
        {
          error: `Sub-grup tidak dapat dihapus karena masih memiliki ${membersCount} anggota terdaftar. Pindahkan anggota ke sub-grup lain terlebih dahulu.`,
        },
        { status: 400 }
      )
    }

    await prisma.group.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Sub-grup berhasil dihapus.' })
  } catch (error) {
    console.error('Error deleting group:', error)
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 })
  }
}
