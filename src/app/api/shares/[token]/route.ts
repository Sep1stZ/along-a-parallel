import { NextRequest } from 'next/server';
import { api } from '../../../../lib/server/http';
import { tokenSchema } from '../../../../lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  return api(
    request,
    async ({ store, sessionId }) =>
      store.revokeShare(sessionId, tokenSchema.parse((await context.params).token)),
    { session: true, write: true },
  );
}
