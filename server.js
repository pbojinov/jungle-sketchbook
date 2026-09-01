const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const speciesCatalog = require('./public/species');

const PORT = Number(process.env.PORT) || 8000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 5_000_000;
const MAX_ANIMALS = 30;
const SUPPORTED_SPECIES = new Set(Object.keys(speciesCatalog));
const clients = new Set();
const animals = [];

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function sendJson(res, statusCode, value) {
  const body = JSON.stringify(value);
  res.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json; charset=utf-8',
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

function handleAnimalUpload(req, res) {
  let body = '';
  let tooLarge = false;
  req.setEncoding('utf8');

  req.on('data', (chunk) => {
    if (tooLarge) return;
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      tooLarge = true;
      body = '';
      sendJson(res, 413, { error: 'Image payload is too large' });
    }
  });

  req.on('end', () => {
    if (tooLarge) return;
    try {
      const data = JSON.parse(body);
      const validTexture =
        typeof data.texture === 'string' &&
        data.texture.startsWith('data:image/png;base64,');

      if (!SUPPORTED_SPECIES.has(data.species) || !validTexture) {
        sendJson(res, 400, { error: 'Expected a supported species with a PNG data URL' });
        return;
      }

      const animal = {
        createdAt: Date.now(),
        id: crypto.randomUUID(),
        species: data.species,
        texture: data.texture,
      };
      animals.push(animal);
      while (animals.length > MAX_ANIMALS) animals.shift();
      broadcast('animal', animal);
      sendJson(res, 201, { id: animal.id, ok: true });
    } catch (error) {
      sendJson(res, 400, { error: `Invalid JSON: ${error.message}` });
    }
  });
}

const server = http.createServer((req, res) => {
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

  if (req.method === 'GET' && url.pathname === '/api/animals') {
    sendJson(res, 200, animals.slice(-20));
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/animals') {
    handleAnimalUpload(req, res);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/clear') {
    animals.length = 0;
    broadcast('clear', {});
    sendJson(res, 200, { ok: true });
    return;
  }
  if (req.method === 'GET') {
    serveStatic(url.pathname, res);
    return;
  }

  res.writeHead(405, { Allow: 'GET, POST' });
  res.end('Method not allowed');
});

server.on('clientError', (_error, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Live Sketchbook V0: http://localhost:${PORT}`);
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
