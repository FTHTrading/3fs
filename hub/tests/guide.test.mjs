import { test } from 'node:test'; import assert from 'node:assert/strict';
import { detectNeed, routeAnswer, routeOnly } from '../functions/api/guide.js';
import { onRequest as caseFn } from '../functions/api/case.js';
import { fakeD1 } from '../../tests/kit/fake-d1.mjs';
test('detectNeed maps plain requests to the six doors', () => {
  assert.equal(detectNeed('we want to buy a house in the country'), 'home');
  assert.equal(detectNeed('college money for my daughter'), 'free');
  assert.equal(detectNeed('unclaimed property in my name'), 'owed');
  assert.equal(detectNeed('my roof is leaking and I cannot afford it'), 'fix');
  assert.equal(detectNeed('I need a loan for my restaurant'), 'business');
  assert.equal(detectNeed('I am a lender and want the API'), 'pro');
  assert.equal(detectNeed('hello'), null);
});
test('routeAnswer always ends with exactly one door link', () => {
  const a = routeAnswer('home'); assert.ok(a.includes('https://usda.3fs.app/')); assert.equal((a.match(/https?:\/\//g) || []).length, 1);
});
test('routeOnly replaces any answer that quotes a dollar figure', () => {
  assert.equal(routeOnly('The limit is $105,700 for your county.', 'home'), routeAnswer('home'));
  assert.equal(routeOnly('Start at Rural Home.', 'home'), 'Start at Rural Home.');
});
test('POST /api/case stores the case and returns an id', async () => {
  const DB = fakeD1();
  const r = await caseFn({ request: new Request('https://3fs.app/api/case', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '9.9.9.9' }, body: JSON.stringify({ door: 'affiliates', role: 'affiliate', place: 'Buck', facts: {}, message: 'hi', contact: 'b@u.org' }) }), env: { DB } });
  assert.equal(r.status, 200); const j = await r.json(); assert.match(j.id, /^C-/); assert.equal(DB.tables.cases.length, 1);
  const bad = await caseFn({ request: new Request('https://3fs.app/api/case', { method: 'POST', body: 'nope' }), env: { DB } }); assert.equal(bad.status, 400);
});
