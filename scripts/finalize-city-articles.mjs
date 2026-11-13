/** Publish only the revision-pinned, human-reviewed reading whitelist. No network. */
import { readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, '.data', 'city-articles', '2026-11-13');
const data = JSON.parse(await readFile(join(root, 'src/data/catalog-data.json'), 'utf8'));
const places = new Map(data.records.map((row) => [row[1], row]));
const reviewPaths = [
  'scripts/city-article-reviews-china.json',
  'src/data/city-articles-international.review.json',
  'src/data/city-articles-china-additional.review.json',
];
const reviewed = [];
for (const path of reviewPaths) {
  const rows = JSON.parse(await readFile(join(root, path), 'utf8'));
  if (!Array.isArray(rows)) throw new Error(`Review must be an array: ${path}`);
  for (const row of rows) reviewed.push({ ...row, reviewFile: path });
}
const ids = new Set();
const articles = [];
let verifiedCachedSources = 0;
for (const review of reviewed) {
  const id = review.geonamesId;
  if (ids.has(id)) throw new Error(`Duplicate reviewed GeoNames ID ${id}`);
  ids.add(id);
  const place = places.get(id);
  if (!place) throw new Error(`Reviewed city is absent from the pinned catalogue: ${id}`);
  let article = review.article;
  if (!article) {
    const revision = new URL(review.reviewedRevision);
    article = {
      title: `${place[2]} · 城市速读`,
      paragraphs: review.paragraphs,
      source: {
        title: revision.searchParams.get('title'),
        url: review.reviewedRevision,
        publisher: '中文维基百科贡献者',
        accessedAt: '2026-11-13',
        license: 'CC BY-SA 4.0',
        licenseUrl: review.licenseUrl,
        revision: review.reviewedRevision,
        scope: `${review.scope}依据原条目作中文摘编与文字整理；百科引文未逐项独立核验。`,
      },
    };
  }
  const revision = new URL(article.source.revision);
  if (
    revision.protocol !== 'https:' ||
    revision.hostname !== 'zh.wikipedia.org' ||
    revision.pathname !== '/w/index.php' ||
    !/^\d+$/.test(revision.searchParams.get('oldid') ?? '') ||
    !revision.searchParams.get('title')
  )
    throw new Error(`A full pinned source revision is required: ${id}`);
  if (
    article.source.url !== article.source.revision ||
    article.source.license !== 'CC BY-SA 4.0' ||
    !article.source.licenseUrl?.startsWith('https://creativecommons.org/licenses/by-sa/4.0')
  )
    throw new Error(`Attribution or separate content licence is incomplete: ${id}`);
  if (!/^[a-f0-9]{64}$/.test(review.sourceSha256 ?? ''))
    throw new Error(`Actual reviewed source digest missing: ${id}`);
  if (
    !Array.isArray(article.paragraphs) ||
    article.paragraphs.length < 2 ||
    article.paragraphs.some(
      (paragraph) => typeof paragraph !== 'string' || paragraph.length < 25,
    ) ||
    article.paragraphs.join('').length > 1000
  )
    throw new Error(`Review needs two readable, limited prose paragraphs: ${id}`);
  if (
    !article.source.scope ||
    /<\/?(?:span|sup|div|style)|mw-parser|data-mw|font-family|\[\[|\{\{cite/.test(
      article.paragraphs.join(''),
    )
  )
    throw new Error(`Unreviewed or malformed body: ${id}`);
  const cachedFile = join(cache, `${id}.json`);
  const exists = await access(cachedFile)
    .then(() => true)
    .catch(() => false);
  if (exists) {
    const raw = await readFile(cachedFile);
    const source = JSON.parse(raw.toString('utf8'));
    if (
      createHash('sha256').update(raw).digest('hex') !== review.sourceSha256 ||
      String(source.latest?.id) !== revision.searchParams.get('oldid') ||
      source.title !== article.source.title
    )
      throw new Error(
        `Source changed after review; review again explicitly before publishing: ${id}`,
      );
    verifiedCachedSources++;
  }
  articles.push({
    geonamesId: id,
    sourceSha256: review.sourceSha256,
    reviewFile: review.reviewFile,
    article,
  });
}
articles.sort((a, b) => a.geonamesId - b.geonamesId);
const digest = createHash('sha256').update(JSON.stringify(articles)).digest('hex');
const result = {
  version: `wikipedia-zh-reviewed-leads-2026-11-13-${digest.slice(0, 12)}`,
  accessedAt: '2026-11-13',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  attribution:
    '中文维基百科贡献者；每篇提供原始条目修订与许可链接。城市速读含节选、删节、中文改编与文字整理，独立于项目 MIT 代码许可，改编内容继续按 CC BY-SA 4.0 提供。',
  reviewPolicy:
    'Only explicit reviewed entries with fixed oldid and source SHA-256 may be published. New downloads never enter this whitelist automatically.',
  articles,
};
await writeFile(join(root, 'src/data/city-articles.json'), JSON.stringify(result, null, 2) + '\n');
console.log(
  `Published ${articles.length} reviewed city readings from ${new Set(articles.map((entry) => places.get(entry.geonamesId)[4])).size} country/region codes; checked ${verifiedCachedSources} cached source digests. Content digest ${digest}`,
);
