import { test } from 'node:test'; import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { signOrigins, verifyOrigins } from '../../kit/fn/origins.js';
const kp = () => { const { privateKey, publicKey } = generateKeyPairSync('ed25519'); return { priv: privateKey.export({ type: 'pkcs8', format: 'pem' }), pub: publicKey.export({ type: 'spki', format: 'pem' }) }; };
const payload = { issued: '2026-10-07', origins: ['https://3fs.app', 'https://usda.3fs.app', 'https://grants.3fs.app'], agents: { erc8004: { chain: 'base', registry: '', ids: {} } } };
test('a signed registry verifies with the matching public key', async () => {
  const k = kp(); const signed = await signOrigins(payload, k.priv);
  assert.equal(await verifyOrigins(signed, k.pub), true); assert.ok(signed.sig && signed.payload);
});
test('a different key does not verify', async () => {
  const a = kp(), b = kp(); const signed = await signOrigins(payload, a.priv);
  assert.equal(await verifyOrigins(signed, b.pub), false);
});
test('a lookalike origin fails even with a valid signature', async () => {
  const k = kp(); const signed = await signOrigins({ ...payload, origins: [...payload.origins, 'https://3fs-app.com'] }, k.priv);
  assert.equal(await verifyOrigins(signed, k.pub), false);
});
