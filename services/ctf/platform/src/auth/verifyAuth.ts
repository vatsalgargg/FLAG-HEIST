import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { eq } from 'drizzle-orm';
import { createApp } from '../app';
import { db, teams, closeDatabase } from '../db';
import { redis } from '../cache';
import { hashPassword } from './password';
import { issueAdminToken } from './tokens';
import { TEAM_COOKIE_NAME } from './cookies';

async function verify(): Promise<void> {
  const id = randomUUID();
  const duplicateId = randomUUID();
  const email = `leader-${id}@example.test`;
  const memberEmail = `member-${id}@example.test`;
  const password = 'Verification-password-123!';
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown) => fetch(`${base}/api/auth/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  try {
    const passwordHash = await hashPassword(password);
    await db.insert(teams).values({ id, teamName: `Auth verification ${id}`,
      memberEmails: [email, memberEmail], teamSize: 2, passwordHash });

    for (const path of ['/api/auth/register', '/auth/register']) {
      const res = await fetch(base + path, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          team_name: `Forbidden ${id}`, member_emails: [email], team_size: 1,
          password, accepted_rules: true, captcha_token: 'test-captcha-token',
        }) });
      assert.equal(res.status, 403, 'Public registration must be disabled on both aliases');
      assert.equal(res.headers.get('set-cookie'), null);
    }
    for (const body of [ {}, { leader_email: [], password },
      { leader_email: 'invalid', password }, { leader_email: email, password: 'x'.repeat(73) },
      { team_name: `Auth verification ${id}`, password } ]) {
      assert.equal((await post('login', body)).status, 400);
    }
    const denied = async (leader_email: string, candidate = password) => {
      const res = await post('login', { leader_email, password: candidate });
      assert.equal(res.status, 401);
      assert.equal(res.headers.get('set-cookie'), null);
      return res.json();
    };
    const wrong = await denied(email, 'Wrong-password');
    assert.deepEqual(await denied(`unknown-${id}@example.test`), wrong);
    assert.deepEqual(await denied(memberEmail), wrong, 'Other team members cannot sign in');

    const login = await post('login', { leader_email: `  ${email.toUpperCase()}  `, password });
    assert.equal(login.status, 200, 'Leader email is trimmed and case insensitive');
    const data = await login.json() as { team: { id: string } };
    assert.equal(data.team.id, id);
    assert.ok(!JSON.stringify(data).includes(passwordHash));
    const setCookie = login.headers.get('set-cookie')!;
    assert.ok(setCookie.includes('HttpOnly') && setCookie.includes('SameSite=Lax'));
    const cookie = setCookie.split(';')[0];
    const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(me.status, 200);
    const session = await me.json() as { team: { id: string } };
    assert.equal(session.team.id, id);
    assert.equal((await fetch(`${base}/api/admin/me`, { headers: { Cookie: cookie } })).status, 401);
    const adminToken = issueAdminToken({ id: randomUUID(), username: 'verification', role: 'admin' });
    assert.equal((await fetch(`${base}/api/auth/me`, {
      headers: { Cookie: `${TEAM_COOKIE_NAME}=${adminToken}` },
    })).status, 401);
    const logout = await post('logout', {});
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie')!, /Expires=|Max-Age=0/);

    await db.insert(teams).values({ id: duplicateId, teamName: `Duplicate leader ${id}`,
      memberEmails: [email.toUpperCase()], teamSize: 1, passwordHash });
    assert.deepEqual(await denied(email), wrong, 'Ambiguous leader identities fail closed');
    await db.delete(teams).where(eq(teams.id, duplicateId));

    const lockedEmail = `locked-${id}@example.test`;
    for (let i = 0; i < 5; i++) await denied(lockedEmail);
    const locked = await post('login', { leader_email: lockedEmail.toUpperCase(), password });
    assert.equal(locked.status, 429);
    assert.ok(Number(locked.headers.get('retry-after')) > 0);
    console.log('PASS: organiser-only provisioning, leader email login, validation, non-leader rejection, generic errors, duplicate rejection, sessions, auth isolation, logout and lockout.');
  } finally {
    await db.delete(teams).where(eq(teams.id, duplicateId));
    await db.delete(teams).where(eq(teams.id, id));
    await new Promise<void>(resolve => server.close(() => resolve()));
    await closeDatabase();
    await redis.quit();
  }
}
verify().catch(err => { console.error(err); process.exit(1); });
