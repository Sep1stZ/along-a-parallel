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
export const journeyPatchSchema = z
  .object({
    latitude: latitudeSchema.optional(),
    band: bandSchema.optional(),
    longitude: longitudeSchema.optional(),
    selectedCity: placeIdSchema.nullable().optional(),
    explored: cityIdsSchema.optional(),
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
