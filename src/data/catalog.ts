// Server-side data module. The Node boundary intentionally prevents accidentally
// bundling the complete worldwide catalogue into a Client Component.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import report from './catalog-report.json';
import { places as originalPlaces } from './places';
import { curatedV2 } from './curated-v2';
import { summarizePlace, type Place, type PlaceSummary } from '../lib/place-types';

type CatalogRow = [
  id: string,
  geonamesId: number,
  name: string,
  originalName: string,
  countryCode: string,
  latitude: number,
  longitude: number,
  timezone: string,
  admin: string,
  elevation: number | null,
  aliases: string[],
  modifiedAt: string,
  featureCode: string,
  nameLanguage: string,
];
type CatalogData = { version: string; accessedAt: string; records: CatalogRow[] };
const editorialPlaces: Place[] = [...originalPlaces, ...curatedV2];
const detailSchemaVersion = 3;
const curatedDigest = createHash('sha256')
  .update(JSON.stringify(editorialPlaces))
  .digest('hex')
  .slice(0, 12);
export const catalogVersion = `${report.version}-detail-${detailSchemaVersion}-curated-${editorialPlaces.length}-${curatedDigest}`;

function buildCatalog() {
  const data = JSON.parse(
    readFileSync(join(process.cwd(), 'src', 'data', 'catalog-data.json'), 'utf8'),
  ) as CatalogData;
  if (data.version !== report.version) throw new Error('Catalogue data/report version mismatch');
  const rows = data.records;
  const regionNames = new Intl.DisplayNames(['zh-Hans'], { type: 'region' });
  const sourceByGeonamesId = new Map(rows.map((row) => [row[1], row]));
  const legacyGeonamesIds = new Map(
    report.legacyMatches.map((place) => [place.id, place.geonamesId]),
  );
  const normalName = (name: string) =>
    name
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[\s\p{P}]/gu, '');

  function matchingSource(place: Place): CatalogRow | undefined {
    const explicitId = place.geonamesId ?? legacyGeonamesIds.get(place.id);
    if (explicitId) return sourceByGeonamesId.get(explicitId);
    const names = new Set([place.name, place.originalName].map(normalName));
    // Coordinates alone cannot establish identity: require a matching registry name
    // as well, and keep unmatched small settlements as independent curated records.
    return rows.find((row) => {
      const dLat = row[5] - place.latitude;
      const dLng = ((((row[6] - place.longitude + 180) % 360) + 360) % 360) - 180;
      const distanceDegrees = Math.hypot(dLat, dLng * Math.cos((place.latitude * Math.PI) / 180));
      return (
        distanceDegrees <= 0.2 &&
        [row[2], row[3], ...row[10]].some((name) => names.has(normalName(name)))
      );
    });
  }

  const curatedPlaces: Place[] = editorialPlaces.map((place) => {
    const row = matchingSource(place);
    return {
      ...place,
      level: 'curated',
      kind: place.kind ?? 'city',
      geonamesId: place.geonamesId ?? row?.[1],
      countryCode: place.countryCode ?? row?.[4],
      admin: place.admin ?? row?.[8],
      elevation: place.elevation ?? row?.[9],
      aliases: [...new Set([...(place.aliases ?? []), ...(row?.[10] ?? [])])],
    };
  });

  const curatedIds = new Set(curatedPlaces.map((place) => place.id));
  if (curatedIds.size !== curatedPlaces.length) throw new Error('Duplicate curated place ID');
  const curatedRegistryIds = new Set(
    curatedPlaces.map((place) => place.geonamesId).filter(Boolean),
  );

  function summarizeRow(row: CatalogRow): PlaceSummary {
    return {
      id: row[0],
      geonamesId: row[1],
      name: row[2],
      originalName: row[3],
      countryCode: row[4],
      country: regionNames.of(row[4]) ?? row[4],
      latitude: row[5],
      longitude: row[6],
      timezone: row[7],
      admin: row[8],
      elevation: row[9],
      aliases: row[10],
      image: '/art/catalog.svg',
      accent: '#7b9185',
      level: 'catalog',
      kind: 'settlement',
      hasStory: false,
    };
  }

  const catalogSummaries: PlaceSummary[] = [
    ...rows
      .filter((row) => !curatedRegistryIds.has(row[1]) && !curatedIds.has(row[0]))
      .map(summarizeRow),
    ...curatedPlaces.map(summarizePlace),
  ];
  const summariesById = new Map(catalogSummaries.map((place) => [place.id, place]));
  const curatedById = new Map(curatedPlaces.map((place) => [place.id, place]));
  const metadataById = new Map(rows.map((row) => [row[0], [row[11], row[13]]]));
  // The prepared summaries retain every needed public field. Release raw source
  // row arrays and their temporary index before database seeding starts.
  sourceByGeonamesId.clear();
  rows.length = 0;

  /** Materialise a single basic place, without manufacturing cultural stories. */
  function catalogPlace(id: string): Place | undefined {
    const curated = curatedById.get(id);
    if (curated) return curated;
    const summary = summariesById.get(id);
    const metadata = metadataById.get(id);
    if (!summary || !metadata) return undefined;
    const latitude = `${Math.abs(summary.latitude).toFixed(4)}°${summary.latitude < 0 ? 'S' : 'N'}`;
    const longitude = `${Math.abs(summary.longitude).toFixed(4)}°${summary.longitude < 0 ? 'W' : 'E'}`;
    return {
      ...summary,
      tagline: '从一个真实坐标，认识世界的一处聚落。',
      intro: `${summary.name}是 GeoNames 收录的聚落点位，位于${summary.country}${summary.admin ? `的 ${summary.admin}` : ''}。近似中心坐标为 ${latitude}、${longitude}，时区为 ${summary.timezone}。本条提供基础地理资料，人文故事尚待策展。`,
      stories: [],
      sources: [
        {
          title: `${summary.originalName} · GeoNames ${summary.geonamesId}`,
          publisher: 'GeoNames contributors',
          url: 'https://download.geonames.org/export/dump/cities15000.zip',
          accessedAt: data.accessedAt,
          status: 'verified',
          scope: `已读取 GeoNames cities15000 离线记录：名称、WGS84 坐标、行政区代码和 IANA 时区${summary.elevation !== null && summary.elevation !== undefined ? '、点位海拔（米；非城区平均高度）' : ''}。上游记录修改日期 ${metadata[0]}。中文标签来源：${metadata[1]}。CC BY 4.0；本项目进行了字段筛选与名称选择。此核验仅针对下载的数据记录，未声称实地调查或逐一打开城市网页。`,
        },
      ],
    };
  }

  const coverage = Array.from({ length: 181 }, (_, index) => {
    const latitude = index - 90;
    const places = catalogSummaries.filter((place) => Math.abs(place.latitude - latitude) <= 2);
    return {
      latitude,
      band: 2,
      places: places.length,
      curated: places.filter((place) => place.hasStory).length,
    };
  });
  const catalogReport = {
    ...report,
    version: catalogVersion,
    sourceCoverage: report.coverage,
    coverage,
    totalPlaces: catalogSummaries.length,
    catalogPlaces: catalogSummaries.length - curatedPlaces.length,
    curatedPlaces: curatedPlaces.length,
    chineseNamed: catalogSummaries.filter((place) => /\p{Script=Han}/u.test(place.name)).length,
    nonEmptyLatitudeBands: coverage.filter((band) => band.places > 0).length,
    unmatchedCurated: curatedPlaces.filter((place) => !place.geonamesId).map((place) => place.id),
  };
  return { version: catalogVersion, curatedPlaces, catalogSummaries, catalogReport, catalogPlace };
}

// Next independently bundles API and RSC routes. Keep only one current-version
// prepared view in each process so these bundles do not duplicate 34k records.
// Hash the editorial content, not just its count, to refresh same-size revisions.
type CachedCatalog = ReturnType<typeof buildCatalog>;
const cacheKey = Symbol.for('along-a-parallel.catalog.current');
const processCache = globalThis as unknown as { [key: symbol]: CachedCatalog | undefined };
let current = processCache[cacheKey];
if (!current || current.version !== catalogVersion) {
  current = buildCatalog();
  processCache[cacheKey] = current;
}
const activeCatalog = current;
export const curatedPlaces = activeCatalog.curatedPlaces;
export const catalogSummaries = activeCatalog.catalogSummaries;
export const catalogReport = activeCatalog.catalogReport;
export function catalogPlace(id: string): Place | undefined {
  return activeCatalog.catalogPlace(id);
}
