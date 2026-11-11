/**
 * Rebuild the offline GeoNames catalogue with Node.js >=24, without extra packages.
 *   node scripts/import-catalog.mjs                 # cached source; download if absent
 *   node scripts/import-catalog.mjs --offline       # never use the network
 *   node scripts/import-catalog.mjs --refresh       # explicitly accept a newer upstream dump
 * GeoNames data is CC BY 4.0, separate from this project's MIT code licence.
 */
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, stat, open } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createInflateRaw } from 'node:zlib';
import { createInterface } from 'node:readline';
import { downloadCatalogFile } from './import-catalog.download.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshotDate = '2026-11-11';
const cache = join(root, '.data', 'catalog-source', snapshotDate);
const output = join(root, 'src', 'data');
const offline = process.argv.includes('--offline');
const refresh = process.argv.includes('--refresh');
// Development-only intermediate output while the much larger language table is
// downloading. The report explicitly discloses incomplete Chinese enrichment.
const baseOnly = process.argv.includes('--base-only');
const origin = 'https://download.geonames.org/export/dump/';
const files = [
  'cities15000.zip',
  ...(baseOnly ? [] : ['alternateNamesV2.zip']),
  'countryInfo.txt',
  'admin1CodesASCII.txt',
  'readme.txt',
];
const previous = await readFile(join(output, 'catalog-report.json'), 'utf8')
  .then(JSON.parse)
  .catch(() => null);
await mkdir(cache, { recursive: true });

async function sourceFile(name) {
  const filename = join(cache, name);
  const exists = await stat(filename)
    .then((file) => file.size > 0)
    .catch(() => false);
  let lastModified =
    previous?.sources?.find((source) => source.file === name)?.lastModified ?? null;
  if (!exists || refresh) {
    if (offline) throw new Error(`Offline import needs ${filename}`);
    console.log(`Downloading ${name} from GeoNames...`);
    lastModified = (await downloadCatalogFile(`${origin}${name}`, filename)).lastModified;
  }
  const digest = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(filename)) {
    digest.update(chunk);
    bytes += chunk.length;
  }
  const sha256 = digest.digest('hex');
  const pinned = previous?.sources?.find((source) => source.file === name);
  if (!refresh && pinned && pinned.sha256 !== sha256) {
    throw new Error(
      `${name} differs from pinned SHA-256. Restore the cached snapshot or explicitly use --refresh.`,
    );
  }
  console.log(`${name}: ${bytes.toLocaleString('en-US')} bytes; SHA-256 ${sha256}`);
  return {
    file: name,
    url: `${origin}${name}`,
    bytes,
    sha256,
    lastModified,
    accessedAt: snapshotDate,
  };
}

// Read only the ZIP directory and stream the requested deflated entry. The large
// alternate-name table is never inflated into a single in-memory buffer.
async function zipEntryStream(filename, expectedName) {
  const handle = await open(filename, 'r');
  try {
    const size = (await handle.stat()).size;
    const tail = Buffer.alloc(Math.min(size, 65_557));
    await handle.read(tail, 0, tail.length, size - tail.length);
    let end = -1;
    for (let offset = tail.length - 22; offset >= 0; offset--) {
      if (tail.readUInt32LE(offset) === 0x06054b50) {
        end = offset;
        break;
      }
    }
    if (end < 0) throw new Error(`Invalid ZIP: ${filename}`);
    const directorySize = tail.readUInt32LE(end + 12);
    const directoryOffset = tail.readUInt32LE(end + 16);
    const directory = Buffer.alloc(directorySize);
    await handle.read(directory, 0, directorySize, directoryOffset);
    for (let offset = 0; offset < directory.length;) {
      if (directory.readUInt32LE(offset) !== 0x02014b50)
        throw new Error('Invalid ZIP central directory');
      const compression = directory.readUInt16LE(offset + 10);
      const compressedSize = directory.readUInt32LE(offset + 20);
      const nameLength = directory.readUInt16LE(offset + 28);
      const extraLength = directory.readUInt16LE(offset + 30);
      const commentLength = directory.readUInt16LE(offset + 32);
      const localOffset = directory.readUInt32LE(offset + 42);
      const name = directory.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
      if (name === expectedName) {
        const header = Buffer.alloc(30);
        await handle.read(header, 0, 30, localOffset);
        if (header.readUInt32LE(0) !== 0x04034b50) throw new Error('Invalid ZIP entry header');
        const start = localOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
        const input = createReadStream(filename, { start, end: start + compressedSize - 1 });
        if (compression === 0) return input;
        if (compression === 8) return input.pipe(createInflateRaw());
        throw new Error(`Unsupported ZIP compression ${compression}`);
      }
      offset += 46 + nameLength + extraLength + commentLength;
    }
    throw new Error(`Missing ${expectedName} in ${filename}`);
  } finally {
    await handle.close();
  }
}

