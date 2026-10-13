import { z } from 'zod'

const serializableDecimal = z.union([z.number().finite(), z.string().regex(/^\d+(?:\.\d+)?$/)])

export const legacyPriceSchema = z.object({
  id: z.string(),
  cycleId: z.string(),
  productId: z.string(),
  price: serializableDecimal,
  consumerPrice: serializableDecimal.nullable().optional(),
  traderPrice: serializableDecimal.nullable().optional(),
  product: z.object({ name: z.string() }),
})

const legacyCycleSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.string(),
  periodStart: z.string(),
  orderDeadline: z.string(),
  deliveryDate: z.string(),
  periodEnd: z.string().nullable().optional(),
  supplierDeadline: z.string().nullable().optional(),
  periodState: z.enum(['draft', 'open', 'closed']).nullable().optional(),
  version: z.number().int().optional(),
  rulesVersion: z.number().int().optional(),
  evaluatedAt: z.iso.datetime().optional(),
})

export const legacyCyclesSchema = z.array(legacyCycleSchema)

export const legacyRotationsSchema = z.array(z.object({
  id: z.string(), cycleId: z.string(), memberId: z.string(), status: z.string(),
  member: z.object({
    id: z.string(), name: z.string(), phone: z.string(), role: z.string(),
    group: z.object({ name: z.string() }).nullable().optional(),
  }).optional(),
}).passthrough())

export const legacyCycleDetailSchema = z.object({
  cycle: legacyCycleSchema.extend({
    weeklyPrices: z.array(legacyPriceSchema),
    rotationSchedules: legacyRotationsSchema,
    orders: z.array(z.object({ id: z.string() }).passthrough()),
  }).passthrough(),
  recap: z.array(z.unknown()),
})

export const legacyPricesSchema = z.array(legacyPriceSchema)

export const legacyProductsSchema = z.array(z.object({
  id: z.string(), name: z.string(), unit: z.string(), isActive: z.boolean(),
}).passthrough())

export const legacyMembersSchema = z.array(z.object({
  id: z.string(), name: z.string(), phone: z.string(), groupId: z.string(), role: z.string(),
  group: z.object({ name: z.string() }).nullable().optional(),
}).passthrough())

export const legacyOrdersSchema = z.array(z.object({
  id: z.string(), cycleId: z.string(), memberId: z.string(),
  totalAmount: serializableDecimal, paymentStatus: z.string(), orderStatus: z.string(), createdAt: z.string(),
  member: z.object({ name: z.string(), group: z.object({ name: z.string() }).nullable().optional() }).optional(),
}).passthrough())
