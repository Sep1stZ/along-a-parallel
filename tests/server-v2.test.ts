import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store, ApiError, getStore, type Snapshot } from '../src/lib/server/store';
import { catalogSummaries, curatedPlaces, catalogVersion } from '../src/data/catalog';
import { portableJourneySchema, journeyPatchSchema } from '../src/lib/server/validation';

test('catalog search, pagination, lightweight summaries and geography operate beyond the original cities', () => {
  const store = new Store(':memory:');
  try {
    const catalog = store.getCatalog();
    assert.equal(catalog.version, catalogVersion);
    assert.equal(catalog.total, catalogSummaries.length);
    assert.equal(catalog.curatedTotal, curatedPlaces.length);
    assert.equal(catalog.coverage.length, 181);
    assert.equal(
      catalog.coverage.find((row) => row.latitude === 30)?.count,
      store.getPlaces(30, 2).length,
    );
    const first = store.listPlaces({ limit: 20 });
    const second = store.listPlaces({ limit: 20, offset: 20 });
    assert.equal(first.places.length, 20);
    assert.equal(first.hasMore, true);
    assert.ok(!first.places.some((a) => second.places.some((b) => a.id === b.id)));
    assert.ok(
      first.places.every(
        (place) => !('stories' in place) && !('intro' in place) && !('sources' in place),
      ),
    );
    const newPlace = catalogSummaries.find((place) => place.level === 'catalog')!;
    assert.ok(newPlace, 'there is a base geographic catalog');
    const found = store.listPlaces({ q: newPlace.id });
    assert.ok(found.places.some((place) => place.id === newPlace.id));
    const detail = store.getPlace(newPlace.id);
    assert.equal(detail.id, newPlace.id);
    assert.equal(detail.level, 'catalog');
    assert.deepEqual(detail.stories, []);
    assert.ok(detail.sources.length, 'base geography retains its source attribution');
    assert.deepEqual(
      store.listPlaces({ ids: ['cairo', newPlace.id, 'hangzhou'] }).places.map((p) => p.id),
      ['cairo', newPlace.id, 'hangzhou'],
    );
    const curated = store.listPlaces({ latitude: 30, band: 2, level: 'curated', limit: 200 });
    assert.ok(curated.places.every((place) => place.level === 'curated'));
    assert.equal(curated.total, curated.curatedTotal);
    assert.deepEqual(store.listPlaces({ q: '%_\\' }).places, []);
    const hangzhou = store.listPlaces({ q: 'Hangzhou' });
    assert.ok(hangzhou.places.some((p) => p.id === 'hangzhou'));
  } finally {
    store.close();
  }
});

test('full band navigation wraps deterministically beyond the first page and handles shared longitudes', () => {
  const store = new Store(':memory:');
  try {
    const all = store.getPlaces(30, 2);
    assert.ok(all.length > 60);
    const last = all.at(-1)!;
    assert.equal(
      store.nearbyPlace({
        latitude: 30,
        band: 2,
        longitude: last.longitude,
        from: last.id,
        level: 'all',
        direction: 'east',
      })?.id,
      all[0].id,
    );
    assert.equal(
      store.nearbyPlace({
        latitude: 30,
        band: 2,
        longitude: all[0].longitude,
        from: all[0].id,
        level: 'all',
        direction: 'west',
      })?.id,
      last.id,
    );
    const index = 65;
    assert.equal(
      store.nearbyPlace({
        latitude: 30,
        band: 2,
        longitude: all[index].longitude,
        from: all[index].id,
        level: 'all',
        direction: 'east',
      })?.id,
      all[index + 1].id,
    );
    assert.equal(
      store.nearbyPlace({
        latitude: 89.123456,
        band: 0,
        longitude: 0,
        level: 'all',
        direction: 'nearest',
      }),
      null,
    );
    const artificial = ['test-equal-a', 'test-equal-b'];
    for (const id of artificial) {
      const summary = { ...catalogSummaries[0], id, latitude: 89.5, longitude: 179.9 };
      store.db
        .prepare(
          'INSERT INTO places(id,latitude,longitude,data,summary,search_text,level,active) VALUES(?,?,?,?,?,?,?,1)',
        )
        .run(
          id,
          summary.latitude,
          summary.longitude,
          JSON.stringify(summary),
          JSON.stringify(summary),
          id,
          summary.level,
        );
    }
    assert.equal(
      store.nearbyPlace({
        latitude: 89.5,
        band: 0,
        longitude: -179.9,
        level: 'all',
        direction: 'nearest',
      })?.id,
      artificial[0],
    );
    assert.equal(
      store.nearbyPlace({
        latitude: 89.5,
        band: 0,
        longitude: 179.9,
        from: artificial[0],
        level: 'all',
        direction: 'east',
      })?.id,
      artificial[1],
    );
    assert.equal(
      store.nearbyPlace({
        latitude: 89.5,
        band: 0,
        longitude: 179.9,
        from: artificial[1],
        level: 'all',
        direction: 'west',
      })?.id,
      artificial[0],
    );
  } finally {
    store.close();
  }
});

