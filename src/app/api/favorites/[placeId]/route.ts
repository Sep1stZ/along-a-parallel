import { NextRequest } from 'next/server';
import { api } from '../../../../lib/server/http';
import { placeIdSchema } from '../../../../lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ placeId: string }> },
) {
  return api(
    request,
    async ({ store, sessionId }) => ({
      favorites: store.removeFavorite(
        sessionId,
        placeIdSchema.parse((await context.params).placeId),
      ),
    }),
    { session: true, write: true },
  );
}
