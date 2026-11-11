// One request per disposable container; only challenge data is included in this image.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const id = Number(process.env.CHALLENGE_ID);
const port = 3000 + id;
let input = ''; for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
const module = require('/app/dist/index.js');
const app = module[`createChallenge${id}App`]();
// Initial browser requests stay external; intentional self-fetches retain loopback access.
app.set('trust proxy', 'loopback');
const server = app.listen(port, '0.0.0.0');
await new Promise(resolve => server.once('listening', resolve));
try {
  const response = await fetch(`http://127.0.0.1:${port}${request.path}`, {
    method: request.method,
    headers: { ...request.headers, 'x-forwarded-for': '198.51.100.1' },
    ...(request.body ? { body: Buffer.from(request.body, 'base64') } : {}),
    redirect: 'manual', signal: AbortSignal.timeout(4500),
  });
  const payload = { status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()).toString('base64') };
  // Blind diagnostics return a generic response, but the process must live until its callback finishes.
  if (id === 12 && request.method === 'POST') await new Promise(resolve => setTimeout(resolve, 3200));
  process.stdout.write('\n__CTF_RESPONSE__' + JSON.stringify(payload) + '\n');
} finally { server.close(); setTimeout(() => process.exit(0), 50); }
