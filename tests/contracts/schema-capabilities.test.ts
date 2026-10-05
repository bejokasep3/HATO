import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PrismaClient } from '@prisma/client'
import { hasOperationalSchema, operationalSchemaGuard } from '../../src/lib/services/schema-capabilities'

function prismaReturning(operational: boolean): PrismaClient {
  return {
    $queryRaw: async () => [{ operational }],
  } as unknown as PrismaClient
}

test('legacy schema is detected and mutation guard returns a stable 409 response', async () => {
  const prisma = prismaReturning(false)

  assert.equal(await hasOperationalSchema(prisma), false)
  const response = await operationalSchemaGuard(prisma)
  assert.equal(response?.status, 409)
  const body = await response?.json()
  assert.equal(body.error.code, 'SCHEMA_UPGRADE_REQUIRED')
  assert.match(body.error.message, /schema operasional lama/)
  assert.equal(typeof body.requestId, 'string')
})

test('operational schema allows the mutation handler to continue', async () => {
  const prisma = prismaReturning(true)

  assert.equal(await hasOperationalSchema(prisma), true)
  assert.equal(await operationalSchemaGuard(prisma), null)
})
