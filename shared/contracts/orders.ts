import { z } from 'zod'
import { decimalSchema, idSchema, positiveDecimalSchema, versionSchema } from './common'

export const priceTypeSchema = z.enum(['consumer', 'trader'])
export const orderItemInputSchema = z.object({
  productId: idSchema,
  priceType: priceTypeSchema,
  quantity: positiveDecimalSchema,
})

export const createOrderV2Schema = z.strictObject({
  cycleId: idSchema,
  memberId: idSchema,
  items: z.array(orderItemInputSchema).min(1).refine(
    (items) => new Set(items.map((item) => `${item.productId}:${item.priceType}`)).size === items.length,
    'Produk dan jenis harga tidak boleh duplikat',
  ),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export const editOrderV2Schema = z.strictObject({
  id: idSchema,
  expectedVersion: versionSchema,
  items: createOrderV2Schema.shape.items,
  notes: z.string().trim().max(2000).nullable().optional(),
})

export const orderReasonSchema = z.object({
  expectedVersion: versionSchema,
  reason: z.string().trim().min(1).max(500),
})

export const fulfillmentSchema = z.object({
  expectedVersion: versionSchema,
  status: z.enum(['confirmed', 'shipped', 'delivered']),
})

export const orderPaymentSummarySchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('unverified'), paidAmount: z.null(), outstandingAmount: z.null() }),
  z.object({
    status: z.enum(['unpaid', 'partial', 'paid']),
    paidAmount: decimalSchema,
    outstandingAmount: decimalSchema,
  }),
])

export const orderV2Schema = z.object({
  id: idSchema,
  cycleId: idSchema,
  memberId: idSchema,
  version: versionSchema,
  totalAmount: decimalSchema,
  paymentSummary: orderPaymentSummarySchema,
  cancelledAt: z.iso.datetime({ offset: true }).nullable(),
  items: z.array(z.object({
    id: idSchema,
    productId: idSchema,
    priceType: priceTypeSchema,
    quantity: positiveDecimalSchema,
    unitPrice: decimalSchema,
    subtotal: decimalSchema,
  })),
})
