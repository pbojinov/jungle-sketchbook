const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { AnimalStore, isPng } = require('./lib/animal-store');
const speciesCatalog = require('./public/species');

const PORT = Number(process.env.PORT) || 8000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');
const MAX_BODY_BYTES = 5_000_000;
const ADMIN_PIN = process.env.ADMIN_PIN || '';
const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
const SUPPORTED_SPECIES = new Set(Object.keys(speciesCatalog));
const clients = new Set();
const sessions = new Map();
const store = new AnimalStore({ dataDir: DATA_DIR, validSpecies: SUPPORTED_SPECIES });

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function sendJson(res, statusCode, value, headers = {}) {
  const body = JSON.stringify(value);
  res.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(body);
}

function broadcast(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    if (client.writableEnded || client.destroyed) {
      clients.delete(client);
      continue;
    }
    try {
      client.write(message);
    } catch {
      clients.delete(client);
    }
  }
}

function resolvePublicFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relativePath = decoded.replace(/^\/+/, '') || 'index.html';
  const filePath = path.resolve(PUBLIC_DIR, relativePath);
  const isInsidePublic =
    filePath === PUBLIC_DIR || filePath.startsWith(`${PUBLIC_DIR}${path.sep}`);
  return isInsidePublic ? filePath : null;
}

function serveStatic(pathname, res) {
  const filePath = resolvePublicFile(pathname);
  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500);
      res.end(error.code === 'ENOENT' ? 'Not found' : 'Could not read file');
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=300',
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(data);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let receivedBytes = 0;
    let settled = false;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      if (settled) return;
      receivedBytes += Buffer.byteLength(chunk);
      if (receivedBytes > MAX_BODY_BYTES) {
        settled = true;
        const error = new Error('Image payload is too large');
        error.statusCode = 413;
        reject(error);
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on('error', (error) => {
      if (!settled) reject(error);
    });
  });
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').flatMap((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return [];
    return [[part.slice(0, separator).trim(), part.slice(separator + 1).trim()]];
  }));
}

function isAdmin(req) {
  const token = parseCookies(req).jungle_admin;
  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return false;
  }
  return true;
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  sendJson(res, 401, { error: 'Parent sign-in required' });
  return false;
}

function pinMatches(candidate) {
  if (!ADMIN_PIN || typeof candidate !== 'string') return false;
  const configured = Buffer.from(ADMIN_PIN);
  const supplied = Buffer.from(candidate);
  return configured.length === supplied.length && crypto.timingSafeEqual(configured, supplied);
}

