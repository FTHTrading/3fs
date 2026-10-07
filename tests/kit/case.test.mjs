import { test } from 'node:test'; import assert from 'node:assert/strict';
import { createCase, notify } from '../../kit/fn/case.js'; import { fakeD1 } from './fake-d1.mjs';
const base = { door: 'grants.3fs.app', role: 'family', place: 'Fannin County, GA', facts: { people: 4 }, matches: [], message: 'Need help with the forms', contact: 'a@b.co' };
test('createCase stores the case and returns a C- id', async () => {
  const DB = fakeD1(); const r = await createCase({ DB }, base);
  assert.match(r.id, /^C-[A-Z2-7]{8}$/); assert.ok(r.created > 0);
  const row = await DB.prepare('SELECT * FROM cases WHERE id = ?').bind(r.id).first();
  assert.equal(row.door, 'grants.3fs.app'); assert.equal(row.status, 'new'); assert.equal(JSON.parse(row.facts_json).people, 4);
});
test('createCase rejects oversize facts with 413', async () => {
  await assert.rejects(createCase({ DB: fakeD1() }, { ...base, facts: { blob: 'x'.repeat(10000) } }), e => e.status === 413);
});
test('createCase rejects a contact that is neither email nor phone with 400', async () => {
  await assert.rejects(createCase({ DB: fakeD1() }, { ...base, contact: 'not-an-email' }), e => e.status === 400);
  const ok = await createCase({ DB: fakeD1() }, { ...base, contact: '+17705551234' }); assert.ok(ok.id);
  const empty = await createCase({ DB: fakeD1() }, { ...base, contact: '' }); assert.ok(empty.id);
});
test('notify posts to NOTIFY_WEBHOOK and never throws', async () => {
  let sent = null; const fetchFn = async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return new Response('ok'); };
  await notify({ NOTIFY_WEBHOOK: 'https://hooks.example/x', TEAM_INBOX: 'team@unykorn.org' }, { id: 'C-ABCDEFGH', door: 'grants.3fs.app', message: 'hi' }, fetchFn);
  assert.equal(sent.url, 'https://hooks.example/x'); assert.equal(sent.body.to, 'team@unykorn.org'); assert.match(sent.body.subject, /C-ABCDEFGH/);
  await notify({}, { id: 'C-1' }, async () => { throw new Error('boom'); }); // no webhook, no throw
});