test('incremental exploration passes 100 and portable import merges, validates atomically and excludes session secrets', () => {
  const store = new Store(':memory:');
  try {
    const owner = store.resolveSession();
    const other = store.resolveSession();
    const ids = catalogSummaries.slice(0, 151).map((place) => place.id);
    for (const id of ids) store.updateJourney(owner.id, { visited: id });
    assert.equal(store.getJourney(owner.id).explored.length, 151);
    store.updateJourney(owner.id, { explored: [ids[0]] });
    assert.equal(
      store.getJourney(owner.id).explored.length,
      151,
      'legacy patches cannot discard incremental visits',
    );
    assert.ok(
      !String(
        store.db.prepare('SELECT data FROM journeys WHERE session_id=?').get(owner.id)?.data,
      ).includes('explored'),
    );
    store.addFavorite(owner.id, 'hangzhou');
    const portable = store.exportJourney(owner.id);
    assert.equal(portableJourneySchema.safeParse(portable).success, true);
    assert.ok(!JSON.stringify(portable).includes(owner.id));
    assert.ok(!JSON.stringify(portable).includes(owner.token!));
    store.addFavorite(other.id, 'cairo');
    store.updateJourney(other.id, { visited: 'venice' });
    const imported = store.importJourney(other.id, portable);
    assert.ok(imported.favorites.includes('cairo') && imported.favorites.includes('hangzhou'));
    assert.ok(imported.explored.includes('venice'));
    assert.ok(ids.every((id) => imported.explored.includes(id)));
    assert.deepEqual(store.importJourney(other.id, portable), imported);
    assert.throws(
      () =>
        store.importJourney(other.id, {
          ...portable,
          favorites: ['hangzhou', 'unknown-city'],
          explored: ['cairo'],
        }),
      (error) => error instanceof ApiError && error.status === 404,
    );
    assert.deepEqual(
      store.exportJourney(other.id),
      imported,
      'no partial writes on invalid imported city',
    );
    assert.equal(
      journeyPatchSchema.safeParse({ explored: ids }).success,
      false,
      'large arrays use portable import rather than legacy PATCH',
    );
    assert.equal(
      portableJourneySchema.safeParse({ ...portable, sessionId: owner.id }).success,
      false,
    );
  } finally {
    store.close();
  }
});

