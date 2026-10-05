import { type PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

type CapabilityRow = { operational: boolean }

export async function hasOperationalSchema(prisma: PrismaClient): Promise<boolean> {
  const rows = await prisma.$queryRaw<CapabilityRow[]>`
    SELECT (
      to_regclass('public.payments') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cycles' AND column_name = 'period_end'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'version'
      )
    ) AS operational
  `
  return Boolean(rows[0]?.operational)
}

export async function operationalSchemaGuard(prisma: PrismaClient): Promise<NextResponse | null> {
  if (await hasOperationalSchema(prisma)) return null

  return NextResponse.json(
    {
      error: {
        code: 'SCHEMA_UPGRADE_REQUIRED',
        message: 'Aksi ini belum tersedia karena database masih menggunakan schema operasional lama',
      },
      requestId: crypto.randomUUID(),
    },
    { status: 409 },
  )
}