const sources = [];
for (const file of files) sources.push(await sourceFile(file));
const countryCodes = new Set(
  (await readFile(join(cache, 'countryInfo.txt'), 'utf8'))
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('\t')[0]),
);
const admins = new Map(
  (await readFile(join(cache, 'admin1CodesASCII.txt'), 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const fields = line.split('\t');
      return [fields[0], fields[1]];
    }),
);
const places = new Map();
const timezoneValidity = new Map();
const rejected = {
  invalidCoordinate: 0,
  invalidId: 0,
  invalidTimezone: 0,
  missingTimezone: 0,
  missingName: 0,
  invalidCountry: 0,
};
const featureCodes = {};
let inputRecords = 0;
let actualElevationRecords = 0;
for await (const line of createInterface({
  input: await zipEntryStream(join(cache, 'cities15000.zip'), 'cities15000.txt'),
  crlfDelay: Infinity,
})) {
  if (!line) continue;
  inputRecords++;
  const f = line.split('\t');
  const id = Number(f[0]);
  const latitude = Number(f[4]);
  const longitude = Number(f[5]);
  if (!Number.isSafeInteger(id) || id <= 0) {
    rejected.invalidId++;
    continue;
  }
  if (!f[1]?.trim()) {
    rejected.missingName++;
    continue;
  }
  if (
    !f[4] ||
    !f[5] ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    rejected.invalidCoordinate++;
    continue;
  }
  const timezone = f[17];
  if (!timezone) {
    rejected.missingTimezone++;
    continue;
  }
  if (!timezoneValidity.has(timezone)) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone }).format(0);
      timezoneValidity.set(timezone, true);
    } catch {
      timezoneValidity.set(timezone, false);
    }
  }
  if (!timezoneValidity.get(timezone)) {
    rejected.invalidTimezone++;
    continue;
  }
  if (!countryCodes.has(f[8])) {
    rejected.invalidCountry++;
    continue;
  }
  const rawElevation = f[15] === '' ? null : Number(f[15]);
  const elevation = Number.isFinite(rawElevation) && rawElevation !== -9999 ? rawElevation : null;
  if (elevation !== null) actualElevationRecords++;
  featureCodes[f[7]] = (featureCodes[f[7]] ?? 0) + 1;
  places.set(id, {
    id,
    originalName: f[1],
    asciiName: f[2],
    aliases: f[3].split(',').filter(Boolean),
    latitude,
    longitude,
    countryCode: f[8],
    admin: admins.get(`${f[8]}.${f[10]}`) ?? '',
    elevation,
    timezone,
    modifiedAt: f[18],
    featureCode: f[7],
    chinese: [],
  });
}

console.log(
  `Validated ${places.size.toLocaleString('en-US')} populated places; reading language-tagged Chinese names...`,
);
let matchingChineseAliases = 0;
if (!baseOnly)
  for await (const line of createInterface({
    input: await zipEntryStream(join(cache, 'alternateNamesV2.zip'), 'alternateNamesV2.txt'),
    crlfDelay: Infinity,
  })) {
    const f = line.split('\t');
    const place = places.get(Number(f[1]));
    if (!place || !/^zh(?:$|[-_])/i.test(f[2])) continue;
    // Do not publish historical, colloquial, or explicitly ended names as current labels.
    if (f[6] === '1' || f[7] === '1' || f[9] || !f[3]?.trim()) continue;
    const language = f[2].toLowerCase();
    const priority =
      language === 'zh-hans'
        ? 40
        : language === 'zh-cn'
          ? 35
          : language === 'zh'
            ? 30
            : language === 'zh-sg'
              ? 25
              : 10;
    place.chinese.push({
      name: f[3].trim(),
      score: priority + (f[4] === '1' ? 2 : 0),
      id: Number(f[0]),
      language: f[2],
    });
    matchingChineseAliases++;
  }