test('V2 shares are bounded, frozen, owner listed and revocable without affecting other owners', () => {
  const store = new Store(':memory:');
  try {
    const owner = store.resolveSession();
    const other = store.resolveSession();
    for (const place of catalogSummaries.slice(0, 75))
      store.updateJourney(owner.id, { visited: place.id });
    store.addFavorite(owner.id, 'cairo');
    store.updateJourney(owner.id, { compare: ['hangzhou', 'cairo'] });
    const { token, snapshot } = store.share(owner.id, '有界快照');
    assert.equal(snapshot.schemaVersion, 2);
    assert.equal(snapshot.places.length, 60);
    assert.equal(snapshot.cityIds.length, 60);
    assert.equal(snapshot.truncated, true);
    assert.ok(snapshot.cityIds.includes('cairo') && snapshot.cityIds.includes('hangzhou'));
    assert.ok(snapshot.explored.length <= 60 && snapshot.favorites.length <= 60);
    store.db
      .prepare('UPDATE places SET data=? WHERE id=?')
      .run(JSON.stringify({ ...store.getPlace('cairo'), name: 'changed' }), 'cairo');
    assert.deepEqual(store.getSnapshot(token), snapshot);
    assert.deepEqual(store.listShares(other.id), []);
    assert.equal(store.listShares(owner.id)[0].name, '有界快照');
    assert.throws(
      () => store.revokeShare(other.id, token),
      (error) => error instanceof ApiError && error.status === 404,
    );
    assert.deepEqual(store.getSnapshot(token), snapshot);
    const revoked = store.revokeShare(owner.id, token);
    assert.deepEqual(store.revokeShare(owner.id, token), revoked);
    assert.equal(store.listShares(owner.id)[0].revokedAt, revoked.revokedAt);
    assert.throws(
      () => store.getSnapshot(token),
      (error) => error instanceof ApiError && error.status === 410,
    );
  } finally {
    store.close();
  }
});

