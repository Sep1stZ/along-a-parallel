import { NextRequest } from 'next/server';
import { api, readJson } from '../../../../lib/server/http';
import { portableJourneySchema } from '../../../../lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  return api(
    request,
    async ({ store, sessionId }) =>
      store.importJourney(
        sessionId,
        await readJson(request, portableJourneySchema, 2 * 1024 * 1024),
      ),
    { session: true, write: true },
  );
}
