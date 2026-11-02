import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.ts';
import { createApi } from './api.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const production = process.argv.includes('--production');
const databasePath = process.env.DATABASE_PATH || resolve(root, 'data/inquiries.sqlite');
await mkdir(dirname(databasePath), { recursive: true });
const db = openDatabase(databasePath);
const api = createApi(db);
const vite = production ? null : await (await import('vite')).createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
const dist = resolve(root, 'dist');
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  if (production) res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (req.url?.startsWith('/api/')) { await api(req, res); return; }
  if (vite) { vite.middlewares(req, res); return; }
  if (!['GET', 'HEAD'].includes(req.method || '')) { res.writeHead(405); res.end(); return; }
  try {
    const path = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    let file = resolve(dist, `.${path}`);
    if (!file.startsWith(dist + sep) && file !== dist) { res.writeHead(403); res.end(); return; }
    if (!extname(file)) file = resolve(dist, 'index.html');
    const buffer = await readFile(file);
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
    res.end(req.method === 'HEAD' ? undefined : buffer);
  } catch { res.writeHead(404); res.end('Not found'); }
});
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => console.log(`Cynbit Solution Finder ready at http://${host}:${port} (${production ? 'production' : 'development'})`));
async function shutdown() { await vite?.close(); server.close(() => { db.close(); process.exit(0); }); }
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
