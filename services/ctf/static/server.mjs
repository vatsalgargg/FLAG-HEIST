import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root = path.resolve(process.env.STATIC_ROOT || '/public');
const id = process.env.CHALLENGE_ID || '1';
const headers = { 'Strict-Transport-Security': 'max-age=31536000', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'" };
http.createServer(async (req, res) => {
  const started = Date.now();
  res.on('finish', () => console.log(JSON.stringify({ service: `challenge-${id}`, method: req.method, status: res.statusCode, durationMs: Date.now() - started })));
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/healthz') {
    try { await fs.access(path.join(root, 'index.html')); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ status: 'ok', service: `challenge-${id}` })); }
    catch { res.writeHead(503).end(); } return;
  }
  if (req.method === 'POST' && url.pathname === `/reset/${id}`) {
    const expected = Buffer.from(`Bearer ${process.env.RESET_TOKEN || ''}`); const supplied = Buffer.from(req.headers.authorization || '');
    if (!process.env.RESET_TOKEN || expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) { res.writeHead(401).end(); return; }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ status: 'ok', challenge_id: id, message: 'Static challenge has no mutable state.' })); return;
  }
  try {
    let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const content = await fs.readFile(file);
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    res.end(content);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(Number(process.env.PORT || 3001), '0.0.0.0');
