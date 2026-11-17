import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultDbPath, openDatabase } from './db.js';
import { handleApi, sendError } from './routes.js';
import { seedIfEmpty } from './seed.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export function createServer({ dbPath = defaultDbPath(), seed = true } = {}) {
  const db = openDatabase(dbPath);
  if (seed) seedIfEmpty(db);
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/')) {
        await handleApi(db, req, res, url);
        return;
      }
      serveStatic(req, res, url);
    } catch (error) {
      if (!res.headersSent) sendError(res, error);
      else res.end();
    }
  });
  return { server, db };
}

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' });
    res.end();
    return;
  }
  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  let file = safeFile(requested);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    file = path.extname(requested) ? null : safeFile('/index.html');
  }
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(file).pipe(res);
}

function safeFile(requested) {
  const file = path.normalize(path.join(publicDir, requested));
  if (file !== publicDir && !file.startsWith(publicDir + path.sep)) return null;
  return file;
}

export function start() {
  const port = Number(process.env.PORT || 4780);
  const host = process.env.HOST || '127.0.0.1';
  const { server } = createServer();
  server.listen(port, host, () => {
    console.log(`HSE Ledger listening on http://${host}:${port}`);
  });
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) start();
