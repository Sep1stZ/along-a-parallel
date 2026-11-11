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
    '--memory',
    '256m',
    '--memory-swap',
    '256m',
    '--cpus',
    '0.2',
    '--publish',
    `127.0.0.1:${port}:3000`,
    '--mount',
    `type=volume,source=${volumeName},target=/app/.data`,
    '--env',
    `APP_ORIGIN=${canonicalOrigin}`,
    '--env',
    'NODE_OPTIONS=--max-old-space-size=160',
    image,
  ]);
  containerCreated = true;
}

function verifyResourceBudget(label) {
  const state = JSON.parse(docker(['inspect', '--format', '{{json .State}}', containerName]));
  assert.equal(state.Running, true, `${label}: container must remain running`);
  assert.equal(state.OOMKilled, false, `${label}: container must not be OOM killed`);
  const memoryLimit = Number(
    docker(['inspect', '--format', '{{.HostConfig.Memory}}', containerName]),
  );
  const cpuLimit = Number(
    docker(['inspect', '--format', '{{.HostConfig.NanoCpus}}', containerName]),
  );
  assert.equal(memoryLimit, 256 * 1024 * 1024);
  assert.equal(cpuLimit, 200_000_000);
  const peak = docker([
    'exec',
    containerName,
    'sh',
    '-c',
    'cat /sys/fs/cgroup/memory.peak 2>/dev/null || cat /sys/fs/cgroup/memory/memory.max_usage_in_bytes 2>/dev/null || true',
  ]);
  const environment = JSON.parse(
    docker(['inspect', '--format', '{{json .Config.Env}}', containerName]),
  );
  assert.ok(environment.includes('NODE_OPTIONS=--max-old-space-size=160'));
  const stats = docker(['stats', '--no-stream', '--format', '{{.MemUsage}}', containerName]);
  if (peak)
    assert.ok(Number(peak) <= memoryLimit, `${label}: cgroup peak exceeded the memory budget`);
  console.log(
    `PASS: ${label}; 0.2 CPU / 256 MiB / Node heap 160 MiB; memory ${stats}${peak ? `; peak ${(Number(peak) / 1048576).toFixed(1)} MiB` : ''}; no OOM`,
  );
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
  assert.ok(routes.result.routes.length >= 8);
  const catalog = await request('/api/catalog');
  assert.equal(catalog.response.status, 200);
  assert.ok(catalog.result.total >= 10_000);
  assert.ok(catalog.result.curatedTotal >= 60);
  assert.equal(catalog.result.coverage.length, 181);
  assert.ok(catalog.result.coverage.filter((row) => row.count > 0).length > 100);
  assert.equal(catalog.response.headers.get('set-cookie'), null);
  assert.match(catalog.response.headers.get('cache-control') || '', /^public/);
  for (const [latitude, id] of [
    [30, 'hangzhou'],
    [45, 'venice'],
    [-23, 'rio'],
  ]) {
    const { result } = await request(`/api/places?latitude=${latitude}&band=2`);
    assert.ok(result.total >= result.places.length && result.places.length <= 60);
    assert.equal(
      result.total,
      catalog.result.coverage.find((row) => row.latitude === latitude).count,
    );
    assert.ok(result.places.every((place) => !('stories' in place)));
    const lookup = await request(`/api/places?ids=${id}`);
    assert.equal(lookup.result.places[0].id, id);
  }
  const baseCity = (await request('/api/places?latitude=30&band=2&limit=200')).result.places.find(
    (place) => place.level === 'catalog',
  );
  assert.ok(baseCity);
  const baseDetail = await request(`/api/places/${baseCity.id}`);
  assert.deepEqual(baseDetail.result.place.stories, []);
  assert.ok(baseDetail.result.place.sources.length > 0);
  const nearest = await request(
    '/api/places/nearby?latitude=30&band=2&longitude=120&direction=nearest',
  );
  assert.ok(nearest.result.place.id);

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
  const exported = await request('/api/journey/export', { cookie: owner.cookie });
  assert.equal(exported.result.version, 2);
  assert.deepEqual(exported.result.explored.sort(), ['cairo', 'hangzhou']);
  assert.ok(!JSON.stringify(exported.result).includes(owner.cookie.split('=')[1]));
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
  assert.equal(snapshot.schemaVersion, 2);
  assert.ok(snapshot.places.length <= 60);

  const other = await establishSession();
  assert.notEqual(other.cookie, owner.cookie);
  const otherFavorites = await request('/api/favorites', { cookie: other.cookie });
  assert.deepEqual(otherFavorites.result.favorites, []);
  const otherDelete = await request('/api/favorites/hangzhou', {
    cookie: other.cookie,
    method: 'DELETE',
  });
  assert.deepEqual(otherDelete.result.favorites, []);
  const otherRevoke = await request(`/api/shares/${shared.result.token}`, {
    cookie: other.cookie,
    method: 'DELETE',
  });
  assert.equal(otherRevoke.response.status, 404);
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
    // Render the server page too: this loads the RSC route bundle in addition to API bundles.
    const page = await fetch(`${baseUrl}/shared/${shared.result.token}`, {
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('set-cookie'), null);
    const html = await page.text();
    assert.ok(html.includes(snapshot.name));
    assert.equal(
      (html.match(/class="shared-card"/g) || []).length,
      Math.min(12, snapshot.places.length),
    );
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
  verifyResourceBudget('initial import and API checks');
  console.log(
    `PASS: image boot, local assets, ${catalog.result.total} catalog cities / ${catalog.result.curatedTotal} curated, sessions, ownership, export, CSRF and frozen sharing`,
  );

  docker(['restart', '--time', '20', containerName]);
  await waitUntilReady();
  await verifyPersistence();
  verifyResourceBudget('restart with unchanged catalog');
  console.log('PASS: favorites, journeys and immutable public snapshot survived container restart');

  docker(['rm', '--force', containerName]);
  containerCreated = false;
  startContainer();
  await waitUntilReady();
  await verifyPersistence();
  verifyResourceBudget('replacement with persistent volume');
  console.log('PASS: persisted data survived replacement of the container using the same volume');
  const shares = await request('/api/shares', { cookie: owner.cookie });
  assert.ok(shares.result.shares.some((share) => share.token === shared.result.token));
  const revoked = await request(`/api/shares/${shared.result.token}`, {
    cookie: owner.cookie,
    method: 'DELETE',
  });
  assert.equal(revoked.response.status, 200);
  const gone = await request(`/api/shared/${shared.result.token}`);
  assert.equal(gone.response.status, 410);
  assert.match(gone.response.headers.get('cache-control') || '', /no-store/);
  const withdrawnPage = await fetch(`${baseUrl}/shared/${shared.result.token}`, {
    signal: AbortSignal.timeout(15_000),
  });
  assert.match(await withdrawnPage.text(), /这条分享旅程已撤销/);
  console.log('PASS: owner-only revocation returns an uncached HTTP 410');
} catch (error) {
  if (containerCreated) {
    try {
      console.error(
        `Container state: ${docker(['inspect', '--format', '{{json .State}}', containerName])}`,
      );
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
