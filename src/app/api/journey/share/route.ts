import { NextRequest } from 'next/server';
import { api, readJson } from '../../../../lib/server/http';
import { shareSchema } from '../../../../lib/server/validation';
import { publicOrigin } from '../../../../lib/server/origin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  return api(
    request,
    async ({ store, sessionId }) => {
      const { name } = await readJson(request, shareSchema);
      const result = store.share(sessionId, name);
      return { ...result, url: `${publicOrigin(request)}/shared/${result.token}` };
    },
    { session: true, write: true, status: 201 },
  );
}
