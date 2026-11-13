/** Refresh local integrity metadata after adding reviewed original artwork or rebuilding fonts. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { curatedV2 } from '../src/data/curated-v2';

const manifest = JSON.parse(readFileSync('assets-manifest.json', 'utf8')) as {
  preparedAt: string;
  assets: Record<string, unknown>[];
};
const preparedAt = process.argv[2] || new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(preparedAt)) throw new Error('Use an ISO preparation date.');
for (const asset of [
  {
    file: 'src/data/city-articles.json',
    title: '中文城市速读 · 维基百科导言节选',
    author: 'Wikipedia contributors',
    sourceUrl: 'https://api.wikimedia.org/',
    license: 'CC BY-SA 4.0 (article text; separate from project MIT code)',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.zh',
    modifications:
      'Selected introductory passages, removed citations/pronunciation and stale numeric claims; converted to Simplified Chinese. Per-article revision links and scopes retained.',
    accessedAt: preparedAt,
    status: 'verified',
  },
  {
    file: 'src/data/catalog-regions.json',
    title: 'GeoNames 一级行政区可读标签',
    author: 'GeoNames contributors',
    sourceUrl: 'https://download.geonames.org/export/dump/',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    modifications:
      'Filtered administration names and Chinese language aliases from the pinned 2026-11-11 GeoNames snapshot; original names retained where Chinese labels are unavailable.',
    accessedAt: preparedAt,
    status: 'verified',
  },
]) {
  if (!manifest.assets.some((entry) => entry.file === asset.file)) manifest.assets.push(asset);
}
for (const place of curatedV2) {
  const file = `public${place.image}`;
  if (manifest.assets.some((asset) => asset.file === file)) continue;
  manifest.assets.push({
    file,
    title: `${place.name} · 原创主题示意插画`,
    author: 'Along a Parallel project contributors',
    sourceUrl: null,
    license: 'MIT (project LICENSE)',
    kind: 'original-schematic-illustration',
    attribution: '原创组合化示意插画，非实景照片、精确街景或地图。',
    width: 800,
    height: 520,
    accessedAt: '2026-11-11',
    status: 'verified',
  });
}
const fontInfo = JSON.parse(readFileSync('public/fonts/subset-info.json', 'utf8'));
for (const asset of manifest.assets) {
  const file = String(asset.file);
  if (!existsSync(file)) throw new Error(`Missing asset: ${file}`);
  const bytes = readFileSync(file);
  asset.bytes = bytes.length;
  asset.sha256 = createHash('sha256').update(bytes).digest('hex');
  if (file.endsWith('.woff2')) {
    asset.unicodeCount = fontInfo.unicodeCount;
    asset.modifications =
      'Subset to the complete local catalog, current UI and editorial text plus Latin/punctuation; variable weight axis 400–700; renamed Parallel Sans SC. Copyright and OFL retained. Rebuilt by scripts/build-font-subset.py.';
    asset.preparedAt = fontInfo.generatedAt;
  }
}
manifest.preparedAt = preparedAt;
writeFileSync('assets-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`Updated integrity metadata for ${manifest.assets.length} local assets.`);
