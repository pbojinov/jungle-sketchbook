const assert = require('assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const speciesCatalog = require('../public/species');

const port = 18_000 + Math.floor(Math.random() * 1_000);
const baseUrl = `http://127.0.0.1:${port}`;
const projectRoot = path.resolve(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jungle-smoke-'));
let adminCookie = '';
const server = spawn(process.execPath, ['server.js'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    ADMIN_PIN: '2468',
    DATA_DIR: dataDir,
    PORT: String(port),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/animals`);
      if (response.ok) return;
    } catch {
      // The process may still be binding its port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start:\n${serverOutput}`);
}

function requestRaw(pathname) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', path: pathname, port }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject);
  });
}

async function run() {
  await waitForServer();

  const staticPaths = [
    '/',
    '/capture.html?species=fox',
    '/display.html',
    '/admin.html',
    '/species.js',
    '/capture-loader.js',
    '/markers/0.svg',
    '/markers/23.svg',
    '/vendor/js-aruco2/aruco.js',
    ...Object.keys(speciesCatalog).map((species) => `/animals/${species}/template.svg`),
  ];
  for (const pathname of staticPaths) {
    const response = await fetch(`${baseUrl}${pathname}`);
    assert.equal(response.status, 200, `${pathname} should load`);
  }

  assert.equal(await requestRaw('/%2e%2e%2fserver.js'), 403, 'path traversal should be blocked');

  let response = await fetch(`${baseUrl}/api/animals`);
  assert.deepEqual(await response.json(), []);

  response = await fetch(`${baseUrl}/api/health`);
  const health = await response.json();
  assert.equal(health.status, 'ok');
  assert.equal(health.storage.persistent, true);

  response = await fetch(`${baseUrl}/api/clear`, { method: 'POST' });
  assert.equal(response.status, 401, 'destructive controls should require a PIN session');

  response = await fetch(`${baseUrl}/api/admin/login`, {
    body: JSON.stringify({ pin: '2468' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  assert.equal(response.status, 200);
  adminCookie = response.headers.get('set-cookie').split(';')[0];

  response = await fetch(`${baseUrl}/api/animals`, {
    body: JSON.stringify({ species: 'giraffe', texture: 'not-a-png' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  assert.equal(response.status, 400, 'invalid animal should be rejected');

  const onePixelPng = [
    'data:image/png;base64,',
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk',
    '+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  ].join('');
  const supportedSpecies = Object.keys(speciesCatalog);
  for (const species of supportedSpecies) {
    response = await fetch(`${baseUrl}/api/animals`, {
      body: JSON.stringify({ species, texture: onePixelPng }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    assert.equal(response.status, 201, `valid ${species} should be accepted`);
  }

  response = await fetch(`${baseUrl}/api/animals`);
  const animals = await response.json();
  assert.deepEqual(
    animals.map((animal) => animal.species),
    supportedSpecies,
  );
  assert.ok(animals.every((animal) => animal.id));
  assert.ok(animals.every((animal) => animal.texture.startsWith('/data/animals/')));

  response = await fetch(`${baseUrl}${animals[0].texture}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');

  response = await fetch(`${baseUrl}/api/admin/settings`, {
    body: JSON.stringify({ maxAnimals: 30, paused: true }),
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    method: 'PATCH',
  });
  assert.equal(response.status, 200);

  response = await fetch(`${baseUrl}/api/animals`, {
    body: JSON.stringify({ species: 'lion', texture: onePixelPng }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  assert.equal(response.status, 503, 'paused arrivals should be rejected');

  response = await fetch(`${baseUrl}/api/admin/settings`, {
    body: JSON.stringify({ maxAnimals: 30, paused: false }),
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    method: 'PATCH',
  });
  assert.equal(response.status, 200);

  response = await fetch(`${baseUrl}/api/animals/${animals[0].id}`, {
    headers: { Cookie: adminCookie },
    method: 'DELETE',
  });
  assert.equal(response.status, 200);

  response = await fetch(`${baseUrl}/api/clear`, {
    headers: { Cookie: adminCookie },
    method: 'POST',
  });
  assert.equal(response.status, 200);
  response = await fetch(`${baseUrl}/api/animals`);
  assert.deepEqual(await response.json(), []);

  console.log('Smoke test passed');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    server.kill('SIGTERM');
    fs.rmSync(dataDir, { force: true, recursive: true });
  });
