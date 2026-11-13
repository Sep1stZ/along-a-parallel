/**
 * Download Chinese Wikipedia lead sections from the official Wikimedia API.
 * Node >=24 and Python 3 standard libraries; no packages. Not application runtime.
 *   node scripts/import-city-articles.mjs --download
 *   node scripts/import-city-articles.mjs --offline
 * Raw responses remain in ignored .data; reviewed excerpts are CC BY-SA 4.0.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const accessedAt = '2026-11-13';
const cache = join(root, '.data', 'city-articles', accessedAt);
await mkdir(cache, { recursive: true });
const data = JSON.parse(await readFile(join(root, 'src/data/catalog-data.json'), 'utf8'));
const normalize = (value) =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\s\p{P}]/gu, '');
const targets = (await readFile(join(root, 'scripts/city-article-targets.tsv'), 'utf8'))
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const [title, label, countryCode, explicitId] = line.split('|');
    let matches = data.records.filter(
      (row) =>
        row[4] === countryCode &&
        (explicitId ? row[1] === Number(explicitId) : normalize(row[3]) === normalize(label)),
    );
    if (!matches.length && !explicitId)
      matches = data.records.filter(
        (row) =>
          row[4] === countryCode &&
          [row[2], ...row[10]].some((name) => normalize(name) === normalize(label)),
      );
    if (matches.length !== 1)
      return {
        title,
        label,
        countryCode,
        problem: matches.map((r) => ({ id: r[1], name: r[3], admin: r[8], lat: r[5], lng: r[6] })),
      };
    return { title, label, countryCode, geonamesId: matches[0][1], name: matches[0][2] };
  });
const unmatched = targets.filter((target) => !target.geonamesId);
await writeFile(join(cache, 'unmatched.json'), JSON.stringify(unmatched, null, 2) + '\n');
console.log(
  `Targets: ${targets.length}; unambiguous registry matches: ${targets.length - unmatched.length}; unresolved: ${unmatched.length}`,
);
let cursor = 0;
const failures = [];
if (process.argv.includes('--download')) {
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor < targets.length) {
        const target = targets[cursor++];
        if (!target.geonamesId) continue;
        const file = join(cache, `${target.geonamesId}.json`);
        try {
          JSON.parse(await readFile(file, 'utf8'));
          continue;
        } catch {}
        const url = `https://api.wikimedia.org/core/v1/wikipedia/zh/page/${encodeURIComponent(target.title)}/with_html`;
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent':
                'Along-a-Parallel/2.1 source review (https://github.com/Sep1stZ/along-a-parallel)',
            },
            signal: AbortSignal.timeout(30000),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const raw = await response.text();
          const article = JSON.parse(raw);
          if (!article.html || !article.latest?.id || !article.license?.url?.includes('by-sa/4.0'))
            throw new Error('Missing body/revision/compatible license');
          await writeFile(file, raw);
          console.log(
            `Downloaded ${target.title} · ${target.geonamesId} · revision ${article.latest.id}`,
          );
        } catch (error) {
          failures.push({ ...target, url, error: String(error) });
          console.log(`Unavailable ${target.title}: ${error}`);
        }
      }
    }),
  );
}

const candidates = [];
for (const target of targets) {
  if (!target.geonamesId) continue;
  try {
    const raw = await readFile(join(cache, `${target.geonamesId}.json`), 'utf8');
    const article = JSON.parse(raw);
    if (!article.html || !article.latest?.id || !article.license?.url?.includes('by-sa/4.0'))
      throw new Error('Missing body/revision/compatible license');
    candidates.push({
      ...target,
      articleTitle: article.title,
      revision: String(article.latest.id),
      revisionAt: article.latest.timestamp,
      sourceUrl: `https://zh.wikipedia.org/w/index.php?title=${encodeURIComponent(article.key)}&oldid=${article.latest.id}`,
      license: 'CC BY-SA 4.0',
      licenseUrl: article.license.url,
      sourceSha256: createHash('sha256').update(raw).digest('hex'),
      accessedAt,
      paragraphs: [],
    });
  } catch (error) {
    failures.push({ ...target, error: String(error) });
  }
}
await writeFile(join(cache, 'candidates.json'), JSON.stringify(candidates, null, 2) + '\n');
const failureGroups = new Map();
for (const failure of failures) {
  const key = failure.geonamesId ?? failure.title;
  const group = failureGroups.get(key);
  if (group) group.errors.push(failure.error);
  else failureGroups.set(key, { ...failure, errors: [failure.error] });
}
await writeFile(
  join(cache, 'failures.json'),
  JSON.stringify([...failureGroups.values()], null, 2) + '\n',
);
// Quoted HTML attributes and nested information tables require a real tokenizer.
execFileSync(
  process.env.PYTHON ?? 'python',
  ['-X', 'utf8', join(root, 'scripts/extract-city-articles.py')],
  { cwd: root, stdio: 'inherit' },
);
const extracted = JSON.parse(await readFile(join(cache, 'candidates.json'), 'utf8'));
console.log(
  `Readable candidates: ${extracted.length}; review the actual paragraphs before publishing. ${targets.length - extracted.length} unavailable.`,
);
