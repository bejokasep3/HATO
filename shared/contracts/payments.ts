import { z } from 'zod'
import { idSchema, instantSchema, nonNegativeDecimalSchema, positiveDecimalSchema, versionSchema } from './common'

export const paymentMethodSchema = z.enum(['cash', 'transfer', 'other'])
export const createPaymentSchema = z.object({
  amount: positiveDecimalSchema,
  method: paymentMethodSchema,
  occurredAt: instantSchema.optional(),
  note: z.string().trim().max(1000).nullable().optional(),
})

export const reversePaymentSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export const confirmOpeningBalanceSchema = z.object({
  expectedVersion: versionSchema,
  paidAmount: nonNegativeDecimalSchema,
  reason: z.string().trim().min(1).max(500),
}).strict()

export const paymentV2Schema = z.object({
  id: idSchema,
  orderId: idSchema,
  amount: positiveDecimalSchema,
  method: paymentMethodSchema,
  occurredAt: instantSchema.nullable(),
  createdAt: instantSchema,
  reversedAt: instantSchema.nullable(),
})