async function serveAnimalTexture(id, res) {
  if (!store.has(id)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  try {
    const image = await fs.promises.readFile(store.imagePath(id));
    res.writeHead(200, {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': image.length,
      'Content-Type': 'image/png',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(image);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

async function handleAnimalUpload(req, res) {
  const data = await readJsonBody(req);
  const match = typeof data.texture === 'string' &&
    data.texture.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!SUPPORTED_SPECIES.has(data.species) || !match) {
    sendJson(res, 400, { error: 'Expected a supported species with a PNG data URL' });
    return;
  }
  const animal = {
    createdAt: Date.now(),
    id: crypto.randomUUID(),
    species: data.species,
  };
  const image = Buffer.from(match[1], 'base64');
  if (!isPng(image)) {
    sendJson(res, 400, { error: 'Texture is not a valid PNG' });
    return;
  }
  try {
    const saved = await store.add(animal, image);
    broadcast('animal', saved);
    sendJson(res, 201, { id: animal.id, ok: true });
  } catch (error) {
    if (error.code === 'PAUSED') {
      sendJson(res, 503, { error: error.message });
      return;
    }
    throw error;
  }
}

async function handleAdminLogin(req, res) {
  if (!ADMIN_PIN) {
    sendJson(res, 503, { error: 'Set ADMIN_PIN before using parent controls' });
    return;
  }
  const data = await readJsonBody(req);
  if (!pinMatches(data.pin)) {
    sendJson(res, 401, { error: 'Incorrect PIN' });
    return;
  }
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, Date.now() + ADMIN_SESSION_MS);
  sendJson(res, 200, { ok: true }, {
    'Set-Cookie': `jungle_admin=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200`,
  });
}

async function handleRequest(req, res) {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    sendJson(res, 400, { error: 'Invalid request URL' });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/events') {
    res.writeHead(200, {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
    });
    res.write(': connected\n\n');
    clients.add(res);
    const heartbeat = setInterval(() => {
      if (!res.writableEnded && !res.destroyed) res.write(': keepalive\n\n');
    }, 25_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, {
      connectedDisplays: clients.size,
      paused: store.getSettings().paused,
      recentAnimals: store.list(100).length,
      status: store.ready ? 'ok' : 'starting',
      storage: { persistent: true, ready: store.ready },
      uptimeSeconds: Math.floor(process.uptime()),
    });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/animals') {
    sendJson(res, 200, store.list());
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/animals') {
    await handleAnimalUpload(req, res);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/login') {
    await handleAdminLogin(req, res);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/status') {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, { animals: store.list(100), settings: store.getSettings() });
    return;
  }
  if (req.method === 'PATCH' && url.pathname === '/api/admin/settings') {
    if (!requireAdmin(req, res)) return;
    const data = await readJsonBody(req);
    const maxAnimalsIsValid =
      data.maxAnimals === undefined ||
      (Number.isInteger(data.maxAnimals) && data.maxAnimals >= 1 && data.maxAnimals <= 100);
    const pausedIsValid = data.paused === undefined || typeof data.paused === 'boolean';
    if (!maxAnimalsIsValid || !pausedIsValid) {
      sendJson(res, 400, { error: 'Expected paused boolean and maxAnimals from 1 to 100' });
      return;
    }
    const settings = await store.updateSettings(data);
    sendJson(res, 200, { ok: true, settings });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/clear') {
    if (!requireAdmin(req, res)) return;
    await store.clear();
    broadcast('clear', {});
    sendJson(res, 200, { ok: true });
    return;
  }

  const animalMatch = url.pathname.match(/^\/api\/animals\/([0-9a-f-]{36})$/i);
  if (req.method === 'DELETE' && animalMatch) {
    if (!requireAdmin(req, res)) return;
    const removed = await store.remove(animalMatch[1]);
    if (!removed) {
      sendJson(res, 404, { error: 'Animal not found' });
      return;
    }
    broadcast('remove', { id: animalMatch[1] });
    sendJson(res, 200, { ok: true });
    return;
  }

  const textureMatch = url.pathname.match(/^\/data\/animals\/([0-9a-f-]{36})\.png$/i);
  if (req.method === 'GET' && textureMatch) {
    await serveAnimalTexture(textureMatch[1], res);
    return;
  }
  if (req.method === 'GET') {
    serveStatic(url.pathname, res);
    return;
  }
  res.writeHead(405, { Allow: 'GET, POST, PATCH, DELETE' });
  res.end('Method not allowed');
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    sendJson(res, error.statusCode || 500, {
      error: error.statusCode ? error.message : 'Internal server error',
    });
    if (!error.statusCode) console.error(error);
  });
});

server.on('clientError', (_error, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

async function start() {
  await store.initialize();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Live Sketchbook: http://localhost:${PORT}`);
    try {
      for (const interfaces of Object.values(os.networkInterfaces())) {
        for (const address of interfaces || []) {
          if (address.family === 'IPv4' && !address.internal) {
            console.log(`LAN: http://${address.address}:${PORT}`);
          }
        }
      }
    } catch (error) {
      console.warn(`LAN address unavailable: ${error.message}`);
    }
  });
}

function shutDown() {
  for (const client of clients) client.end();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.once('SIGINT', shutDown);
process.once('SIGTERM', shutDown);

start().catch((error) => {
  console.error(`Could not start Jungle Sketchbook: ${error.message}`);
  process.exitCode = 1;
});
