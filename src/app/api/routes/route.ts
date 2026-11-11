import { NextRequest } from 'next/server';
import { api } from '../../../lib/server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  return api(request, ({ store }) => ({ routes: store.getRoutes() }), { public: true });
}
