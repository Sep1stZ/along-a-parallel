import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { api, assertSameOrigin, readJson } from '../src/lib/server/http';
import { ApiError } from '../src/lib/server/store';
import { favoriteSchema, portableJourneySchema } from '../src/lib/server/validation';
import { configuredOrigin, publicOrigin } from '../src/lib/server/origin';
import { isApiError } from '../src/lib/server/errors';
import { Store } from '../src/lib/server/store';

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

test('canonical HTTPS origin works behind an internal HTTP reverse proxy without trusting forwarding headers', () => {
  const previous = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = 'https://atlas.example.com';
  try {
    const request = new NextRequest('http://app:3000/api/journey', {
      headers: {
        host: 'app:3000',
        origin: 'https://atlas.example.com',
        'x-forwarded-host': 'attacker.example',
        'x-forwarded-proto': 'http',
        'sec-fetch-site': 'same-origin',
      },
    });
    assert.equal(publicOrigin(request), 'https://atlas.example.com');
    assert.doesNotThrow(() => assertSameOrigin(request));
    assert.throws(
      () =>
        assertSameOrigin(
          new NextRequest('http://app:3000/api/journey', {
            headers: { origin: 'https://attacker.example', 'x-forwarded-host': 'attacker.example' },
          }),
        ),
      (error) => error instanceof ApiError && error.status === 403,
    );
  } finally {
    if (previous === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previous;
  }
  assert.equal(configuredOrigin('https://atlas.example.com/'), 'https://atlas.example.com');
  for (const value of [
    'file:///tmp/atlas',
    'https://user:pass@atlas.example.com',
    'https://atlas.example.com/route',
    'https://atlas.example.com?redirect=attacker',
  ]) {
    assert.throws(() => configuredOrigin(value));
  }
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

test('portable imports allow a bounded larger JSON body while the ordinary write limit remains small', async () => {
  const body = JSON.stringify({
    version: 2,
    journey: { latitude: 30, band: 2, longitude: 120, selectedCity: null, compare: [] },
    favorites: [],
    explored: Array.from({ length: 2000 }, (_, index) => `geonames-${index}`),
  });
  const request = (value: string) =>
    new NextRequest('http://localhost:3000/api/journey/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: value,
    });
  await assert.rejects(
    readJson(request(body), portableJourneySchema),
    (error) => error instanceof ApiError && error.status === 413,
  );
  assert.equal(
    (await readJson(request(body), portableJourneySchema, 2 * 1024 * 1024)).explored.length,
    2000,
  );
  await assert.rejects(
    readJson(request(' '.repeat(2 * 1024 * 1024 + 1)), portableJourneySchema, 2 * 1024 * 1024),
    (error) => error instanceof ApiError && error.status === 413,
  );
});

test('HMR errors from an older Store retain their HTTP status instead of becoming 500', async () => {
  const legacyError = Object.assign(new Error('原作者已撤销这条分享旅程'), { status: 410 });
  assert.equal(legacyError instanceof ApiError, false);
  assert.equal(isApiError(legacyError), true);
  assert.equal(isApiError(new ApiError(404, '不存在')), true);
  assert.equal(isApiError(Object.assign(new Error('invalid'), { status: 200 })), false);
  assert.equal(isApiError({ status: 410, message: 'plain input' }), false);
  const state = globalThis as unknown as { parallelStore?: Store };
  const previous = state.parallelStore;
  const store = new Store(':memory:');
  state.parallelStore = store;
  try {
    const response = await api(new NextRequest('http://localhost:3000/api/shared/test'), () => {
      throw legacyError;
    });
    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), { error: legacyError.message });
    assert.match(response.headers.get('cache-control')!, /no-store/);
  } finally {
    state.parallelStore = previous;
    store.close();
  }
});
