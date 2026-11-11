import { z } from 'zod';

export const latitudeSchema = z.number().finite().min(-90).max(90);
export const longitudeSchema = z.number().finite().min(-180).max(180);
export const bandSchema = z.number().finite().min(0).max(15);
export const placeIdSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9-]+$/);
const cityIdsSchema = z
  .array(placeIdSchema)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, '地点不能重复');
export const MAX_PORTABLE_IDS = 50_000;
export const portableIdsSchema = z
  .array(placeIdSchema)
  .max(MAX_PORTABLE_IDS)
  .refine((ids) => new Set(ids).size === ids.length, '地点不能重复');
export const journeyPatchSchema = z
  .object({
    latitude: latitudeSchema.optional(),
    band: bandSchema.optional(),
    longitude: longitudeSchema.optional(),
    selectedCity: placeIdSchema.nullable().optional(),
    explored: cityIdsSchema.optional(),
    visited: placeIdSchema.optional(),
    compare: cityIdsSchema.refine((ids) => ids.length <= 2, '最多比较两座城市').optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, '旅程更新不能为空');
export const favoriteSchema = z.object({ placeId: placeIdSchema }).strict();
export const shareSchema = z.object({ name: z.string().trim().min(1).max(80).optional() }).strict();
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const compareSchema = z
  .array(placeIdSchema)
  .length(2)
  .refine((ids) => ids[0] !== ids[1], '请选择两座不同的城市');
export const portableJourneySchema = z
  .object({
    version: z.literal(2),
    journey: z
      .object({
        latitude: latitudeSchema,
        band: bandSchema,
        longitude: longitudeSchema,
        selectedCity: placeIdSchema.nullable(),
        compare: cityIdsSchema.refine((ids) => ids.length <= 2, '最多比较两座城市'),
      })
      .strict(),
    favorites: portableIdsSchema,
    explored: portableIdsSchema,
  })
  .strict();
export type PortableJourney = z.infer<typeof portableJourneySchema>;
export const listIdsSchema = z
  .array(placeIdSchema)
  .min(1)
  .max(200)
  .refine((ids) => new Set(ids).size === ids.length, '地点不能重复');
export const listLimitSchema = z.number().int().min(1).max(200);
export const listOffsetSchema = z.number().int().min(0).max(50_000);
export const searchSchema = z.string().trim().max(100);
export const contentLevelSchema = z.enum(['all', 'curated']);

export type JourneyPatch = z.infer<typeof journeyPatchSchema>;
export function normalizeLongitude(longitude: number) {
  return longitude >= -180 && longitude < 180
    ? longitude
    : Number((((((longitude + 180) % 360) + 360) % 360) - 180).toFixed(10));
}

export function queryNumber(
  value: string | null,
  fallback: number,
  schema: z.ZodType<number>,
): number {
  if (value === null) return fallback;
  if (value.trim() === '')
    throw new z.ZodError([{ code: 'custom', path: [], message: '数值参数不能为空' }]);
  return schema.parse(Number(value));
}
