import { withAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { getRanking } from '@/lib/services/ranking'
import { mutationErrorResponse } from '@/lib/services/mutation'
import { NextResponse } from 'next/server'
import { hasOperationalSchema } from '@/lib/services/schema-capabilities'
import { getLegacyRanking } from '@/lib/services/legacy-readers'

async function GETImpl() {
  try {
    if (!await hasOperationalSchema(prisma)) return NextResponse.json(await getLegacyRanking(prisma))
    return NextResponse.json(await getRanking(prisma))
  } catch (error) { return mutationErrorResponse(error) }
}

export const GET = withAdmin(GETImpl)
