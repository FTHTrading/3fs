import { test } from 'node:test'; import assert from 'node:assert/strict';
import { handleEvent } from '../functions/api/stripe/webhook.js';
import { onRequest as me } from '../functions/api/pro/me.js';
import { onRequest as claim } from '../functions/api/pro/claim.js';
import { fakeD1 } from '../../tests/kit/fake-d1.mjs';
import { sha256hex } from '../../kit/fn/core.js';
const ev = (over = {}) => ({ type: 'checkout.session.completed', data: { object: { id: 'cs_live_abc123456789', customer: 'cus_1', subscription: 'sub_1', payment_status: 'paid', metadata: { plan: 'pro' }, customer_details: { email: 'x@y.z' }, ...over } } });
function envWith(DB) { DB.tables.affiliates.push({ code: 'buck', name: 'Buck', status: 'active', payout_flat_usd: 25 }); return { DB }; }

test('paid checkout with an active affiliate code records the account and one referral', async () => {
  const DB = fakeD1(); await handleEvent(envWith(DB), ev({ client_reference_id: 'buck' }));
  assert.equal(DB.tables.pro_accounts.length, 1); assert.equal(DB.tables.pro_accounts[0].affiliate_code, 'buck'); assert.equal(DB.tables.referrals.length, 1);
});
test('paid checkout without a code records the account and no referral', async () => {
  const DB = fakeD1(); await handleEvent(envWith(DB), ev());
  assert.equal(DB.tables.pro_accounts.length, 1); assert.equal(DB.tables.pro_accounts[0].affiliate_code, null); assert.equal(DB.tables.referrals.length, 0);
});
test('an unknown or junk code still activates Pro and records no referral', async () => {
  const DB = fakeD1(); await handleEvent(envWith(DB), ev({ client_reference_id: 'ghost' }));
  await handleEvent(envWith(fakeD1()), ev({ client_reference_id: '<script>' }));
  assert.equal(DB.tables.pro_accounts.length, 1); assert.equal(DB.tables.referrals.length, 0);
});
test('an unpaid checkout inserts nothing', async () => {
  const DB = fakeD1(); await handleEvent(envWith(DB), ev({ payment_status: 'unpaid' })); assert.equal(DB.tables.pro_accounts.length, 0);
});
test('subscription.deleted deactivates and me() answers 401; existing usda-shaped rows still validate', async () => {
  const DB = fakeD1(); const key = 'rh_' + 'c'.repeat(48);
  DB.tables.pro_accounts.push({ session_id: 'cs_old', subscription: 'sub_old', status: 'active', key_hash: await sha256hex(key) }); // no affiliate_code column value
  const ok = await me({ request: new Request('https://3fs.app/api/pro/me', { headers: { authorization: 'Bearer ' + key } }), env: { DB } });
  assert.equal(ok.status, 200); assert.equal((await ok.json()).active, true);
  await handleEvent({ DB }, { type: 'customer.subscription.deleted', data: { object: { id: 'sub_old', status: 'canceled' } } });
  const no = await me({ request: new Request('https://3fs.app/api/pro/me', { headers: { authorization: 'Bearer ' + key } }), env: { DB } });
  assert.equal(no.status, 401);
});
test('claim issues the key once and reports claimed the second time', async () => {
  const DB = fakeD1(); await handleEvent({ DB }, ev());
  const r1 = await claim({ request: new Request('https://3fs.app/api/pro/claim?session_id=cs_live_abc123456789'), env: { DB } }); const b1 = await r1.json();
  assert.equal(b1.status, 'ready'); assert.match(b1.key, /^rh_[a-f0-9]{48}$/);
  const r2 = await claim({ request: new Request('https://3fs.app/api/pro/claim?session_id=cs_live_abc123456789'), env: { DB } });
  assert.equal((await r2.json()).status, 'claimed');
});
