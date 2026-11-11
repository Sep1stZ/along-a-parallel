import { NextRequest } from 'next/server';
import { api } from '../../../lib/server/http';
import {
  latitudeSchema,
  bandSchema,
  queryNumber,
  listIdsSchema,
  listLimitSchema,
  listOffsetSchema,
  contentLevelSchema,
  searchSchema,
} from '../../../lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  return api(
    request,
    ({ store }) => {
      const params = request.nextUrl.searchParams;
      if (params.has('ids'))
        return store.listPlaces({ ids: listIdsSchema.parse(params.get('ids')?.split(',')) });
      const q = searchSchema.parse(params.get('q') ?? '');
      const latitude =
        q && !params.has('latitude')
          ? undefined
          : queryNumber(params.get('latitude'), 30, latitudeSchema);
      const band = queryNumber(params.get('band'), 2, bandSchema);
      const limit = queryNumber(params.get('limit'), 60, listLimitSchema);
      const offset = queryNumber(params.get('offset'), 0, listOffsetSchema);
      const level = contentLevelSchema.parse(params.get('level') ?? 'all');
      return store.listPlaces({ latitude, band, q, limit, offset, level });
    },
    { public: true },
  );
}
