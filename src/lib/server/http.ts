import { NextRequest, NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { ApiError, getStore, type Store } from './store';
import { publicOrigin } from './origin';

const COOKIE = 'parallel_session';
const MAX_BODY = 16 * 1024;
type Context = { store: Store; sessionId: string };
type Handler = (context: Context) => unknown | Promise<unknown>;

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  const expectedOrigin = publicOrigin(request);
  if (fetchSite === 'cross-site' || (origin !== null && origin !== expectedOrigin)) {
    throw new ApiError(403, '请从本站页面发起操作');
  }
}

export async function readJson<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || ''))
    throw new ApiError(415, '请使用 JSON 格式提交');
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY))
    throw new ApiError(413, '请求内容过大');
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        throw new ApiError(413, '请求内容过大');
      }
      chunks.push(chunk.value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(400, 'JSON 格式无效');
  }
  return schema.parse(value);
}

export async function api(
  request: NextRequest,
  handler: Handler,
  options: { session?: boolean; write?: boolean; status?: number } = {},
) {
  let freshToken: string | undefined;
  try {
    if (options.write) assertSameOrigin(request);
    const store = getStore();
    const session = options.session
      ? store.resolveSession(request.cookies.get(COOKIE)?.value)
      : { id: '' };
    freshToken = session.token;
    const result = await handler({ store, sessionId: session.id });
    const response = NextResponse.json(result, { status: options.status || 200 });
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    if (freshToken)
      response.cookies.set(COOKIE, freshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: publicOrigin(request).startsWith('https:'),
        path: '/',
        maxAge: 180 * 24 * 60 * 60,
      });
    return response;
  } catch (error) {
    const status = error instanceof ApiError ? error.status : error instanceof ZodError ? 400 : 500;
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof ZodError
          ? '请求参数无效，请检查纬度、带宽与城市选择'
          : '暂时无法保存，请稍后重试';
    if (status === 500) console.error('API failure', error);
    const response = NextResponse.json({ error: message }, { status });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
}
