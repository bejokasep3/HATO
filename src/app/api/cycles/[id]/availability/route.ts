import { withAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { getCycleAvailability } from '@/lib/services/availability'
import { mutationErrorResponse } from '@/lib/services/mutation'
import { NextRequest, NextResponse } from 'next/server'
import { hasOperationalSchema } from '@/lib/services/schema-capabilities'
import { getLegacyInventory } from '@/lib/services/legacy-readers'

async function GETImpl(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!await hasOperationalSchema(prisma)) {
      const inventory = await getLegacyInventory(prisma, id)
      return NextResponse.json(inventory, { headers: { 'Cache-Control': 'private, no-store' } })
    }
    const result = await getCycleAvailability(prisma, id)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return mutationErrorResponse(error)
  }
}

export const GET = withAdmin(GETImpl)
