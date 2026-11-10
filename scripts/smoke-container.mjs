import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

// This script creates and removes only its own randomly named test container
// and volume. It never touches the project's .data directory or a registry.
const image = process.env.CONTAINER_IMAGE || 'along-a-parallel:ci';
const port = Number(process.env.TEST_PORT || 3001);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535, 'Invalid TEST_PORT');
const resourcePrefix = `parallel-smoke-${process.pid}-${randomBytes(5).toString('hex')}`;
const containerName = `${resourcePrefix}-app`;
const volumeName = `${resourcePrefix}-data`;
const baseUrl = `http://127.0.0.1:${port}`;
// Simulate a platform's HTTPS terminator reaching the app over internal HTTP.
const canonicalOrigin = 'https://atlas.example.test';
let containerCreated = false;
let volumeCreated = false;

function docker(args) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    timeout: 60_000,
  }).trim();
}

async function waitUntilReady() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/routes`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return;
    } catch {
      // The process may still be binding its port or initializing SQLite.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Container did not become ready within 90 seconds');
}

function startContainer() {
  docker([
    'run',
    '--detach',
    '--name',
    containerName,
    '--publish',
    `127.0.0.1:${port}:3000`,
    '--mount',
    `type=volume,source=${volumeName},target=/app/.data`,
    '--env',
    `APP_ORIGIN=${canonicalOrigin}`,
    image,
  ]);
  containerCreated = true;
}

async function request(path, { cookie, method = 'GET', body, origin = canonicalOrigin } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (method !== 'GET') headers.origin = origin;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json();
  return { response, result };
}

async function establishSession() {
  const { response, result } = await request('/api/journey');
  assert.equal(response.status, 200);
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie?.includes('HttpOnly'), 'Anonymous token must be HttpOnly');
  assert.match(setCookie, /(?:;\s*)Secure(?:;|$)/i, 'HTTPS public origin must use Secure cookies');
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(response.headers.get('cache-control') || '', /private.*no-store/);
  return { cookie: setCookie.split(';')[0], journey: result.journey };
}

try {
  docker(['volume', 'create', volumeName]);
  volumeCreated = true;
  startContainer();
  await waitUntilReady();
  assert.match(docker(['exec', containerName, 'node', '--version']), /^v24\./);
  assert.equal(docker(['exec', containerName, 'id', '-u']), '1000', 'Image must run as node user');
  const home = await fetch(baseUrl, { signal: AbortSignal.timeout(10_000) });
  assert.equal(home.status, 200);
  assert.match(await home.text(), /沿着一条纬线/);
  const map = await fetch(`${baseUrl}/maps/world.json`);
  assert.equal(map.status, 200);
  assert.equal((await map.json()).type, 'FeatureCollection');
  const routes = await request('/api/routes');
  assert.equal(routes.result.routes.length, 3);
  for (const [latitude, expected] of [
    [30, 8],
    [45, 4],
    [-23, 4],
  ]) {
    const { result } = await request(`/api/places?latitude=${latitude}&band=2`);
    assert.equal(result.places.length, expected);
  }

  const owner = await establishSession();
  for (let i = 0; i < 2; i++) {
    const favorite = await request('/api/favorites', {
      cookie: owner.cookie,
      method: 'POST',
      body: { placeId: 'hangzhou' },
    });
    assert.equal(favorite.response.status, 200);
    assert.deepEqual(favorite.result.favorites, ['hangzhou']);
  }
  const saved = await request('/api/journey', {
    cookie: owner.cookie,
    method: 'PATCH',
    body: {
      latitude: 30,
      band: 2,
      longitude: 31.2357,
      selectedCity: 'cairo',
      explored: ['hangzhou', 'cairo'],
      compare: ['hangzhou', 'cairo'],
    },
  });
  assert.equal(saved.response.status, 200);
  const shared = await request('/api/journey/share', {
    cookie: owner.cookie,
    method: 'POST',
    body: { name: 'Container persistence test' },
  });
  assert.equal(shared.response.status, 201);
  assert.match(shared.result.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(shared.result.url, `${canonicalOrigin}/shared/${shared.result.token}`);
  const snapshot = shared.result.snapshot;
  assert.equal(snapshot.selectedCity, 'cairo');
  assert.deepEqual(snapshot.favorites, ['hangzhou']);

  const other = await establishSession();
  assert.notEqual(other.cookie, owner.cookie);
  const otherFavorites = await request('/api/favorites', { cookie: other.cookie });
  assert.deepEqual(otherFavorites.result.favorites, []);
  const otherDelete = await request('/api/favorites/hangzhou', {
    cookie: other.cookie,
    method: 'DELETE',
  });
  assert.deepEqual(otherDelete.result.favorites, []);
  const forbidden = await request('/api/favorites', {
    cookie: owner.cookie,
    method: 'POST',
    origin: 'https://attacker.example',
    body: { placeId: 'cairo' },
  });
  assert.equal(forbidden.response.status, 403);

  const changed = await request('/api/journey', {
    cookie: owner.cookie,
    method: 'PATCH',
    body: {
      latitude: 45,
      longitude: 12.3155,
      selectedCity: 'venice',
      explored: ['hangzhou', 'cairo', 'venice'],
      compare: [],
    },
  });
  assert.equal(changed.response.status, 200);
  const privateJourney = changed.result.journey;
  const readSnapshot = async () => {
    const publicRead = await request(`/api/shared/${shared.result.token}`);
    assert.equal(publicRead.response.status, 200);
    assert.equal(publicRead.response.headers.get('set-cookie'), null);
    assert.deepEqual(publicRead.result.snapshot, snapshot);
    assert.ok(!JSON.stringify(publicRead.result).includes(owner.cookie.split('=')[1]));
  };
  const verifyPersistence = async () => {
    assert.deepEqual((await request('/api/favorites', { cookie: owner.cookie })).result.favorites, [
      'hangzhou',
    ]);
    assert.deepEqual(
      (await request('/api/journey', { cookie: owner.cookie })).result.journey,
      privateJourney,
    );
    assert.deepEqual(
      (await request('/api/favorites', { cookie: other.cookie })).result.favorites,
      [],
    );
    await readSnapshot();
  };
  await verifyPersistence();
  console.log(
    'PASS: image boot, local assets, 16 cities, sessions, ownership, CSRF and frozen sharing',
  );

  docker(['restart', '--time', '20', containerName]);
  await waitUntilReady();
  await verifyPersistence();
  console.log('PASS: favorites, journeys and immutable public snapshot survived container restart');

  docker(['rm', '--force', containerName]);
  containerCreated = false;
  startContainer();
  await waitUntilReady();
  await verifyPersistence();
  console.log('PASS: persisted data survived replacement of the container using the same volume');
} catch (error) {
  if (containerCreated) {
    try {
      console.error(docker(['logs', '--tail', '100', containerName]));
    } catch {
      /* Retain the original test failure. */
    }
  }
  throw error;
} finally {
  // Names are generated in this script, never accepted from user input.
  if (containerCreated) docker(['rm', '--force', containerName]);
  if (volumeCreated) docker(['volume', 'rm', volumeName]);
}
