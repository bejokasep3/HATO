import { z } from 'zod'

export const idSchema = z.uuid()
export const calendarDateSchema = z.iso.date()
export const instantSchema = z.iso.datetime({ offset: true })
export const decimalSchema = z.string().regex(/^\d+(?:\.\d{1,2})?$/)
export const positiveDecimalSchema = decimalSchema.refine((value) => Number(value) > 0)
export const nonNegativeDecimalSchema = decimalSchema
export const versionSchema = z.int().nonnegative()

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
  requestId: z.string().min(1),
})
