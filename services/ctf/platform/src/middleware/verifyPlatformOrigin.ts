import assert from 'node:assert/strict';
import { isAllowedPlatformOrigin } from './platformOrigin';

const configured = 'http://localhost:3000';
for (const origin of ['http://localhost:3003', 'http://127.0.0.1:3015', 'http://[::1]:3003']) {
  assert.equal(isAllowedPlatformOrigin(origin, configured, false), true, origin);
  assert.equal(isAllowedPlatformOrigin(origin, configured, true), false, origin);
}
assert.equal(isAllowedPlatformOrigin('https://review.example.test', configured, false, 'review.example.test'), true);
assert.equal(isAllowedPlatformOrigin('https://other.example.test', configured, false, 'review.example.test'), false);
for (const origin of ['null', 'invalid', 'http://localhost.evil.test:3003', 'https://evil.test', 'file://localhost', 'http://localhost:3003/path']) {
  assert.equal(isAllowedPlatformOrigin(origin, configured, false), false, origin);
}
assert.equal(isAllowedPlatformOrigin(configured, configured, true), true);
assert.equal(isAllowedPlatformOrigin('https://review.example.test', configured, true, 'review.example.test'), false);
console.log('PASS: local/proxy previews work and production origin restrictions remain enforced.');
