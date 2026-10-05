import { PrismaClient } from '@prisma/client'

export async function assertIsolatedTestDatabase(prisma: PrismaClient, expectedDatabase = 'hato_test') {
  const url = process.env.HATO_TEST_DATABASE_URL
  if (!url || url !== process.env.DATABASE_URL || url !== process.env.DIRECT_URL) {
    throw new Error('HATO_TEST_DATABASE_URL must exactly match DATABASE_URL and DIRECT_URL')
  }

  const parsed = new URL(url)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) {
    throw new Error('Migration drill requires a loopback database')
  }

  const [identity] = await prisma.$queryRaw<{
    database: string
    data_directory: string
    marker: string | null
  }[]>`
    SELECT current_database() AS database,
           current_setting('data_directory') AS data_directory,
           to_regclass('public.hato_test_marker')::text AS marker
  `

  if (identity?.database !== expectedDatabase ||
      !identity.data_directory.replaceAll('\\', '/').includes('/hato-test-pg-') ||
      identity.marker !== 'hato_test_marker') {
    throw new Error('Database identity does not match the isolated HATO test cluster')
  }

  const marker = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM hato_test_marker LIMIT 1`
  if (marker[0]?.id !== 'isolated-hato-test') {
    throw new Error('Test database marker mismatch')
  }
}
