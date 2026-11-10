import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { assertSameOrigin, readJson } from '../src/lib/server/http';
import { ApiError } from '../src/lib/server/store';
import { favoriteSchema } from '../src/lib/server/validation';

test('writes reject cross-site and mismatched origins', () => {
  const url = 'http://localhost:3000/api/favorites';
  assert.doesNotThrow(() =>
    assertSameOrigin(
      new NextRequest(url, {
        headers: { origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' },
      }),
    ),
  );
  assert.doesNotThrow(() => assertSameOrigin(new NextRequest(url)));
  const maliciousHeaders: Record<string, string>[] = [
    { origin: 'https://evil.example' },
    { 'sec-fetch-site': 'cross-site' },
  ];
  for (const headers of maliciousHeaders) {
    assert.throws(
      () => assertSameOrigin(new NextRequest(url, { headers })),
      (error) => error instanceof ApiError && error.status === 403,
    );
  }
});

test('CSRF origin uses browser Host when Next normalizes its internal request URL', () => {
  const internalUrl = 'http://localhost:3000/api/journey';
  assert.doesNotThrow(() =>
    assertSameOrigin(
      new NextRequest(internalUrl, {
        headers: {
          host: '127.0.0.1:3000',
          origin: 'http://127.0.0.1:3000',
          'sec-fetch-site': 'same-origin',
        },
      }),
    ),
  );
  assert.throws(
    () =>
      assertSameOrigin(
        new NextRequest(internalUrl, {
          headers: {
            host: '127.0.0.1:3000',
            origin: 'http://localhost:3000',
            'x-forwarded-host': 'localhost:3000',
          },
        }),
      ),
    (error) => error instanceof ApiError && error.status === 403,
  );
  assert.throws(
    () =>
      assertSameOrigin(
        new NextRequest(internalUrl, {
          headers: {
            host: '127.0.0.1:3000',
            origin: 'https://evil.example',
            'x-forwarded-host': 'evil.example',
          },
        }),
      ),
    (error) => error instanceof ApiError && error.status === 403,
  );
});

test('request parser enforces JSON content type, schema and actual streamed body size', async () => {
  const request = (body: string, headers: Record<string, string> = {}) =>
    new NextRequest('http://localhost:3000/api/favorites', {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json', ...headers },
    });
  assert.deepEqual(await readJson(request('{"placeId":"hangzhou"}'), favoriteSchema), {
    placeId: 'hangzhou',
  });
  await assert.rejects(
    readJson(request('{"placeId":"hangzhou"}', { 'content-type': 'text/plain' }), favoriteSchema),
    (error) => error instanceof ApiError && error.status === 415,
  );
  await assert.rejects(
    readJson(request('{'), favoriteSchema),
    (error) => error instanceof ApiError && error.status === 400,
  );
  await assert.rejects(
    readJson(request('{"placeId":"hangzhou","sessionId":"another-user"}'), favoriteSchema),
  );
  await assert.rejects(
    readJson(request(JSON.stringify({ placeId: 'x'.repeat(17000) })), favoriteSchema),
    (error) => error instanceof ApiError && error.status === 413,
  );
  await assert.rejects(
    readJson(request('{}', { 'content-length': '17000' }), favoriteSchema),
    (error) => error instanceof ApiError && error.status === 413,
  );
});
