import { NextRequest } from 'next/server';
import { api, readJson } from '../../../lib/server/http';
import { favoriteSchema } from '../../../lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  return api(request, ({ store, sessionId }) => ({ favorites: store.favorites(sessionId) }), {
    session: true,
  });
}
export async function POST(request: NextRequest) {
  return api(
    request,
    async ({ store, sessionId }) => {
      const { placeId } = await readJson(request, favoriteSchema);
      return { favorites: store.addFavorite(sessionId, placeId) };
    },
    { session: true, write: true },
  );
}
