import { z } from 'zod'
import { decimalSchema, idSchema, versionSchema } from './common'

export const recapItemInputSchema = z.object({
  productId: idSchema,
  quantity: decimalSchema,
})

export const confirmRecapSchema = z.object({
  expectedVersion: versionSchema,
  items: z.array(recapItemInputSchema).refine(
    (items) => new Set(items.map((item) => item.productId)).size === items.length,
    'Produk rekap tidak boleh duplikat',
  ),
})

export const availabilityItemSchema = z.object({
  productId: idSchema,
  capacity: decimalSchema.nullable(),
  allocated: decimalSchema,
  availableToOrder: decimalSchema.nullable(),
  shortage: decimalSchema.nullable(),
  source: z.enum(['planned', 'received', 'unknown']),
})

export const saveReceiptDraftSchema = z.object({
  cycleId: idSchema,
  expectedVersion: versionSchema,
  supplierNote: z.string().trim().max(2000).nullable().optional(),
  items: z.array(z.object({
    productId: idSchema,
    receivedQty: decimalSchema,
    damagedQty: decimalSchema,
    purchasePrice: decimalSchema,
    notes: z.string().trim().max(2000).nullable().optional(),
  })).refine((items) => new Set(items.map((item) => item.productId)).size === items.length, 'Produk penerimaan tidak boleh duplikat'),
})

export const confirmReceiptSchema = z.object({ expectedVersion: versionSchema })
