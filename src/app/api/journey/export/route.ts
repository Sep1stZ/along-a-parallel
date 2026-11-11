import { NextRequest } from 'next/server';
import { api } from '../../../../lib/server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const response = await api(request, ({ store, sessionId }) => store.exportJourney(sessionId), {
    session: true,
  });
  if (response.ok)
    response.headers.set(
      'Content-Disposition',
      'attachment; filename="along-a-parallel-journey-v2.json"',
    );
  return response;
}
