import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coordinate,
  exploreUrl,
  inBand,
  latitudeLabel,
  normalizeLongitude,
  parseExplore,
  shortestAngle,
  type ExploreState,
} from '../src/lib/geo';

const cityIds = ['hangzhou', 'chengdu', 'cairo', 'marrakesh'];
const approximately = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);

test('latitude bands include both boundaries and exclude cities beyond them', () => {
  assert.equal(inBand(28, 30, 2), true);
  assert.equal(inBand(32, 30, 2), true);
  assert.equal(inBand(27.9999, 30, 2), false);
  assert.equal(inBand(32.0001, 30, 2), false);
  assert.equal(inBand(-25, -23, 2), true);
  assert.equal(inBand(-20.999, -23, 2), false);
  assert.equal(inBand(30, 30, 0), true);
  assert.equal(inBand(30.01, 30, 0), false);
});

test('longitude normalization produces a canonical interval across the date line', () => {
  for (const [input, expected] of [
    [180, -180],
    [-180, -180],
    [181, -179],
    [-181, 179],
    [540, -180],
    [-540, -180],
    [720, 0],
    [-720, 0],
    [120.1551, 120.1551],
  ]) {
    approximately(normalizeLongitude(input), expected);
    assert.ok(normalizeLongitude(input) >= -180 && normalizeLongitude(input) < 180);
  }
});

test('rotating between cities crossing the date line uses the short continuous angle', () => {
  approximately(shortestAngle(179, -179), 181);
  approximately(shortestAngle(-179, 179), -181);
  approximately(shortestAngle(539, -179), 541);
  approximately(shortestAngle(-539, 179), -541);
  for (const from of [-720, -179, 0, 179, 720]) {
    for (const to of [-179, -90, 0, 90, 179]) {
      assert.ok(Math.abs(shortestAngle(from, to) - from) <= 180);
      approximately(normalizeLongitude(shortestAngle(from, to)), normalizeLongitude(to));
    }
  }
});

test('exploration links round-trip route, city and comparison state', () => {
  const state: ExploreState = {
    latitude: 30,
    band: 2,
    longitude: 120.1551,
    selectedCity: 'hangzhou',
    compare: ['cairo', 'chengdu'],
  };
  const url = exploreUrl(state);
  assert.ok(url.startsWith('/?'));
  const result = parseExplore(url.slice(1), cityIds)!;
  assert.equal(result.latitude, state.latitude);
  assert.equal(result.band, state.band);
  approximately(result.longitude, state.longitude);
  assert.equal(result.selectedCity, state.selectedCity);
  assert.deepEqual(result.compare, state.compare);
  assert.equal(parseExplore('', cityIds), null);
});

test('URLs accept legal extrema, normalize longitudes on export and support empty bands', () => {
  const state: ExploreState = {
    latitude: -90,
    band: 0.1,
    longitude: 541,
    selectedCity: null,
    compare: [],
  };
  const result = parseExplore(exploreUrl(state).slice(1), cityIds)!;
  assert.equal(result.latitude, -90);
  assert.equal(result.band, 0.1);
  approximately(result.longitude, -179);
  assert.equal(result.selectedCity, null);
  assert.deepEqual(result.compare, []);
  assert.equal(parseExplore('?lat=90&band=10&lng=180', cityIds)?.latitude, 90);
});

test('invalid coordinates, unknown cities and oversized comparisons cannot restore state', () => {
  for (const search of [
    '?lat=NaN',
    '?lat=Infinity',
    '?lat=91',
    '?lat=-91',
    '?lat=',
    '?band=0',
    '?band=-1',
    '?band=11',
    '?lng=181',
    '?lng=-181',
    '?city=missing',
    '?compare=cairo,missing',
    '?compare=cairo,chengdu,hangzhou',
  ]) {
    assert.equal(parseExplore(search, cityIds), null, search);
  }
});

test('repeated comparison IDs do not become a third city', () => {
  assert.deepEqual(parseExplore('?compare=cairo,cairo,chengdu', cityIds)?.compare, [
    'cairo',
    'chengdu',
  ]);
});

test('coordinate and route labels explicitly express hemispheres', () => {
  assert.equal(latitudeLabel(30), '北纬 30°');
  assert.equal(latitudeLabel(-23), '南纬 23°');
  assert.equal(coordinate(-23.55), '23.55° S');
  assert.equal(coordinate(-95.3698, false), '95.37° W');
});
