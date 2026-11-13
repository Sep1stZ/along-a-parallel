import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlaceIndex } from '../src/lib/place-profile';
import type { PlaceSummary } from '../src/lib/place-types';
import { catalogPlace, catalogReport, catalogSummaries } from '../src/data/catalog';

function fixture(id: string, latitude: number, longitude: number): PlaceSummary {
  return {
    id,
    latitude,
    longitude,
    name: id,
    originalName: id,
    country: 'test',
    timezone: 'Etc/UTC',
    image: '',
    accent: '',
    level: 'catalog',
    kind: 'settlement',
    hasStory: false,
  };
}
function chord(a: PlaceSummary, b: PlaceSummary) {
  const xyz = (p: PlaceSummary) => {
    const latitude = (p.latitude * Math.PI) / 180;
    const longitude = (p.longitude * Math.PI) / 180;
    return [
      Math.cos(latitude) * Math.cos(longitude),
      Math.cos(latitude) * Math.sin(longitude),
      Math.sin(latitude),
    ];
  };
  const x = xyz(a);
  const y = xyz(b);
  return x.reduce((sum, value, index) => sum + (value - y[index]) ** 2, 0);
}

test('spherical neighbours match brute force across the date line, poles and deterministic global positions', () => {
  const points = [
    fixture('west', 0, -179.95),
    fixture('east', 0, 179.96),
    fixture('north-west', 89.99, -170),
    fixture('north-east', 89.99, 30),
    fixture('south', -89.99, 179),
    ...Array.from({ length: 450 }, (_, index) =>
      fixture(`p-${index}`, -85 + ((index * 61.173) % 170), -180 + ((index * 137.508) % 360)),
    ),
  ];
  const nearest = createPlaceIndex(points);
  for (const origin of points.filter((_, index) => index < 5 || index % 13 === 0)) {
    const expected = points
      .filter((place) => place.id !== origin.id)
      .sort((a, b) => chord(a, origin) - chord(b, origin))
      .slice(0, 3)
      .map((place) => place.id);
    assert.deepEqual(
      nearest(origin).map((place) => place.id),
      expected,
      origin.id,
    );
  }
  assert.equal(nearest(points[0], 1)[0].id, 'east');
  assert.ok(nearest(points[0], 1)[0].distanceKm < 11);
  assert.deepEqual(nearest(points[0], 0), []);
  assert.deepEqual(createPlaceIndex([])(points[0]), []);
});

test('all catalogue details have useful geography without manufacturing cultural stories', () => {
  const byId = new Map(catalogSummaries.map((place) => [place.id, place]));
  for (const summary of catalogSummaries) {
    const place = catalogPlace(summary.id);
    assert.ok(place?.profile, summary.id);
    assert.match(
      place.profile.timezoneText,
      new RegExp(summary.timezone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
    assert.ok(place.profile.regionText.includes(summary.country));
    assert.ok(place.profile.latitudeText.includes('纬度相近不代表气候'));
    assert.equal(place.profile.nearby.length, 3);
    assert.equal(place.profile.related.length, 3);
    if (!summary.hasStory) assert.deepEqual(place.stories, []);
    for (const related of [...place.profile.nearby, ...place.profile.related]) {
      assert.notEqual(related.id, place.id);
      assert.equal(related.latitude, byId.get(related.id)?.latitude);
      assert.equal(related.longitude, byId.get(related.id)?.longitude);
      assert.ok(Number.isFinite(related.distanceKm) && related.distanceKm >= 0);
    }
    assert.ok(place.profile.related.every((related) => byId.get(related.id)?.hasStory));
  }
  assert.equal(catalogReport.profileTotal, catalogSummaries.length);
  assert.match(catalogPlace('geonames-1816670')!.profile!.regionText, /北京市/);
});

test('published city reading has separately licensed reviewed text, pinned revisions and traceable source hashes', () => {
  const published = JSON.parse(readFileSync('src/data/city-articles.json', 'utf8')) as {
    articles: {
      geonamesId: number;
      sourceSha256: string;
      article: {
        paragraphs: string[];
        source: {
          url: string;
          revision: string;
          license: string;
          licenseUrl: string;
          scope: string;
        };
      };
    }[];
  };
  assert.ok(published.articles.length >= 120, `Only ${published.articles.length} articles`);
  assert.equal(
    new Set(published.articles.map((entry) => entry.geonamesId)).size,
    published.articles.length,
  );
  assert.equal(catalogReport.articleTotal, published.articles.length);
  assert.ok(catalogReport.articleHighlights.length >= 10);
  const ids = new Map(catalogSummaries.map((place) => [place.geonamesId, place.id]));
  for (const entry of published.articles) {
    const place = catalogPlace(ids.get(entry.geonamesId)!);
    assert.ok(place?.article, String(entry.geonamesId));
    assert.equal(entry.article.source.license, 'CC BY-SA 4.0');
    assert.match(
      entry.article.source.licenseUrl,
      /^https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0/,
    );
    assert.match(
      entry.article.source.revision,
      /^https:\/\/zh\.wikipedia\.org\/w\/index\.php\?title=.+&oldid=\d+$/,
    );
    assert.equal(entry.article.source.url, entry.article.source.revision);
    assert.ok(entry.article.source.scope.length >= 20);
    assert.ok(entry.article.paragraphs.length >= 2);
    const text = entry.article.paragraphs.join('');
    assert.ok(text.length >= 90 && text.length <= 1000, `${entry.geonamesId}: ${text.length}`);
    assert.doesNotMatch(
      text,
      /<\/?(?:span|sup|div|style)|mw-parser|data-mw|font-family|\[\[|\{\{cite/,
    );
    assert.match(entry.sourceSha256, /^[a-f0-9]{64}$/);
  }
});