// Stable v1 identities and Chinese spellings, explicitly matched against the registry.
// No nearest-neighbour matching alone: the fixed GeoNames ID remains the primary key.
const legacy = new Map([
  [1808926, ['hangzhou', '杭州']],
  [1815286, ['chengdu', '成都']],
  [1280737, ['lhasa', '拉萨']],
  [115019, ['shiraz', '设拉子']],
  [360630, ['cairo', '开罗']],
  [2542997, ['marrakesh', '马拉喀什']],
  [4335045, ['new-orleans', '新奥尔良']],
  [4699066, ['houston', '休斯敦']],
  [2037013, ['harbin', '哈尔滨']],
  [3164603, ['venice', '威尼斯']],
  [6077243, ['montreal', '蒙特利尔']],
  [5746545, ['portland', '波特兰']],
  [3451190, ['rio', '里约热内卢']],
  [3448439, ['sao-paulo', '圣保罗']],
  [3899539, ['antofagasta', '安托法加斯塔']],
  [2077895, ['alice-springs', '爱丽斯泉']],
]);
let chineseNamed = 0;
let fallbackNamed = 0;
const columns = [
  'id',
  'geonamesId',
  'name',
  'originalName',
  'countryCode',
  'latitude',
  'longitude',
  'timezone',
  'admin',
  'elevation',
  'aliases',
  'modifiedAt',
  'featureCode',
  'nameLanguage',
];
const records = [...places.values()]
  .sort((a, b) => a.id - b.id)
  .map((place) => {
    place.chinese.sort((a, b) => b.score - a.score || a.id - b.id);
    const stable = legacy.get(place.id);
    const selected = place.chinese[0];
    const name = stable?.[1] ?? selected?.name ?? place.originalName;
    if (stable || selected) chineseNamed++;
    else fallbackNamed++;
    const aliases = [
      ...new Set([
        place.originalName,
        place.asciiName,
        ...place.chinese.map((entry) => entry.name),
        ...place.aliases,
      ]),
    ]
      .filter((alias) => alias && alias !== name && alias.length <= 100)
      .slice(0, 32);
    return [
      stable?.[0] ?? `geonames-${place.id}`,
      place.id,
      name,
      place.originalName,
      place.countryCode,
      place.latitude,
      place.longitude,
      place.timezone,
      place.admin,
      place.elevation,
      aliases,
      place.modifiedAt,
      place.featureCode,
      stable ? 'zh-manual' : (selected?.language ?? 'local'),
    ];
  });
for (const id of legacy.keys())
  if (!places.has(id)) throw new Error(`Legacy GeoNames ID ${id} missing from source`);
if (records.length < 20_000) throw new Error(`Unexpectedly small catalogue: ${records.length}`);

const coverage = Array.from({ length: 181 }, (_, index) => {
  const latitude = index - 90;
  return {
    latitude,
    band: 2,
    places: records.filter((record) => Math.abs(record[5] - latitude) <= 2).length,
  };
});
const namesVersion =
  sources.find((source) => source.file === 'alternateNamesV2.zip')?.sha256.slice(0, 10) ??
  'names-pending';
const version = `geonames-cities15000-${snapshotDate}-${sources[0].sha256.slice(0, 10)}-${namesVersion}`;
const data = { schemaVersion: 1, version, accessedAt: snapshotDate, columns, records };
const serialized = `${JSON.stringify(data)}\n`;
const report = {
  schemaVersion: 1,
  version,
  generatedAt: snapshotDate,
  chineseEnrichmentComplete: !baseOnly,
  attribution:
    'Contains GeoNames geographical data, available under the Creative Commons Attribution 4.0 licence. https://www.geonames.org/ — labels filtered, fields reduced and legacy project identities preserved by Along a Parallel.',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  sourceDocumentation: `${origin}readme.txt`,
  sources,
  inputRecords,
  acceptedRecords: records.length,
  rejected,
  chineseNamed,
  originalNameFallback: fallbackNamed,
  matchingChineseAliases,
  actualElevationRecords,
  uniqueTimezones: [...timezoneValidity].filter((entry) => entry[1]).length,
  countryOrTerritoryCount: new Set(records.map((record) => record[4])).size,
  latitudeExtent: {
    min: Math.min(...records.map((record) => record[5])),
    max: Math.max(...records.map((record) => record[5])),
  },
  featureCodes,
  legacyMatches: [...legacy].map(([geonamesId, [id, name]]) => ({
    id,
    name,
    geonamesId,
    sourceName: places.get(geonamesId).originalName,
    latitude: places.get(geonamesId).latitude,
    longitude: places.get(geonamesId).longitude,
  })),
  coverage,
  nonEmptyLatitudeBands: coverage.filter((band) => band.places > 0).length,
  dataBytes: Buffer.byteLength(serialized),
  dataSha256: createHash('sha256').update(serialized).digest('hex'),
  notes: [
    'Coverage counts are for integer latitude centres from -90 through 90, each with a ±2° band, and describe this selected source catalogue, not all settlements on Earth.',
    'cities15000 is a selected populated-place dataset, not an exhaustive global list; oceans and polar areas can correctly have zero entries.',
    'Chinese display labels use language-tagged current aliases or the 16 documented v1 manual labels. Otherwise the source local name remains; no machine-translated place names are generated.',
    'Search aliases include registry transliterations and alternate spellings and are not all current preferred official names.',
    'Elevation uses only the explicit GeoNames elevation field in metres. The DEM grid field is deliberately not substituted for city elevation.',
    'Population is omitted because the extract does not provide an observation year per population figure.',
    'Runtime curated overlays preserve their published coordinates and identifiers and replace matching GeoNames rows; report.coverage describes the source rows before that overlay.',
  ],
};
await writeFile(join(output, 'catalog-data.json'), serialized, 'utf8');
await writeFile(
  join(output, 'catalog-report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(
  JSON.stringify(
    {
      version,
      places: records.length,
      chineseNamed,
      fallbackNamed,
      nonEmptyLatitudeBands: report.nonEmptyLatitudeBands,
      dataBytes: report.dataBytes,
    },
    null,
    2,
  ),
);
