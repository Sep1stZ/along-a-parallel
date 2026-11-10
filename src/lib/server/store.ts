import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { places, type Place } from '../../data/places';
import { routes } from '../../data/routes';
import { normalizeLongitude, type JourneyPatch } from './validation';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Journey = {
  latitude: number;
  band: number;
  longitude: number;
  selectedCity: string | null;
  explored: string[];
  compare: string[];
};
export type Snapshot = Journey & {
  name: string;
  cityIds: string[];
  favorites: string[];
  places: Place[];
  createdAt: string;
};
const defaultJourney: Journey = {
  latitude: 30,
  band: 2,
  longitude: 120.1551,
  selectedCity: 'hangzhou',
  explored: [],
  compare: [],
};
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const now = () => new Date().toISOString();
const sessionDuration = 180 * 24 * 60 * 60 * 1000;

export class Store {
  readonly db: DatabaseSync;
  constructor(public readonly filename: string) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    this.migrate();
    this.seed();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS places (id TEXT PRIMARY KEY, latitude REAL NOT NULL, longitude REAL NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS stories (place_id TEXT NOT NULL REFERENCES places(id), theme TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(place_id, theme));
      CREATE TABLE IF NOT EXISTS sources (place_id TEXT NOT NULL REFERENCES places(id), url TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(place_id, url));
      CREATE TABLE IF NOT EXISTS routes (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS anonymous_sessions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS favorites (session_id TEXT NOT NULL REFERENCES anonymous_sessions(id) ON DELETE CASCADE, place_id TEXT NOT NULL REFERENCES places(id), created_at TEXT NOT NULL, PRIMARY KEY(session_id,place_id));
      CREATE TABLE IF NOT EXISTS journeys (session_id TEXT PRIMARY KEY REFERENCES anonymous_sessions(id) ON DELETE CASCADE, data TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS shared_journeys (token TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES anonymous_sessions(id) ON DELETE CASCADE, snapshot TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS places_latitude ON places(latitude);
      INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(1,datetime('now'));
    `);
  }

  seed() {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const insertPlace = this.db.prepare(
        'INSERT INTO places(id,latitude,longitude,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,data=excluded.data',
      );
      const insertStory = this.db.prepare(
        'INSERT INTO stories(place_id,theme,data) VALUES(?,?,?) ON CONFLICT(place_id,theme) DO UPDATE SET data=excluded.data',
      );
      const insertSource = this.db.prepare(
        'INSERT INTO sources(place_id,url,data) VALUES(?,?,?) ON CONFLICT(place_id,url) DO UPDATE SET data=excluded.data',
      );
      for (const place of places) {
        insertPlace.run(place.id, place.latitude, place.longitude, JSON.stringify(place));
        for (const story of place.stories)
          insertStory.run(place.id, story.theme, JSON.stringify(story));
        for (const source of place.sources)
          insertSource.run(place.id, source.url, JSON.stringify(source));
      }
      const insertRoute = this.db.prepare(
        'INSERT INTO routes(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
      );
      for (const route of routes) insertRoute.run(route.id, JSON.stringify(route));
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  getPlaces(latitude: number, band: number): Place[] {
    return this.db
      .prepare('SELECT data FROM places WHERE abs(latitude-?) <= ? ORDER BY longitude')
      .all(latitude, band)
      .map((row) => JSON.parse(String(row.data)) as Place);
  }
  getPlace(id: string): Place {
    const row = this.db.prepare('SELECT data FROM places WHERE id=?').get(id);
    if (!row) throw new ApiError(404, '没有找到这座城市');
    return JSON.parse(String(row.data)) as Place;
  }
  getRoutes() {
    return this.db
      .prepare('SELECT data FROM routes ORDER BY rowid')
      .all()
      .map((row) => JSON.parse(String(row.data)));
  }
  resolveSession(token?: string): { id: string; token?: string } {
    if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
      const id = hashToken(token);
      const row = this.db
        .prepare('SELECT id FROM anonymous_sessions WHERE id=? AND expires_at>?')
        .get(id, now());
      if (row) return { id };
    }
    const freshToken = randomBytes(32).toString('base64url');
    const id = hashToken(freshToken);
    this.db
      .prepare('INSERT INTO anonymous_sessions(id,created_at,expires_at) VALUES(?,?,?)')
      .run(id, now(), new Date(Date.now() + sessionDuration).toISOString());
    return { id, token: freshToken };
  }
  assertSession(sessionId: string) {
    if (
      !this.db
        .prepare('SELECT id FROM anonymous_sessions WHERE id=? AND expires_at>?')
        .get(sessionId, now())
    )
      throw new ApiError(401, '匿名会话已过期，请刷新页面后重试');
  }
  favorites(sessionId: string): string[] {
    this.assertSession(sessionId);
    return this.db
      .prepare('SELECT place_id FROM favorites WHERE session_id=? ORDER BY created_at,place_id')
      .all(sessionId)
      .map((row) => String(row.place_id));
  }
  addFavorite(sessionId: string, placeId: string) {
    this.assertSession(sessionId);
    this.getPlace(placeId);
    this.db
      .prepare('INSERT OR IGNORE INTO favorites(session_id,place_id,created_at) VALUES(?,?,?)')
      .run(sessionId, placeId, now());
    return this.favorites(sessionId);
  }
  removeFavorite(sessionId: string, placeId: string) {
    this.assertSession(sessionId);
    this.getPlace(placeId);
    this.db
      .prepare('DELETE FROM favorites WHERE session_id=? AND place_id=?')
      .run(sessionId, placeId);
    return this.favorites(sessionId);
  }
  getJourney(sessionId: string): Journey {
    this.assertSession(sessionId);
    const row = this.db.prepare('SELECT data FROM journeys WHERE session_id=?').get(sessionId);
    return row ? (JSON.parse(String(row.data)) as Journey) : structuredClone(defaultJourney);
  }
  updateJourney(sessionId: string, patch: JourneyPatch): Journey {
    const journey = { ...this.getJourney(sessionId), ...patch };
    journey.longitude = normalizeLongitude(journey.longitude);
    for (const id of [...journey.explored, ...journey.compare]) this.getPlace(id);
    if (journey.selectedCity) {
      const selected = this.getPlace(journey.selectedCity);
      if (Math.abs(selected.latitude - journey.latitude) > journey.band) {
        if (patch.selectedCity) throw new ApiError(400, '选中的城市不在当前纬度带内');
        journey.selectedCity = null;
      }
    }
    this.db
      .prepare(
        'INSERT INTO journeys(session_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(session_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',
      )
      .run(sessionId, JSON.stringify(journey), now());
    return journey;
  }
  share(sessionId: string, name?: string) {
    const journey = this.getJourney(sessionId);
    const token = randomBytes(32).toString('base64url');
    const cityIds = this.getPlaces(journey.latitude, journey.band).map((place) => place.id);
    const allIds = [
      ...new Set([
        ...cityIds,
        ...journey.explored,
        ...journey.compare,
        ...this.favorites(sessionId),
      ]),
    ];
    const snapshot: Snapshot = {
      ...journey,
      name: name || '沿着一条纬线 · 我的旅程',
      cityIds,
      favorites: this.favorites(sessionId),
      places: allIds.map((id) => this.getPlace(id)),
      createdAt: now(),
    };
    this.db
      .prepare('INSERT INTO shared_journeys(token,session_id,snapshot,created_at) VALUES(?,?,?,?)')
      .run(token, sessionId, JSON.stringify(snapshot), snapshot.createdAt);
    return { token, snapshot };
  }
  getSnapshot(token: string): Snapshot {
    const row = this.db.prepare('SELECT snapshot FROM shared_journeys WHERE token=?').get(token);
    if (!row) throw new ApiError(404, '这条分享旅程不存在或已经失效');
    return JSON.parse(String(row.snapshot)) as Snapshot;
  }
  close() {
    this.db.close();
  }
}

const globalStore = globalThis as unknown as { parallelStore?: Store };
export function getStore(): Store {
  if (!globalStore.parallelStore)
    globalStore.parallelStore = new Store(
      resolve(/* turbopackIgnore: true */ process.env.DB_PATH || '.data/parallel.sqlite'),
    );
  return globalStore.parallelStore;
}
