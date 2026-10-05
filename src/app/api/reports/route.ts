import { withAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { mutationErrorResponse } from '@/lib/services/mutation'
import { getReports } from '@/lib/services/reports'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { hasOperationalSchema } from '@/lib/services/schema-capabilities'
import { getLegacyReports } from '@/lib/services/legacy-readers'

async function GETImpl(request: NextRequest) {
  try {
    const type = z.enum(['targets', 'financial', 'commodity', 'member', 'receivable'])
      .parse(new URL(request.url).searchParams.get('type') ?? 'financial')
    if (!await hasOperationalSchema(prisma)) return NextResponse.json(await getLegacyReports(prisma, type))
    return NextResponse.json(await getReports(prisma, type))
  } catch (error) { return mutationErrorResponse(error) }
}

export const GET = withAdmin(GETImpl)
