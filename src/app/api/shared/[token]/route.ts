import { NextRequest } from 'next/server';
import { api } from '../../../../lib/server/http';
import { tokenSchema } from '../../../../lib/server/validation';
import { ApiError } from '../../../../lib/server/store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  return api(request, async ({ store }) => {
    const parsed = tokenSchema.safeParse((await context.params).token);
    if (!parsed.success) throw new ApiError(404, '这条分享旅程不存在或已经失效');
    return { snapshot: store.getSnapshot(parsed.data) };
  });
}
