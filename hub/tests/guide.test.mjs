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
  assert.equal(routeOnly('Start at Rural Home: https://usda.3fs.app/?role=family', 'home'), 'Start at Rural Home: https://usda.3fs.app/?role=family');
});
test('POST /api/case stores the case and returns an id', async () => {
  const DB = fakeD1();
  const r = await caseFn({ request: new Request('https://3fs.app/api/case', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '9.9.9.9' }, body: JSON.stringify({ door: 'affiliates', role: 'affiliate', place: 'Buck', facts: {}, message: 'hi', contact: 'b@u.org' }) }), env: { DB } });
  assert.equal(r.status, 200); const j = await r.json(); assert.match(j.id, /^C-/); assert.equal(DB.tables.cases.length, 1);
  const bad = await caseFn({ request: new Request('https://3fs.app/api/case', { method: 'POST', body: 'nope' }), env: { DB } }); assert.equal(bad.status, 400);
});
test('routeOnly rejects spelled-out amounts, off-site links and answers without exactly one door link', () => {
  assert.equal(routeOnly('That is 105,700 dollars for your county. https://usda.3fs.app/?role=family', 'home'), routeAnswer('home'));
  assert.equal(routeOnly('About 105700 a year. https://usda.3fs.app/?role=family', 'home'), routeAnswer('home'));
  assert.equal(routeOnly('Visit https://3fs-grants.com to apply', 'free'), routeAnswer('free'));
  assert.equal(routeOnly('Rural Home handles that.', 'home'), routeAnswer('home'));
  assert.equal(routeOnly('Rural Home handles that start to finish. Open it here: https://usda.3fs.app/?role=family', 'home'), 'Rural Home handles that start to finish. Open it here: https://usda.3fs.app/?role=family');
});
test('detectNeed uses word boundaries and puts rent/eviction before home', () => {
  assert.equal(detectNeed('My landlord is evicting me and I need rent help'), 'free');
  assert.equal(detectNeed('I live in Maryland and want to buy a house'), 'home');
  assert.equal(detectNeed('someone said I have money owed to me'), 'owed');
});
