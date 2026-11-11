import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, ApiError } from '../src/lib/server/store';
import { catalogSummaries } from '../src/data/catalog';
import {
  bandSchema,
  journeyPatchSchema,
  latitudeSchema,
  normalizeLongitude,
  queryNumber,
} from '../src/lib/server/validation';

test('latitude filtering respects actual coordinates and inclusive boundaries', () => {
  const store = new Store(':memory:');
  try {
    assert.ok(store.getPlaces(30, 2).some((p) => p.id === 'hangzhou'));
    assert.ok(store.getPlaces(45, 2).some((p) => p.id === 'venice'));
    assert.ok(store.getPlaces(-23, 2).some((p) => p.id === 'rio'));
    const place = store.getPlace('hangzhou');
    const difference = Math.abs(place.latitude - 30);
    assert.ok(store.getPlaces(30, difference).some((p) => p.id === place.id));
    assert.ok(!store.getPlaces(30, difference - 0.000001).some((p) => p.id === place.id));
    assert.deepEqual(store.getPlaces(89.123456, 0), []);
    const plan = store.db
      .prepare(
        'EXPLAIN QUERY PLAN SELECT summary FROM places WHERE active=1 AND latitude BETWEEN ? AND ? ORDER BY longitude,id LIMIT 60',
      )
      .all(28, 32);
    assert.match(JSON.stringify(plan), /SEARCH places USING INDEX places_latitude/);
  } finally {
    store.close();
  }
});

test('favorites are unique, scoped to owner, persistent and preserved by seeding', () => {
  const directory = mkdtempSync(join(tmpdir(), 'parallel-test-'));
  const filename = join(directory, 'test.sqlite');
  let store = new Store(filename);
  try {
    const a = store.resolveSession();
    const b = store.resolveSession();
    assert.ok(a.token);
    assert.notEqual(a.id, a.token, 'the database only stores a hash of cookie tokens');
    store.addFavorite(a.id, 'hangzhou');
    store.addFavorite(a.id, 'hangzhou');
    assert.deepEqual(store.favorites(a.id), ['hangzhou']);
    assert.deepEqual(store.favorites(b.id), []);
    store.removeFavorite(b.id, 'hangzhou');
    assert.deepEqual(store.favorites(a.id), ['hangzhou']);
    store.updateJourney(a.id, {
      explored: ['hangzhou', 'cairo'],
      selectedCity: 'cairo',
      longitude: 31.2357,
    });
    const before = store.db.prepare('SELECT total_changes() AS n').get()?.n;
    assert.equal(store.seed(), false);
    assert.equal(store.db.prepare('SELECT total_changes() AS n').get()?.n, before);
    assert.deepEqual(store.favorites(a.id), ['hangzhou']);
    assert.equal(
      store.db.prepare('SELECT count(*) AS n FROM places WHERE active=1').get()?.n,
      catalogSummaries.length,
    );
    store.close();
    store = new Store(filename);
    assert.equal(store.resolveSession(a.token).id, a.id);
    assert.deepEqual(store.favorites(a.id), ['hangzhou']);
    assert.equal(store.getJourney(a.id).selectedCity, 'cairo');
    assert.deepEqual(store.getJourney(b.id).explored, []);
    assert.throws(
      () => store.addFavorite('a-client-record-id', 'hangzhou'),
      (error) => error instanceof ApiError && error.status === 401,
    );
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('public snapshots remain immutable when the private journey and favorites change', () => {
  const store = new Store(':memory:');
  try {
    const owner = store.resolveSession();
    store.updateJourney(owner.id, { explored: ['hangzhou'], compare: ['hangzhou', 'cairo'] });
    store.addFavorite(owner.id, 'hangzhou');
    const { token, snapshot } = store.share(owner.id, '测试旅程');
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(snapshot.schemaVersion, 2);
    assert.deepEqual(new Set(snapshot.cityIds), new Set(['hangzhou', 'cairo']));
    assert.ok(!JSON.stringify(snapshot).includes(owner.id));
    assert.ok(!JSON.stringify(snapshot).includes(owner.token!));
    store.updateJourney(owner.id, {
      latitude: -23,
      selectedCity: 'rio',
      longitude: -43.1729,
      explored: ['rio'],
      compare: [],
    });
    store.removeFavorite(owner.id, 'hangzhou');
    assert.deepEqual(store.getSnapshot(token), snapshot);
    assert.deepEqual(store.getSnapshot(token).favorites, ['hangzhou']);
    assert.throws(
      () => store.getSnapshot('missing'),
      (error) => error instanceof ApiError && error.status === 404,
    );
  } finally {
    store.close();
  }
});

test('journey validation rejects unknown fields, malformed coordinates, duplicate and excessive comparisons', () => {
  assert.equal(normalizeLongitude(180), -180);
  assert.equal(normalizeLongitude(540), -180);
  assert.equal(normalizeLongitude(-181), 179);
  assert.equal(queryNumber(null, 30, latitudeSchema), 30);
  for (const value of ['NaN', 'Infinity', '', '91'])
    assert.throws(() => queryNumber(value, 30, latitudeSchema));
  assert.throws(() => queryNumber('-1', 2, bandSchema));
  for (const input of [
    {},
    { owner: 'someone-else' },
    { latitude: 91 },
    { longitude: Number.NaN },
    { compare: ['hangzhou', 'cairo', 'lhasa'] },
    { compare: ['hangzhou', 'hangzhou'] },
    { explored: ['../../etc/passwd'] },
  ])
    assert.equal(journeyPatchSchema.safeParse(input).success, false);
  const store = new Store(':memory:');
  try {
    const session = store.resolveSession();
    assert.throws(
      () => store.updateJourney(session.id, { latitude: -23, selectedCity: 'hangzhou' }),
      (error) => error instanceof ApiError && error.status === 400,
    );
    assert.throws(
      () => store.updateJourney(session.id, { explored: ['unknown-city'] }),
      (error) => error instanceof ApiError && error.status === 404,
    );
    assert.equal(store.updateJourney(session.id, { latitude: 80 }).selectedCity, null);
  } finally {
    store.close();
  }
});