test('V1 schema migrates non-destructively and repeated imports preserve old IDs, favorites, visits and frozen snapshots', () => {
  const directory = mkdtempSync(join(tmpdir(), 'parallel-v1-'));
  const filename = join(directory, 'legacy.sqlite');
  const legacy = new DatabaseSync(filename);
  const token = 'L'.repeat(43);
  const session = createHash('sha256').update(token).digest('hex');
  const shareToken = 'S'.repeat(43);
  const hangzhou = curatedPlaces.find((place) => place.id === 'hangzhou')!;
  const historical = { ...hangzhou, id: 'retired-city', name: '旧档案' };
  const position = {
    latitude: 30,
    band: 2,
    longitude: 120.1551,
    selectedCity: 'hangzhou',
    explored: ['hangzhou', 'retired-city'],
    compare: [],
  };
  const snapshot: Snapshot = {
    ...position,
    name: 'V1原快照',
    cityIds: ['hangzhou'],
    favorites: ['retired-city'],
    places: [hangzhou, historical],
    createdAt: '2026-11-01T00:00:00.000Z',
  };
  const originalJSON = JSON.stringify(snapshot);
  legacy.exec(`CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL); INSERT INTO schema_migrations VALUES(1,'2026-11-01');
    CREATE TABLE places(id TEXT PRIMARY KEY,latitude REAL NOT NULL,longitude REAL NOT NULL,data TEXT NOT NULL);
    CREATE INDEX places_latitude ON places(latitude);
    CREATE TABLE stories(place_id TEXT NOT NULL REFERENCES places(id),theme TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(place_id,theme));
    CREATE TABLE sources(place_id TEXT NOT NULL REFERENCES places(id),url TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(place_id,url));
    CREATE TABLE routes(id TEXT PRIMARY KEY,data TEXT NOT NULL);
    CREATE TABLE anonymous_sessions(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,expires_at TEXT NOT NULL);
    CREATE TABLE favorites(session_id TEXT NOT NULL REFERENCES anonymous_sessions(id) ON DELETE CASCADE,place_id TEXT NOT NULL REFERENCES places(id),created_at TEXT NOT NULL,PRIMARY KEY(session_id,place_id));
    CREATE TABLE journeys(session_id TEXT PRIMARY KEY REFERENCES anonymous_sessions(id) ON DELETE CASCADE,data TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE shared_journeys(token TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES anonymous_sessions(id) ON DELETE CASCADE,snapshot TEXT NOT NULL,created_at TEXT NOT NULL);`);
  for (const place of [hangzhou, historical])
    legacy
      .prepare('INSERT INTO places VALUES(?,?,?,?)')
      .run(place.id, place.latitude, place.longitude, JSON.stringify(place));
  legacy
    .prepare('INSERT INTO anonymous_sessions VALUES(?,?,?)')
    .run(session, '2026-11-01', '2099-01-01');
  legacy.prepare('INSERT INTO favorites VALUES(?,?,?)').run(session, 'retired-city', '2026-11-01');
  legacy
    .prepare('INSERT INTO journeys VALUES(?,?,?)')
    .run(session, JSON.stringify(position), '2026-11-01');
  legacy
    .prepare('INSERT INTO shared_journeys VALUES(?,?,?,?)')
    .run(shareToken, session, originalJSON, '2026-11-01');
  legacy.close();
  let store = new Store(filename);
  try {
    assert.equal(store.resolveSession(token).id, session);
    assert.deepEqual(store.favorites(session), ['retired-city']);
    assert.deepEqual(store.getJourney(session).explored, position.explored);
    assert.equal(store.getPlace('retired-city').name, '旧档案');
    assert.equal(store.listPlaces({ q: 'retired-city' }).total, 0);
    assert.deepEqual(store.getSnapshot(shareToken), snapshot);
    assert.equal(
      store.db.prepare('SELECT snapshot FROM shared_journeys WHERE token=?').get(shareToken)
        ?.snapshot,
      originalJSON,
    );
    const changes = store.db.prepare('SELECT total_changes() AS count').get()?.count;
    assert.equal(store.seed(), false);
    assert.equal(store.db.prepare('SELECT total_changes() AS count').get()?.count, changes);
    store.close();
    store = new Store(filename);
    assert.deepEqual(store.getSnapshot(shareToken), snapshot);
    assert.equal(
      store.db.prepare('SELECT count(*) AS count FROM schema_migrations').get()?.count,
      2,
    );
    assert.equal(store.db.prepare('SELECT count(*) AS count FROM catalog_imports').get()?.count, 1);
    assert.deepEqual(store.favorites(session), ['retired-city']);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('development catalog refresh replaces a stale global Store while preserving private state', () => {
  const directory = mkdtempSync(join(tmpdir(), 'parallel-hmr-'));
  const state = globalThis as unknown as { parallelStore?: Store; parallelStoreRevision?: string };
  const previousStore = state.parallelStore;
  const previousRevision = state.parallelStoreRevision;
  const environment = process.env as Record<string, string | undefined>;
  const previousEnvironment = environment.NODE_ENV;
  const initial = new Store(join(directory, 'test.sqlite'));
  let refreshed: Store | undefined;
  try {
    const session = initial.resolveSession();
    initial.addFavorite(session.id, 'hangzhou');
    initial.db
      .prepare('UPDATE catalog_state SET import_key=? WHERE id=1')
      .run('old-development-catalog');
    initial.db
      .prepare('UPDATE places SET data=? WHERE id=?')
      .run(
        JSON.stringify({ ...initial.getPlace('hangzhou'), name: 'stale development content' }),
        'hangzhou',
      );
    state.parallelStore = initial;
    state.parallelStoreRevision = 'old-development-catalog';
    environment.NODE_ENV = 'development';
    refreshed = getStore();
    assert.notEqual(refreshed, initial);
    assert.equal(getStore(), refreshed, 'an unchanged development store remains stable');
    assert.equal(refreshed.getPlace('hangzhou').name, '杭州');
    assert.deepEqual(refreshed.favorites(session.id), ['hangzhou']);
    assert.equal(
      initial.getPlace('hangzhou').name,
      '杭州',
      'old in-flight connection is temporarily still usable',
    );
  } finally {
    if (previousEnvironment === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previousEnvironment;
    state.parallelStore = previousStore;
    state.parallelStoreRevision = previousRevision;
    refreshed?.close();
    initial.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
