import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app';
import { closeDatabase } from '../db';
import { redis } from '../cache';

async function verify(): Promise<void> {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth/register`;
  try {
    for (const body of [{}, { accepted_rules: true, captcha_token: 'dev-token' }]) {
      const response = await fetch(url, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 403, 'Public registration must always fail closed');
      assert.equal(response.headers.get('set-cookie'), null);
    }
    console.log('PASS: public registration is disabled, including CAPTCHA bypass tokens.');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await closeDatabase();
    await redis.quit();
  }
}
verify().catch(err => { console.error(err); process.exit(1); });
