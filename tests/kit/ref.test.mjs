import { test } from 'node:test'; import assert from 'node:assert/strict';
import { validCode, captureRef, decorate, STORE_KEY } from '../../kit/js/ref.js';
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
test('validCode accepts a-z0-9- of 3..32 chars, case-insensitive, rejects junk', () => {
  assert.equal(validCode('<script>'), false); assert.equal(validCode('x'.repeat(300)), false); assert.equal(validCode('ab'), false);
  assert.equal(validCode('Buck-2026'), true); assert.equal(validCode('ünï'), false); assert.equal(validCode(''), false);
});
test('captureRef stores a valid ?ref and ignores junk', () => {
  const s = mem(); captureRef('?ref=Buck&x=1', s); assert.equal(JSON.parse(s.getItem(STORE_KEY)).code, 'buck');
  const s2 = mem(); captureRef('?ref=<script>', s2); assert.equal(s2.getItem(STORE_KEY), null);
});
test('decorate appends client_reference_id to the Stripe link while the ref is fresh', () => {
  const s = mem(); captureRef('?ref=buck', s);
  assert.equal(decorate('https://buy.stripe.com/x', s), 'https://buy.stripe.com/x?client_reference_id=buck');
  assert.equal(decorate('https://buy.stripe.com/x?a=1', s), 'https://buy.stripe.com/x?a=1&client_reference_id=buck');
});
test('an expired ref (91 days) does not decorate', () => {
  const s = mem(); s.setItem(STORE_KEY, JSON.stringify({ code: 'buck', ts: Date.now() - 91 * 86400000 }));
  assert.equal(decorate('https://buy.stripe.com/x', s), 'https://buy.stripe.com/x');
});
