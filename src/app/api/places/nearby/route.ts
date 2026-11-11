import { NextRequest } from 'next/server';
import { z } from 'zod';
import { api } from '../../../../lib/server/http';
import {
  latitudeSchema,
  longitudeSchema,
  bandSchema,
  queryNumber,
  contentLevelSchema,
  placeIdSchema,
} from '../../../../lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  return api(
    request,
    ({ store }) => {
      const params = request.nextUrl.searchParams;
      return {
        place: store.nearbyPlace({
          latitude: queryNumber(params.get('latitude'), 30, latitudeSchema),
          band: queryNumber(params.get('band'), 2, bandSchema),
          longitude: queryNumber(params.get('longitude'), 120, longitudeSchema),
          level: contentLevelSchema.parse(params.get('level') ?? 'all'),
          direction: z
            .enum(['east', 'west', 'nearest'])
            .parse(params.get('direction') ?? 'nearest'),
          from: params.has('from') ? placeIdSchema.parse(params.get('from')) : undefined,
        }),
      };
    },
    { public: true },
  );
}
