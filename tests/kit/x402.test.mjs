import { test } from 'node:test'; import assert from 'node:assert/strict';
import { requirements, paid } from '../../kit/fn/x402.js'; import { healthShape } from '../../kit/fn/health.js';
const ENV = { X402_NETWORK: 'base', X402_PRICE_USDC: '0.02', X402_PAY_TO: '0xFCc1D28Ad797d65CDDb2A7219c5BE6B062653cb3', CDP_API_KEY_ID: 'x', CDP_API_KEY_SECRET: Buffer.alloc(64, 7).toString('base64'), PRO_LINK: 'https://buy.stripe.com/28E8wQbaf2iKg4V2em9AA0y' };
test('requirements() returns the x402 v1 accepts entry for Base USDC', () => {
  const r = requirements(ENV, 'https://3fs.app/api/x', 'd');
  assert.equal(r.scheme, 'exact'); assert.equal(r.network, 'base'); assert.equal(r.maxAmountRequired, '20000');
  assert.equal(r.asset, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'); assert.equal(r.payTo, ENV.X402_PAY_TO); assert.equal(r.resource, 'https://3fs.app/api/x');
});
test('requirements() is null on Base without CDP credentials', () => {
  assert.equal(requirements({ ...ENV, CDP_API_KEY_ID: '', CDP_API_KEY_SECRET: '' }, 'https://3fs.app/api/x', 'd'), null);
});
test('paid() answers 402 with terms when there is no key and no payment', async () => {
  const res = await paid(ENV, new Request('https://3fs.app/api/x?zip=1'), { resource: 'https://3fs.app/api/x', description: 'd', kind: 'x' }, async () => ({ ok: true }));
  assert.equal(res.status, 402); const b = await res.json();
  assert.equal(b.x402Version, 1); assert.equal(b.accepts.length, 1); assert.equal(b.pro_alternative, ENV.PRO_LINK);
});
test('healthShape() reports the standard fields', async () => {
  const h = await healthShape({ ...ENV, DB: { prepare: () => ({ first: async () => ({ 1: 1 }) }) }, STRIPE_WEBHOOK_SECRET: 's' }, { door: 'x' });
  assert.equal(h.ok, true); assert.equal(h.database, true); assert.equal(h.pro_billing, true); assert.equal(h.x402.network, 'base'); assert.equal(h.x402.pay_to_set, true); assert.equal(h.door, 'x');
});
