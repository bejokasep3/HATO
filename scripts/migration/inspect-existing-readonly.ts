import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
    const [metadata] = await tx.$queryRaw<{
      migration_table: string | null
      cycle_table: string | null
      product_table: string | null
      payment_table: string | null
    }[]>`
      SELECT to_regclass('public._prisma_migrations')::text AS migration_table,
             to_regclass('public.cycles')::text AS cycle_table,
             to_regclass('public.products')::text AS product_table,
             to_regclass('public.payments')::text AS payment_table
    `
    const columns = await tx.$queryRaw<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND (
        (table_name = 'cycles' AND column_name IN ('week_key', 'rules_version', 'period_start')) OR
        (table_name = 'orders' AND column_name IN ('ledger_reconciled_at', 'payment_status')) OR
        (table_name = 'products' AND column_name IN ('target_group', 'is_target'))
      ) ORDER BY table_name, column_name
    `
    const migrationNames = metadata.migration_table
      ? await tx.$queryRawUnsafe<{ migration_name: string; finished: boolean }[]>(
          'SELECT migration_name, finished_at IS NOT NULL AS finished FROM public._prisma_migrations ORDER BY started_at',
        )
      : []
    const catalog = await tx.$queryRaw<{
      id: string
      name: string
      unit: string
      is_target: boolean
      target_quantity: string | null
    }[]>`
      SELECT id, name, unit, is_target, target_quantity::text
      FROM products ORDER BY sort_order, name
    `
    return { tables: metadata, columns, migrationNames, catalog }
  })
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
}

main().finally(() => prisma.$disconnect())
