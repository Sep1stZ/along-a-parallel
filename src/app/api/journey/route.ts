import { NextRequest } from 'next/server';
import { api, readJson } from '../../../lib/server/http';
import { journeyPatchSchema } from '../../../lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  return api(request, ({ store, sessionId }) => ({ journey: store.getJourney(sessionId) }), {
    session: true,
  });
}
export async function PATCH(request: NextRequest) {
  return api(
    request,
    async ({ store, sessionId }) => ({
      journey: store.updateJourney(sessionId, await readJson(request, journeyPatchSchema)),
    }),
    { session: true, write: true },
  );
}
