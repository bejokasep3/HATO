import { z } from 'zod'
import { calendarDateSchema, idSchema, nonNegativeDecimalSchema, versionSchema } from './common'

export const targetGroupSchema = z.enum(['AYAM', 'TAHU'])
export const productGroupSchema = z.enum(['AYAM', 'TAHU', 'NONE'])
export const periodStateSchema = z.enum(['draft', 'open', 'closed'])
export const cycleTargetSchema = z.object({
  groupCode: targetGroupSchema,
  quantity: nonNegativeDecimalSchema,
})

export const createCycleSchema = z.object({
  periodStart: calendarDateSchema,
  targets: z.array(cycleTargetSchema).length(2).refine(
    (targets) => new Set(targets.map((target) => target.groupCode)).size === 2,
    'Target AYAM dan TAHU harus diisi tepat sekali',
  ),
  notes: z.string().trim().max(2000).nullable().optional(),
  copyPreviousPrices: z.boolean().optional(),
})

export const changeTargetsSchema = z.object({
  expectedVersion: versionSchema,
  reason: z.string().trim().min(1).max(500),
  targets: createCycleSchema.shape.targets,
})

export const cycleV2Schema = z.object({
  id: idSchema,
  label: z.string(),
  periodStart: calendarDateSchema,
  periodEnd: calendarDateSchema,
  supplierDeadline: calendarDateSchema,
  deliveryDate: calendarDateSchema,
  periodState: periodStateSchema,
  version: versionSchema,
  targets: z.array(cycleTargetSchema),
})
