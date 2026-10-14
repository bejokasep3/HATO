import { createHash } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export class ServiceError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, unknown>) {
    super(message)
  }
}

export type Tx = Prisma.TransactionClient
export type MutationResponse = { status: number; body: Record<string, unknown> }

export function requireIdempotencyKey(value: string | null): string {
  const parsed = z.uuid().safeParse(value)
  if (!parsed.success) throw new ServiceError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key UUID wajib diisi')
  return parsed.data
}

export async function lockCycle(tx: Tx, cycleId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM cycles WHERE id = ${cycleId}::uuid FOR UPDATE`
  if (rows.length === 0) throw new ServiceError(404, 'CYCLE_NOT_FOUND', 'Siklus tidak ditemukan')
}

export async function runIdempotent(
  prisma: PrismaClient,
  input: { actorId: string; operation: string; key: string; payload: unknown },
  handler: (tx: Tx) => Promise<MutationResponse>,
): Promise<MutationResponse> {
  const requestHash = createHash('sha256').update(JSON.stringify(input.payload)).digest('hex')
  const lockId = `${input.actorId}:${input.operation}:${input.key}`

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1::int AS ok FROM pg_advisory_xact_lock(hashtextextended(${lockId}, 0))`
        const where = { actorId_operation_key: { actorId: input.actorId, operation: input.operation, key: input.key } }
        const previous = await tx.mutationRequest.findUnique({ where })
        if (previous) {
          if (previous.requestHash !== requestHash) {
            throw new ServiceError(409, 'IDEMPOTENCY_CONFLICT', 'Kunci ini sudah dipakai untuk permintaan berbeda')
          }
          return { status: previous.responseStatus, body: previous.responseJson as Record<string, unknown> }
        }

        const result = await handler(tx)
        await tx.mutationRequest.create({
          data: {
            actorId: input.actorId,
            operation: input.operation,
            key: input.key,
            requestHash,
            responseStatus: result.status,
            responseJson: result.body as Prisma.InputJsonValue,
          },
        })
        return result
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && attempt < 2 && (
        error.code === 'P2034' ||
        (error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code)))
      )) continue
      throw error
    }
  }
  throw new ServiceError(409, 'RETRY_REQUIRED', 'Permintaan bertabrakan, coba kembali')
}

export function mutationErrorResponse(error: unknown): NextResponse {
  if (error instanceof z.ZodError || error instanceof SyntaxError) {
    return NextResponse.json({ error: { code: 'INVALID_PAYLOAD', message: 'Data permintaan tidak valid' }, requestId: crypto.randomUUID() }, { status: 400 })
  }
  if (error instanceof ServiceError) {
    return NextResponse.json({ error: { code: error.code, message: error.message, details: error.details }, requestId: crypto.randomUUID() }, { status: error.status })
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = String(error.meta?.target ?? '')
    if (target.includes('week_key')) {
      return NextResponse.json({ error: { code: 'WEEK_ALREADY_EXISTS', message: 'Siklus minggu ini sudah ada' }, requestId: crypto.randomUUID() }, { status: 409 })
    }
    return NextResponse.json({ error: { code: 'CONFLICT', message: 'Data serupa sudah ada' }, requestId: crypto.randomUUID() }, { status: 409 })
  }
  console.error('Mutation failed', error)
  return NextResponse.json({ error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Data sementara tidak dapat disimpan' }, requestId: crypto.randomUUID() }, { status: 503 })
}
