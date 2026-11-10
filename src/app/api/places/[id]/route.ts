import { NextRequest } from 'next/server';
import { api } from '../../../../lib/server/http';
import { placeIdSchema } from '../../../../lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return api(request, async ({ store }) => ({
    place: store.getPlace(placeIdSchema.parse((await context.params).id)),
  }));
}
