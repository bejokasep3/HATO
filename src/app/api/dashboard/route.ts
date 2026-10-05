import { withAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { getDashboardSummary } from '@/lib/services/operational-summary'
import { mutationErrorResponse } from '@/lib/services/mutation'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

async function GETImpl(request: NextRequest) {
  try {
    const value = new URL(request.url).searchParams.get('cycleId')
    const cycleId = value ? z.uuid().parse(value) : null
    return NextResponse.json(await getDashboardSummary(prisma, cycleId))
  } catch (error) { return mutationErrorResponse(error) }
}

export const GET = withAdmin(GETImpl)
