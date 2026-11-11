import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { Store } from '../src/lib/server/store';
import { catalogSummaries } from '../src/data/catalog';
import { GET as placesGet } from '../src/app/api/places/route';
import { GET as detailGet } from '../src/app/api/places/[id]/route';
import { GET as catalogGet } from '../src/app/api/catalog/route';
import { GET as nearbyGet } from '../src/app/api/places/nearby/route';
import { GET as journeyGet, PATCH as journeyPatch } from '../src/app/api/journey/route';
import { GET as exportGet } from '../src/app/api/journey/export/route';
import { POST as importPost } from '../src/app/api/journey/import/route';
import { POST as sharePost } from '../src/app/api/journey/share/route';
import { GET as sharesGet } from '../src/app/api/shares/route';
import { DELETE as shareDelete } from '../src/app/api/shares/[token]/route';
import { GET as sharedGet } from '../src/app/api/shared/[token]/route';

test('HTTP routes expose cached public summaries and private portable state with share owner isolation', async () => {
  const store = new Store(':memory:');
  const globalStore = globalThis as unknown as { parallelStore?: Store };
  const previous = globalStore.parallelStore;
  globalStore.parallelStore = store;
  const request = (
    path: string,
    options: { cookie?: string; method?: string; body?: unknown } = {},
  ) =>
    new NextRequest(`http://localhost:3000${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.cookie ? { cookie: options.cookie } : {}),
        ...(options.body === undefined
          ? {}
          : { 'content-type': 'application/json', origin: 'http://localhost:3000' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  try {
    const catalog = await catalogGet(request('/api/catalog'));
    assert.equal(catalog.status, 200);
    assert.match(catalog.headers.get('cache-control')!, /^public/);
    assert.equal(catalog.headers.get('set-cookie'), null);
    assert.equal((await catalog.json()).total, catalogSummaries.length);
    const places = await placesGet(request('/api/places?latitude=30&band=2&limit=10'));
    const listing = await places.json();
    assert.equal(listing.places.length, 10);
    assert.ok(listing.total > 10 && listing.hasMore);
    assert.equal(listing.places[0].stories, undefined);
    assert.equal(places.headers.get('set-cookie'), null);
    assert.equal((await placesGet(request('/api/places?ids=hangzhou,cairo'))).status, 200);
    assert.equal((await placesGet(request('/api/places?limit=201'))).status, 400);
    assert.equal((await placesGet(request('/api/places?offset=-1'))).status, 400);
    assert.equal(
      (
        await placesGet(
          request(
            `/api/places?ids=${Array.from({ length: 201 }, (_, i) => `city-${i}`).join(',')}`,
          ),
        )
      ).status,
      400,
    );
    const newPlace = catalogSummaries.find((place) => place.level === 'catalog')!;
    const detail = await detailGet(request(`/api/places/${newPlace.id}`), {
      params: Promise.resolve({ id: newPlace.id }),
    });
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).place.level, 'catalog');
    assert.equal(detail.headers.get('set-cookie'), null);
    const nearby = await nearbyGet(
      request('/api/places/nearby?latitude=30&band=2&longitude=120&direction=nearest'),
    );
    assert.ok((await nearby.json()).place.id);
    const sessionResponse = await journeyGet(request('/api/journey'));
    const cookie = sessionResponse.headers.get('set-cookie')!.split(';')[0];
    assert.match(sessionResponse.headers.get('set-cookie')!, /HttpOnly/);
    assert.match(sessionResponse.headers.get('cache-control')!, /private.*no-store/);
    const visit = await journeyPatch(
      request('/api/journey', { cookie, method: 'PATCH', body: { visited: newPlace.id } }),
    );
    assert.equal(visit.status, 200);
    assert.deepEqual((await visit.json()).journey.explored, [newPlace.id]);
    const exported = await exportGet(request('/api/journey/export', { cookie }));
    assert.match(exported.headers.get('content-disposition')!, /attachment/);
    assert.match(exported.headers.get('cache-control')!, /private.*no-store/);
    const portable = await exported.json();
    assert.equal(portable.version, 2);
    assert.ok(!JSON.stringify(portable).includes(cookie.split('=')[1]));
    const otherResponse = await journeyGet(request('/api/journey'));
    const otherCookie = otherResponse.headers.get('set-cookie')!.split(';')[0];
    const imported = await importPost(
      request('/api/journey/import', {
        cookie: otherCookie,
        method: 'POST',
        body: { ...portable, favorites: ['cairo'] },
      }),
    );
    assert.equal(imported.status, 200);
    assert.deepEqual((await imported.json()).favorites, ['cairo']);
    const invalid = await importPost(
      request('/api/journey/import', {
        cookie,
        method: 'POST',
        body: { ...portable, favorites: ['unknown-city'] },
      }),
    );
    assert.equal(invalid.status, 404);
    const sharing = await sharePost(
      request('/api/journey/share', { cookie, method: 'POST', body: { name: 'HTTP snapshot' } }),
    );
    assert.equal(sharing.status, 201);
    const { token, snapshot } = await sharing.json();
    const context = { params: Promise.resolve({ token }) };
    const publicSnapshot = await sharedGet(request(`/api/shared/${token}`), context);
    assert.deepEqual((await publicSnapshot.json()).snapshot, snapshot);
    assert.equal(publicSnapshot.headers.get('set-cookie'), null);
    assert.match(publicSnapshot.headers.get('cache-control')!, /no-store/);
    const otherShares = await sharesGet(request('/api/shares', { cookie: otherCookie }));
    assert.deepEqual((await otherShares.json()).shares, []);
    assert.equal(
      (
        await shareDelete(
          request(`/api/shares/${token}`, { cookie: otherCookie, method: 'DELETE' }),
          context,
        )
      ).status,
      404,
    );
    assert.equal((await sharedGet(request(`/api/shared/${token}`), context)).status, 200);
    assert.equal(
      (await shareDelete(request(`/api/shares/${token}`, { cookie, method: 'DELETE' }), context))
        .status,
      200,
    );
    const revoked = await sharedGet(request(`/api/shared/${token}`), context);
    assert.equal(revoked.status, 410);
    assert.match(revoked.headers.get('cache-control')!, /no-store/);
    assert.equal(revoked.headers.get('set-cookie'), null);
    const ownerShares = await sharesGet(request('/api/shares', { cookie }));
    assert.ok((await ownerShares.json()).shares[0].revokedAt);
  } finally {
    globalStore.parallelStore = previous;
    store.close();
  }
});
