import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
const id = Number(process.env.CHALLENGE_ID);
if (![10, 12, 13].includes(id)) throw new Error('Unsupported sandbox challenge');
const image = `flagheist-ch${id}:local`;
const collabContainer = process.env.COLLAB_CONTAINER || 'flagheist-collab';
let active = 0;
let codeSecret = crypto.randomBytes(32).toString('hex');
function docker(args, input = '', timeout = 15000) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', errors = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 4 * 1024 * 1024) child.kill('SIGKILL'); });
    child.stderr.on('data', chunk => { if (errors.length < 10000) errors += chunk; });
    child.on('error', reject); child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error(errors || 'Sandbox timed out')); });
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
async function cleanup(name, network) {
  await docker(['rm', '-f', name]).catch(() => {});
  if (id !== 10) await docker(['network', 'disconnect', '-f', network, collabContainer]).catch(() => {});
  await docker(['network', 'rm', network]).catch(() => {});
}
const headers = { 'Content-Type': 'application/json', 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; base-uri 'none'", 'Referrer-Policy': 'no-referrer', 'Strict-Transport-Security': 'max-age=31536000', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' };
http.createServer(async (req, res) => {
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  if (req.url === '/healthz') {
    try {
      await docker(['image', 'inspect', image], '', 3000);
      if (id !== 10) { const health = await fetch('http://collab:8082/healthz', { signal: AbortSignal.timeout(1500) }); if (!health.ok) throw new Error('Callback service down'); }
      return res.end(JSON.stringify({ status: 'ok', service: `sandbox-${id}`, isolation: 'disposable-container' }));
    } catch { res.statusCode = 503; return res.end(JSON.stringify({ status: 'degraded' })); }
  }
  if (req.method === 'POST' && req.url === `/reset/${id}`) {
    const expected = Buffer.from(`Bearer ${process.env.RESET_TOKEN || ''}`), supplied = Buffer.from(req.headers.authorization || '');
    if (!process.env.RESET_TOKEN || expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) { res.statusCode = 401; return res.end('{}'); }
    codeSecret = crypto.randomBytes(32).toString('hex');
    try {
      if (id !== 10) {
        const result = await fetch(`http://collab:8082/reset/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESET_TOKEN}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(3000) });
        if (!result.ok) throw new Error('Callback reset failed');
      }
      return res.end(JSON.stringify({ status: 'ok', challenge_id: id, reset_at: new Date().toISOString() }));
    } catch { res.statusCode = 502; return res.end(JSON.stringify({ message: 'Callback reset failed' })); }
  }
  if (active >= 4) { res.statusCode = 429; res.setHeader('Retry-After', '3'); return res.end(JSON.stringify({ message: 'Training sandbox busy. Retry shortly.' })); }
  active++;
  const name = `flagheist-run-${crypto.randomUUID()}`, network = name;
  const started = Date.now();
  try {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 65536) throw new Error('Request exceeds 64 KB'); chunks.push(chunk); }
    const request = { method: req.method, path: req.url, headers: { 'content-type': req.headers['content-type'] || 'application/json', ...(req.headers['x-veyra-access-key'] ? { 'x-veyra-access-key': req.headers['x-veyra-access-key'] } : {}) }, body: Buffer.concat(chunks).toString('base64') };
    await docker(['network', 'create', '--internal', '--opt', 'com.docker.network.bridge.gateway_mode_ipv4=isolated', '--label', 'flagheist.sandbox=true', network]);
    if (id !== 10) await docker(['network', 'connect', '--alias', 'collab', network, collabContainer]);
    const output = await docker(['run', '--rm', '-i', '--name', name, '--label', 'flagheist.sandbox=true', '--network', network, '--read-only', '--cpus', '0.5', '--memory', '128m', '--memory-swap', '128m', '--pids-limit', '32', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m,mode=1777', '--tmpfs', '/app/data/scratch:rw,noexec,nosuid,size=8m,mode=1777', '-e', `CHALLENGE_ID=${id}`, '-e', 'COLLAB_URL=http://collab:8082', ...(id === 13 ? ['-e', `CHALLENGE_CODE_SECRET=${codeSecret}`] : []), image], JSON.stringify(request), 10000);
    const line = output.split('\n').find(line => line.startsWith('__CTF_RESPONSE__'));
    if (!line) throw new Error('Sandbox returned no response');
    const response = JSON.parse(line.slice('__CTF_RESPONSE__'.length));
    res.statusCode = response.status;
    for (const [key, value] of Object.entries(response.headers)) if (!['connection', 'keep-alive', 'transfer-encoding', 'content-length'].includes(key)) res.setHeader(key, value);
    res.end(Buffer.from(response.body, 'base64'));
  } catch (err) {
    res.statusCode = 503; res.end(JSON.stringify({ message: 'Training sandbox unavailable. Please retry.' }));
    console.error(JSON.stringify({ level: 'error', service: `sandbox-${id}`, error: err.message }));
  } finally {
    await cleanup(name, network); active--;
    console.log(JSON.stringify({ level: 'info', service: `sandbox-${id}`, method: req.method, path: req.url?.split('?')[0], status: res.statusCode, durationMs: Date.now() - started }));
  }
}).listen(3000 + id, '0.0.0.0');
