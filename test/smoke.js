const assert = require('assert/strict');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const port = 18_000 + Math.floor(Math.random() * 1_000);
const baseUrl = `http://127.0.0.1:${port}`;
const projectRoot = path.resolve(__dirname, '..');
const server = spawn(process.execPath, ['server.js'], {
  cwd: projectRoot,
  env: { ...process.env, PORT: String(port) },
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

  for (const pathname of [
    '/',
    '/capture.html?species=fox',
    '/display.html',
    '/animals/lion/template.svg',
    '/animals/lion/rig.js',
    '/animals/fox/template.svg',
    '/animals/zebra/template.svg',
    '/animals/gazelle/template.svg',
  ]) {
    const response = await fetch(`${baseUrl}${pathname}`);
    assert.equal(response.status, 200, `${pathname} should load`);
  }

  assert.equal(await requestRaw('/%2e%2e%2fserver.js'), 403, 'path traversal should be blocked');

  let response = await fetch(`${baseUrl}/api/animals`);
  assert.deepEqual(await response.json(), []);

  response = await fetch(`${baseUrl}/api/animals`, {
    body: JSON.stringify({ species: 'giraffe', texture: 'not-a-png' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  assert.equal(response.status, 400, 'invalid animal should be rejected');

  const onePixelPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const supportedSpecies = ['lion', 'fox', 'zebra', 'gazelle'];
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

  response = await fetch(`${baseUrl}/api/clear`, { method: 'POST' });
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
  });
