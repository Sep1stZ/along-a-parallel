import type { NextRequest } from 'next/server';
import { ApiError } from './store';

/** Server configuration, never derived from untrusted forwarding headers. */
export function configuredOrigin(value = process.env.APP_ORIGIN): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error('Invalid APP_ORIGIN');
    }
    return url.origin;
  } catch {
    throw new Error('APP_ORIGIN must be a single http(s) origin without credentials or path');
  }
}

export function publicOrigin(request: NextRequest): string {
  const canonical = configuredOrigin();
  if (canonical) return canonical;
  // Next can normalize its internal URL to localhost while the browser uses
  // 127.0.0.1. Host is the browser's target authority. Forwarded-Host is ignored.
  const requestUrl = new URL(request.url);
  const authority = request.headers.get('host') || requestUrl.host;
  try {
    const target = new URL(`${requestUrl.protocol}//${authority}`);
    if (target.host !== authority.toLowerCase() || target.username || target.password) {
      throw new Error('Invalid authority');
    }
    return target.origin;
  } catch {
    throw new ApiError(403, '请从本站页面发起操作');
  }
}
