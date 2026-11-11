import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { randomBytes, createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import {
  catalogSummaries,
  catalogVersion,
  curatedPlaces,
  catalogPlace,
  catalogReport,
} from '../../data/catalog';
import type { Place, PlaceSummary } from '../place-types';
import { summarizePlace } from '../place-types';
import { routes } from '../../data/routes';
import { ApiError } from './errors';
export { ApiError } from './errors';
import {
  journeyPatchSchema,
  portableJourneySchema,
  MAX_PORTABLE_IDS,
  normalizeLongitude,
  type JourneyPatch,
  type PortableJourney,
} from './validation';

export type Journey = {
  latitude: number;
  band: number;
  longitude: number;
  selectedCity: string | null;
  explored: string[];
  compare: string[];
};
export type Snapshot = Journey & {
  schemaVersion?: 2;
  name: string;
  cityIds: string[];
  favorites: string[];
  places: Place[];
  createdAt: string;
  totals?: { explored: number; favorites: number; places: number };
  truncated?: boolean;
};
export type PlaceQuery = {
  latitude?: number;
  band?: number;
  q?: string;
  level?: 'all' | 'curated';
  limit?: number;
  offset?: number;
  ids?: string[];
};
export type PlaceList = {
  places: PlaceSummary[];
  total: number;
  curatedTotal: number;
  hasMore: boolean;
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
const searchText = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const migrations = [
  `CREATE TABLE IF NOT EXISTS places (id TEXT PRIMARY KEY, latitude REAL NOT NULL, longitude REAL NOT NULL, data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS stories (place_id TEXT NOT NULL REFERENCES places(id), theme TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(place_id, theme));
   CREATE TABLE IF NOT EXISTS sources (place_id TEXT NOT NULL REFERENCES places(id), url TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(place_id, url));
   CREATE TABLE IF NOT EXISTS routes (id TEXT PRIMARY KEY, data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS anonymous_sessions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS favorites (session_id TEXT NOT NULL REFERENCES anonymous_sessions(id) ON DELETE CASCADE, place_id TEXT NOT NULL REFERENCES places(id), created_at TEXT NOT NULL, PRIMARY KEY(session_id,place_id));
   CREATE TABLE IF NOT EXISTS journeys (session_id TEXT PRIMARY KEY REFERENCES anonymous_sessions(id) ON DELETE CASCADE, data TEXT NOT NULL, updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS shared_journeys (token TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES anonymous_sessions(id) ON DELETE CASCADE, snapshot TEXT NOT NULL, created_at TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS places_latitude ON places(latitude);`,
  `ALTER TABLE places ADD COLUMN summary TEXT;
   ALTER TABLE places ADD COLUMN search_text TEXT NOT NULL DEFAULT '';
   ALTER TABLE places ADD COLUMN level TEXT NOT NULL DEFAULT 'curated';
   ALTER TABLE places ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
   ALTER TABLE shared_journeys ADD COLUMN revoked_at TEXT;
   CREATE TABLE explored_places (session_id TEXT NOT NULL REFERENCES anonymous_sessions(id) ON DELETE CASCADE, place_id TEXT NOT NULL REFERENCES places(id), visited_at TEXT NOT NULL, PRIMARY KEY(session_id,place_id));
   CREATE TABLE catalog_imports (version TEXT PRIMARY KEY, imported_at TEXT NOT NULL, total INTEGER NOT NULL);
   CREATE TABLE catalog_state (id INTEGER PRIMARY KEY CHECK(id=1), version TEXT NOT NULL, import_key TEXT NOT NULL, report TEXT NOT NULL);`,
];

export class Store {
  readonly db: DatabaseSync;
  constructor(public readonly filename: string) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    try {
      this.migrate();
      this.seed();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  private transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  migrate() {
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)',
    );
    for (let index = 0; index < migrations.length; index++) {
      const version = index + 1;
      if (this.db.prepare('SELECT version FROM schema_migrations WHERE version=?').get(version))
        continue;
      this.transaction(() => {
        this.db.exec(migrations[index]);
        if (version === 2) {
          const insert = this.db.prepare(
            'INSERT OR IGNORE INTO explored_places(session_id,place_id,visited_at) SELECT ?,id,? FROM places WHERE id=?',
          );
          const save = this.db.prepare('UPDATE journeys SET data=? WHERE session_id=?');
          for (const row of this.db
            .prepare('SELECT session_id,data,updated_at FROM journeys')
            .all()) {
            const old = JSON.parse(String(row.data)) as Journey;
            for (const id of old.explored ?? [])
              insert.run(String(row.session_id), String(row.updated_at), id);
            const { explored: _explored, ...position } = old;
            void _explored;
            save.run(JSON.stringify(position), String(row.session_id));
          }
          const update = this.db.prepare(
            'UPDATE places SET summary=?,search_text=?,level=? WHERE id=?',
          );
          for (const row of this.db.prepare('SELECT id,data FROM places').all()) {
            const place = JSON.parse(String(row.data)) as Place;
            const summary = summarizePlace(place);
            update.run(
              JSON.stringify(summary),
              this.searchable(summary),
              summary.level,
              String(row.id),
            );
          }
        }
        this.db
          .prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)')
          .run(version, now());
      });
    }
  }
  private searchable(place: PlaceSummary) {
    return searchText(
      [
        place.id,
        place.name,
        place.originalName,
        place.country,
        place.countryCode,
        place.admin,
        ...(place.aliases ?? []),
      ]
        .filter(Boolean)
        .join(' '),
    );
  }
  /** Versioned, transactional import. Removed records remain addressable by existing private state. */
  seed() {
    const importKey = `${catalogVersion}:${createHash('sha256').update(JSON.stringify(routes)).digest('hex')}`;
    if (
      this.db.prepare('SELECT import_key FROM catalog_state WHERE id=1').get()?.import_key ===
      importKey
    )
      return false;
    const imported = this.transaction(() => {
      // Another process may have completed the same import while this writer waited.
      if (
        this.db.prepare('SELECT import_key FROM catalog_state WHERE id=1').get()?.import_key ===
        importKey
      )
        return false;
      this.db.exec('UPDATE places SET active=0');
      const full = new Map(curatedPlaces.map((place) => [place.id, place]));
      const insert = this.db
        .prepare(`INSERT INTO places(id,latitude,longitude,data,summary,search_text,level,active) VALUES(?,?,?,?,?,?,?,1)
        ON CONFLICT(id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,data=excluded.data,summary=excluded.summary,search_text=excluded.search_text,level=excluded.level,active=1`);
      const insertStory = this.db.prepare('INSERT INTO stories(place_id,theme,data) VALUES(?,?,?)');
      const insertSource = this.db.prepare('INSERT INTO sources(place_id,url,data) VALUES(?,?,?)');
      const deleteStories = this.db.prepare('DELETE FROM stories WHERE place_id=?');
      const deleteSources = this.db.prepare('DELETE FROM sources WHERE place_id=?');
      for (const summary of catalogSummaries) {
        const detail = full.get(summary.id);
        insert.run(
          summary.id,
          summary.latitude,
          summary.longitude,
          detail ? JSON.stringify(detail) : '{}',
          JSON.stringify(summary),
          this.searchable(summary),
          summary.level,
        );
        deleteStories.run(summary.id);
        deleteSources.run(summary.id);
        for (const story of detail?.stories ?? [])
          insertStory.run(summary.id, story.theme, JSON.stringify(story));
        for (const source of detail?.sources ?? [])
          insertSource.run(summary.id, source.url, JSON.stringify(source));
      }
      const routeInsert = this.db.prepare(
        'INSERT INTO routes(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
      );
      for (const route of routes) routeInsert.run(route.id, JSON.stringify(route));
      this.db
        .prepare('INSERT OR IGNORE INTO catalog_imports(version,imported_at,total) VALUES(?,?,?)')
        .run(importKey, now(), catalogSummaries.length);
      this.db
        .prepare(
          'INSERT INTO catalog_state(id,version,import_key,report) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,import_key=excluded.import_key,report=excluded.report',
        )
        .run(catalogVersion, importKey, JSON.stringify(catalogReport));
      return true;
    });
    // Release the one-off bulk-import WAL after committing; normal private writes still use WAL.
    if (imported) this.db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
    return imported;
  }
  listPlaces(query: PlaceQuery = {}): PlaceList {
    if (query.ids) {
      const find = this.db.prepare('SELECT summary FROM places WHERE id=?');
      const places = query.ids
        .map((id) => find.get(id))
        .filter((row) => row?.summary)
        .map((row) => JSON.parse(String(row!.summary)) as PlaceSummary);
      return {
        places,
        total: places.length,
        curatedTotal: places.filter((p) => p.level === 'curated').length,
        hasMore: false,
      };
    }
    const clauses = ['active=1'];
    const values: SQLInputValue[] = [];
    if (query.latitude !== undefined) {
      clauses.push('latitude BETWEEN ? AND ?');
      values.push(query.latitude - (query.band ?? 2), query.latitude + (query.band ?? 2));
    }
    if (query.q) {
      clauses.push("search_text LIKE ? ESCAPE '\\'");
      values.push(`%${searchText(query.q).replace(/[\\%_]/g, '\\$&')}%`);
    }
    const filter = clauses.join(' AND ');
    const counts = this.db
      .prepare(
        `SELECT count(*) AS total,coalesce(sum(CASE WHEN level='curated' THEN 1 ELSE 0 END),0) AS curated FROM places WHERE ${filter}`,
      )
      .get(...values)!;
    if (query.level === 'curated') clauses.push("level='curated'");
    const order = query.q
      ? "CASE WHEN id=? THEN 0 WHEN json_extract(summary,'$.name')=? OR lower(json_extract(summary,'$.originalName'))=? THEN 1 ELSE 2 END,longitude,id"
      : 'longitude,id';
    const orderValues: SQLInputValue[] = query.q ? [query.q, query.q, query.q.toLowerCase()] : [];
    const limit = query.limit ?? 60;
    const offset = query.offset ?? 0;
    const places = this.db
      .prepare(
        `SELECT summary FROM places WHERE ${clauses.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`,
      )
      .all(...values, ...orderValues, limit, offset)
      .map((row) => JSON.parse(String(row.summary)) as PlaceSummary);
    const total = Number(query.level === 'curated' ? counts.curated : counts.total);
    return {
      places,
      total,
      curatedTotal: Number(counts.curated),
      hasMore: offset + places.length < total,
    };
  }
  getPlaces(latitude: number, band: number): PlaceSummary[] {
    return this.listPlaces({ latitude, band, limit: 50_000 }).places;
  }
  nearbyPlace(query: {
    latitude: number;
    band: number;
    longitude: number;
    level: 'all' | 'curated';
    direction: 'east' | 'west' | 'nearest';
    from?: string;
  }): PlaceSummary | null {
    const filter = `active=1 AND latitude BETWEEN ? AND ?${query.level === 'curated' ? " AND level='curated'" : ''}`;
    const bounds = [query.latitude - query.band, query.latitude + query.band];
    let row;
    if (query.direction === 'nearest') {
      row = this.db
        .prepare(
          `SELECT summary FROM places WHERE ${filter} ORDER BY min(abs(longitude-?),360-abs(longitude-?)),id LIMIT 1`,
        )
        .get(...bounds, query.longitude, query.longitude);
    } else {
      const anchor = query.from
        ? this.db
            .prepare(`SELECT id,longitude FROM places WHERE id=? AND ${filter}`)
            .get(query.from, ...bounds)
        : undefined;
      const longitude = anchor ? Number(anchor.longitude) : query.longitude;
      const id = anchor ? String(anchor.id) : query.direction === 'east' ? '' : '\uffff';
      const operator = query.direction === 'east' ? '>' : '<';
      const order = query.direction === 'east' ? 'ASC' : 'DESC';
      row = this.db
        .prepare(
          `SELECT summary FROM places WHERE ${filter} AND (longitude ${operator} ? OR (longitude=? AND id ${operator} ?)) ORDER BY longitude ${order},id ${order} LIMIT 1`,
        )
        .get(...bounds, longitude, longitude, id);
      row ??= this.db
        .prepare(
          `SELECT summary FROM places WHERE ${filter} ORDER BY longitude ${order},id ${order} LIMIT 1`,
        )
        .get(...bounds);
    }
    return row ? (JSON.parse(String(row.summary)) as PlaceSummary) : null;
  }
  getCatalog() {
    const entries = this.db.prepare('SELECT latitude,level FROM places WHERE active=1').all();
    const counts = Array<number>(181).fill(0);
    const curatedCounts = Array<number>(181).fill(0);
    for (const entry of entries) {
      const lower = Math.max(-90, Math.ceil(Number(entry.latitude) - 2));
      const upper = Math.min(90, Math.floor(Number(entry.latitude) + 2));
      for (let latitude = lower; latitude <= upper; latitude++) {
        counts[latitude + 90]++;
        if (entry.level === 'curated') curatedCounts[latitude + 90]++;
      }
    }
    return {
      ...catalogReport,
      total: entries.length,
      curatedTotal: entries.filter((entry) => entry.level === 'curated').length,
      version: String(
        this.db.prepare('SELECT version FROM catalog_state WHERE id=1').get()?.version ??
          catalogVersion,
      ),
      coverage: Array.from({ length: 181 }, (_, index) => {
        const latitude = index - 90;
        return { latitude, count: counts[index], curatedCount: curatedCounts[index] };
      }),
    };
  }
  getPlace(id: string): Place {
    const row = this.db.prepare('SELECT data,summary FROM places WHERE id=?').get(id);
    if (!row) throw new ApiError(404, '没有找到这座城市');
    const stored = JSON.parse(String(row.data)) as Place;
    if (Array.isArray(stored.stories)) return stored;
    const current = catalogPlace(id);
    if (current) return current;
    const summary = JSON.parse(String(row.summary)) as PlaceSummary;
    return {
      ...summary,
      tagline: '基础地理档案',
      intro: '这里保存了城市的基础地理资料，尚未编写专题故事。',
      stories: [],
      sources: [],
    };
  }
  private assertPlaces(ids: string[]) {
    const lookup = this.db.prepare('SELECT id FROM places WHERE id=?');
    for (const id of new Set(ids))
      if (!lookup.get(id)) throw new ApiError(404, `没有找到地点：${id}`);
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
      if (
        this.db
          .prepare('SELECT id FROM anonymous_sessions WHERE id=? AND expires_at>?')
          .get(id, now())
      )
        return { id };
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
    this.assertPlaces([placeId]);
    this.db
      .prepare('INSERT OR IGNORE INTO favorites(session_id,place_id,created_at) VALUES(?,?,?)')
      .run(sessionId, placeId, now());
    return this.favorites(sessionId);
  }
  removeFavorite(sessionId: string, placeId: string) {
    this.assertSession(sessionId);
    this.assertPlaces([placeId]);
    this.db
      .prepare('DELETE FROM favorites WHERE session_id=? AND place_id=?')
      .run(sessionId, placeId);
    return this.favorites(sessionId);
  }
  getJourney(sessionId: string): Journey {
    this.assertSession(sessionId);
    const row = this.db.prepare('SELECT data FROM journeys WHERE session_id=?').get(sessionId);
    const position = row
      ? (JSON.parse(String(row.data)) as Journey)
      : structuredClone(defaultJourney);
    const explored = this.db
      .prepare('SELECT place_id FROM explored_places WHERE session_id=? ORDER BY rowid')
      .all(sessionId)
      .map((entry) => String(entry.place_id));
    return { ...position, explored };
  }
  private position(current: Journey, patch: JourneyPatch): Omit<Journey, 'explored'> {
    const { visited: _visited, explored: _explored, ...changes } = patch;
    void _visited;
    void _explored;
    const { explored: _currentExplored, ...old } = current;
    void _currentExplored;
    const result = {
      ...old,
      ...changes,
      longitude: normalizeLongitude(changes.longitude ?? old.longitude),
    };
    if (result.selectedCity) {
      const selected = this.getPlace(result.selectedCity);
      if (Math.abs(selected.latitude - result.latitude) > result.band) {
        if (patch.selectedCity) throw new ApiError(400, '选中的城市不在当前纬度带内');
        result.selectedCity = null;
      }
    }
    return result;
  }
  private savePosition(sessionId: string, position: Omit<Journey, 'explored'>) {
    this.db
      .prepare(
        'INSERT INTO journeys(session_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(session_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',
      )
      .run(sessionId, JSON.stringify(position), now());
  }
  updateJourney(sessionId: string, input: JourneyPatch): Journey {
    const patch = journeyPatchSchema.parse(input);
    const current = this.getJourney(sessionId);
    const visited = [...(patch.explored ?? []), ...(patch.visited ? [patch.visited] : [])];
    this.assertPlaces([...visited, ...(patch.compare ?? [])]);
    if (new Set([...current.explored, ...visited]).size > MAX_PORTABLE_IDS)
      throw new ApiError(413, '探索记录已达到上限');
    const position = this.position(current, patch);
    this.transaction(() => {
      const insert = this.db.prepare(
        'INSERT OR IGNORE INTO explored_places(session_id,place_id,visited_at) VALUES(?,?,?)',
      );
      for (const id of visited) insert.run(sessionId, id, now());
      this.savePosition(sessionId, position);
    });
    return this.getJourney(sessionId);
  }
  exportJourney(sessionId: string): PortableJourney {
    const { explored, ...journey } = this.getJourney(sessionId);
    return { version: 2, journey, favorites: this.favorites(sessionId), explored };
  }
  importJourney(sessionId: string, input: PortableJourney): PortableJourney {
    const portable = portableJourneySchema.parse(input);
    const current = this.getJourney(sessionId);
    this.assertPlaces([
      ...portable.favorites,
      ...portable.explored,
      ...portable.journey.compare,
      ...(portable.journey.selectedCity ? [portable.journey.selectedCity] : []),
    ]);
    if (
      new Set([...current.explored, ...portable.explored]).size > MAX_PORTABLE_IDS ||
      new Set([...this.favorites(sessionId), ...portable.favorites]).size > MAX_PORTABLE_IDS
    )
      throw new ApiError(413, '合并后的记录超过上限');
    const position = this.position(current, portable.journey);
    this.transaction(() => {
      const favorite = this.db.prepare(
        'INSERT OR IGNORE INTO favorites(session_id,place_id,created_at) VALUES(?,?,?)',
      );
      const explored = this.db.prepare(
        'INSERT OR IGNORE INTO explored_places(session_id,place_id,visited_at) VALUES(?,?,?)',
      );
      for (const id of portable.favorites) favorite.run(sessionId, id, now());
      for (const id of portable.explored) explored.run(sessionId, id, now());
      this.savePosition(sessionId, position);
    });
    return this.exportJourney(sessionId);
  }
  share(sessionId: string, name?: string) {
    const journey = this.getJourney(sessionId);
    const favorites = this.favorites(sessionId);
    const requested = [
      ...new Set([
        ...(journey.selectedCity ? [journey.selectedCity] : []),
        ...journey.compare,
        ...favorites,
        ...journey.explored.toReversed(),
      ]),
    ];
    const cityIds = requested.slice(0, 60);
    const selected = new Set(cityIds);
    const snapshot: Snapshot = {
      ...journey,
      schemaVersion: 2,
      name: name || '沿着一条纬线 · 我的旅程',
      cityIds,
      favorites: favorites.filter((id) => selected.has(id)),
      explored: journey.explored.filter((id) => selected.has(id)),
      places: cityIds.map((id) => this.getPlace(id)),
      createdAt: now(),
      totals: {
        explored: journey.explored.length,
        favorites: favorites.length,
        places: requested.length,
      },
      truncated: requested.length > cityIds.length,
    };
    const token = randomBytes(32).toString('base64url');
    this.db
      .prepare('INSERT INTO shared_journeys(token,session_id,snapshot,created_at) VALUES(?,?,?,?)')
      .run(token, sessionId, JSON.stringify(snapshot), snapshot.createdAt);
    return { token, snapshot };
  }
  listShares(sessionId: string) {
    this.assertSession(sessionId);
    return this.db
      .prepare(
        "SELECT token,json_extract(snapshot,'$.name') AS name,created_at,revoked_at FROM shared_journeys WHERE session_id=? ORDER BY created_at DESC,token",
      )
      .all(sessionId)
      .map((row) => ({
        token: String(row.token),
        name: String(row.name),
        createdAt: String(row.created_at),
        ...(row.revoked_at ? { revokedAt: String(row.revoked_at) } : {}),
      }));
  }
  revokeShare(sessionId: string, token: string) {
    this.assertSession(sessionId);
    const row = this.db
      .prepare('SELECT revoked_at FROM shared_journeys WHERE token=? AND session_id=?')
      .get(token, sessionId);
    if (!row) throw new ApiError(404, '这条分享旅程不存在');
    const revokedAt = row.revoked_at ? String(row.revoked_at) : now();
    this.db
      .prepare('UPDATE shared_journeys SET revoked_at=? WHERE token=? AND session_id=?')
      .run(revokedAt, token, sessionId);
    return { token, revokedAt };
  }
  getSnapshot(token: string): Snapshot {
    const row = this.db
      .prepare('SELECT snapshot,revoked_at FROM shared_journeys WHERE token=?')
      .get(token);
    if (!row) throw new ApiError(404, '这条分享旅程不存在或已经失效');
    if (row.revoked_at) throw new ApiError(410, '原作者已撤销这条分享旅程');
    return JSON.parse(String(row.snapshot)) as Snapshot;
  }
  close() {
    this.db.close();
  }
}
const globalStore = globalThis as unknown as {
  parallelStore?: Store;
  parallelStoreRevision?: string;
};
export function getStore(): Store {
  // Stable across route bundles; constructor identity can differ even without HMR.
  const revision = `schema-2-runtime-2:${catalogVersion}`;
  const previous = globalStore.parallelStore;
  const staleDevelopmentStore =
    process.env.NODE_ENV === 'development' &&
    previous &&
    globalStore.parallelStoreRevision !== revision;
  if (!previous || staleDevelopmentStore) {
    globalStore.parallelStore = new Store(
      previous?.filename ??
        resolve(/* turbopackIgnore: true */ process.env.DB_PATH || '.data/parallel.sqlite'),
    );
    globalStore.parallelStoreRevision = revision;
    if (previous) {
      // In-flight development requests may still be reading their body against the old connection.
      const cleanup = setTimeout(() => {
        try {
          previous.close();
        } catch {
          /* Already closed by development shutdown. */
        }
      }, 30_000);
      cleanup.unref();
    }
  }
  return globalStore.parallelStore!;
}
