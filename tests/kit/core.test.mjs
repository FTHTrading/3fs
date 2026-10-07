import { test } from 'node:test'; import assert from 'node:assert/strict';
import { json, readJson, proFromAuth, limited, sha256hex } from '../../kit/fn/core.js';
import { fakeD1 } from './fake-d1.mjs';
const req = (body, headers = {}) => new Request('https://3fs.app/api/x', { method: 'POST', body, headers });

test('json() sets content type, no-store and open CORS', async () => {
  const r = json({ a: 1 }, 201);
  assert.equal(r.status, 201); assert.match(r.headers.get('content-type'), /application\/json/);
  assert.equal(r.headers.get('cache-control'), 'no-store'); assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.deepEqual(await r.json(), { a: 1 });
});
test('readJson rejects oversize bodies with 413 and bad JSON with 400', async () => {
  await assert.rejects(readJson(req('x'.repeat(70000))), e => e.status === 413);
  await assert.rejects(readJson(req('not json')), e => e.status === 400);
  assert.deepEqual(await readJson(req('{"ok":true}')), { ok: true });
});
test('proFromAuth gates on key shape before touching the database', async () => {
  const env = {}; // no DB: any DB touch would throw
  assert.equal(await proFromAuth(new Request('https://x/', { headers: { authorization: 'Bearer rh_' + 'a'.repeat(47) } }), env), null);
  assert.equal(await proFromAuth(new Request('https://x/', { headers: { authorization: "Bearer rh_' OR 1=1 --" } }), env), null);
});
test('proFromAuth returns the active account for a known key', async () => {
  const DB = fakeD1(); const key = 'rh_' + 'b'.repeat(48);
  DB.tables.pro_accounts.push({ session_id: 'cs_1', email: 'a@b.c', status: 'active', key_hash: await sha256hex(key) });
  const row = await proFromAuth(new Request('https://x/', { headers: { authorization: 'Bearer ' + key } }), { DB });
  assert.equal(row.session_id, 'cs_1');
  DB.tables.pro_accounts[0].status = 'inactive';
  assert.equal(await proFromAuth(new Request('https://x/', { headers: { authorization: 'Bearer ' + key } }), { DB }), null);
});
test('limited trips on the 11th call in a minute at perMin 10', async () => {
  const DB = fakeD1(); const r = new Request('https://x/', { headers: { 'cf-connecting-ip': '1.2.3.4' } });
  for (let i = 1; i <= 10; i++) assert.equal(await limited({ DB }, r, 't', 10, 100), false, 'call ' + i);
  assert.equal(await limited({ DB }, r, 't', 10, 100), true);
});
