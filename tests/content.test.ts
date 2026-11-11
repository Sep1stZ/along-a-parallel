import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { catalogSummaries, curatedPlaces, catalogReport } from '../src/data/catalog';
import { places as legacyPlaces } from '../src/data/places';
import { curatedV2 } from '../src/data/curated-v2';
import { observations } from '../src/data/observations';
import { routes } from '../src/data/routes';

test('the pinned catalog has valid coordinates, real IANA zones and preserves every legacy identity', () => {
  assert.equal(catalogReport.chineseEnrichmentComplete, true);
  assert.equal(catalogSummaries.length, catalogReport.acceptedRecords);
  const byId = new Map(catalogSummaries.map((p) => [p.id, p]));
  assert.equal(byId.size, catalogSummaries.length);
  const registryIds = catalogSummaries.map((p) => p.geonamesId).filter(Boolean);
  assert.equal(new Set(registryIds).size, registryIds.length);
  for (const place of catalogSummaries) {
    assert.ok(place.latitude >= -90 && place.latitude <= 90, place.id);
    assert.ok(place.longitude >= -180 && place.longitude <= 180, place.id);
    assert.ok(place.name.trim() && place.originalName.trim(), place.id);
  }
  for (const zone of new Set(catalogSummaries.map((p) => p.timezone)))
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: zone }));
  for (const original of legacyPlaces) {
    assert.equal(byId.get(original.id)?.latitude, original.latitude);
    assert.equal(byId.get(original.id)?.longitude, original.longitude);
  }
});

test('sixty curated cities have four keyed themes, referenced original art and scoped sources', () => {
  assert.equal(curatedPlaces.length, 60);
  assert.equal(curatedV2.length, 44);
  for (const place of curatedPlaces) {
    assert.deepEqual(place.stories.map((s) => s.theme).sort(), [
      'architecture',
      'food',
      'geography',
      'life',
    ]);
    assert.ok(place.sources.length >= 2, place.id);
    assert.ok(
      place.sources.some((s) => !s.publisher.includes('GeoNames')),
      place.id,
    );
    for (const source of place.sources) {
      assert.equal(new URL(source.url).protocol, 'https:');
      assert.ok(source.scope.trim() && source.accessedAt);
      assert.ok(source.status === 'verified' || source.status === 'pending');
    }
    const artwork = resolve('public', place.image.slice(1));
    assert.ok(existsSync(artwork), place.id);
    assert.match(readFileSync(artwork, 'utf8'), /<svg/);
  }
  for (const place of curatedV2)
    for (const story of place.stories)
      assert.ok(story.body.length >= 40 && story.body.length <= 150, `${place.id}: ${story.theme}`);
});

test('eight routes stay within real bands and thirty observations remain distinct natural locations', () => {
  assert.equal(routes.length, 8);
  const byId = new Map(curatedPlaces.map((p) => [p.id, p]));
  for (const route of routes) {
    let longitude = -181;
    for (const id of route.cityIds) {
      const place = byId.get(id);
      assert.ok(place, id);
      assert.ok(Math.abs(place.latitude - route.latitude) <= route.band, `${route.id}: ${id}`);
      assert.ok(place.longitude >= longitude, `${route.id}: longitude order`);
      longitude = place.longitude;
    }
  }
  assert.equal(observations.length, 30);
  assert.equal(new Set(observations.map((o) => o.id)).size, 30);
  for (const observation of observations) {
    assert.ok(Math.abs(observation.latitude) <= 90 && Math.abs(observation.longitude) <= 180);
    assert.ok(observation.body.trim() && observation.sources.length);
    assert.ok(!byId.has(observation.id));
  }
});

test('published assets match their manifest and every new illustration retains a separate original licence', () => {
  const manifest = JSON.parse(readFileSync('assets-manifest.json', 'utf8')) as {
    assets: { file: string; bytes: number; sha256: string; license: string }[];
  };
  for (const asset of manifest.assets) {
    const bytes = readFileSync(asset.file);
    assert.equal(bytes.length, asset.bytes, asset.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.file);
  }
  for (const place of curatedV2) {
    const asset = manifest.assets.find((entry) => entry.file === `public${place.image}`);
    assert.ok(asset?.license.startsWith('MIT'), place.id);
  }
  assert.ok(
    manifest.assets
      .find((entry) => entry.file === 'src/data/catalog-data.json')
      ?.license.includes('CC BY'),
  );
});
