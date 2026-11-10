import { NextRequest } from 'next/server';
import { api } from '../../../lib/server/http';
import { latitudeSchema, bandSchema, queryNumber } from '../../../lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  return api(request, ({ store }) => {
    const latitude = queryNumber(request.nextUrl.searchParams.get('latitude'), 30, latitudeSchema);
    const band = queryNumber(request.nextUrl.searchParams.get('band'), 2, bandSchema);
    return { places: store.getPlaces(latitude, band) };
  });
}
