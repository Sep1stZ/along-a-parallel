/** Refresh local integrity metadata after adding reviewed original artwork or rebuilding fonts. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { curatedV2 } from '../src/data/curated-v2';

const manifest = JSON.parse(readFileSync('assets-manifest.json', 'utf8')) as {
  preparedAt: string;
  assets: Record<string, unknown>[];
};
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
manifest.preparedAt = '2026-11-11';
writeFileSync('assets-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`Updated integrity metadata for ${manifest.assets.length} local assets.`);
