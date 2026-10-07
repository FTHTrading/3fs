import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { build } from '../../tools/build.mjs';
const PAGES = ['index', 'doors', 'how', 'pro', 'pro-claim', 'agents', 'affiliates', 'verify', 'about', 'terms', 'privacy', '404'];
const LEGAL = new Set(['terms', 'privacy', 'about']);
const text = html => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const DOORS = ['https://usda.3fs.app/?role=family', 'https://grants.3fs.app/?role=homeowner', 'https://grants.3fs.app/?role=family', 'https://grants.3fs.app/owed', 'https://grants.3fs.app/?role=business', '/pro'];
test('every hub page builds, stays short, carries the operator line and the nav', async () => {
  await build('hub');
  for (const p of PAGES) {
    const f = `hub/public/${p}.html`; assert.ok(fs.existsSync(f), f);
    const html = fs.readFileSync(f, 'utf8'), t = text(html);
    if (!LEGAL.has(p)) assert.ok(t.split(' ').length <= 420, `${p} has ${t.split(' ').length} words`);
    assert.ok(html.includes('UnyKorn LLC'), p + ' operator'); assert.ok(!html.includes('3545 Patterstone'), p + ' home address');
    for (const n of ['Home', 'Doors', 'How it works', 'Pro', 'Agents']) assert.ok(html.includes('>' + n + '<'), `${p} nav ${n}`);
  }
});
test('home routes the six needs to the right doors', () => {
  const html = fs.readFileSync('hub/public/index.html', 'utf8');
  for (const h of DOORS) assert.ok(html.includes(`href="${h}"`), h);
  assert.ok(html.includes('What do you need?'));
});
test('affiliate landing 404s on junk or unknown codes and stamps a known one', async () => {
  const { onRequest } = await import('../functions/a/[code].js'); const { fakeD1 } = await import('../../tests/kit/fake-d1.mjs');
  const ASSETS = { fetch: async u => new Response(fs.readFileSync('hub/public' + (new URL(u).pathname === '/' ? '/index.html' : new URL(u).pathname), 'utf8'), { headers: { 'content-type': 'text/html' } }) };
  const DB = fakeD1(); DB.tables.affiliates.push({ code: 'buck', name: 'Buck Vaughan', status: 'active' });
  assert.equal((await onRequest({ request: new Request('https://3fs.app/a/<script>'), env: { DB, ASSETS }, params: { code: '<script>' } })).status, 404);
  assert.equal((await onRequest({ request: new Request('https://3fs.app/a/ghost'), env: { DB, ASSETS }, params: { code: 'ghost' } })).status, 404);
  const r = await onRequest({ request: new Request('https://3fs.app/a/buck'), env: { DB, ASSETS }, params: { code: 'buck' } });
  assert.equal(r.status, 200); const html = await r.text(); assert.ok(html.includes('Sent by Buck Vaughan')); assert.ok(html.includes('<meta name="3fs-ref" content="buck">'));
});
test('every Stripe link on the hub is tagged for affiliate attribution', () => {
  for (const f of fs.readdirSync('hub/public').filter(f => f.endsWith('.html'))) {
    const html = fs.readFileSync('hub/public/' + f, 'utf8');
    for (const m of html.matchAll(/<a\b[^>]*buy\.stripe\.com[^>]*>/g)) assert.ok(/data-stripe=/.test(m[0]), `${f}: ${m[0].slice(0, 80)}`);
  }
});
test('home has the ask box wired to the routing guide', () => {
  const html = fs.readFileSync('hub/public/index.html', 'utf8');
  assert.ok(html.includes('id="ask-form"')); assert.ok(html.includes('id="ask-out"'));
});
test('the public key is published next to the signed registry', () => {
  assert.ok(fs.existsSync('hub/public/.well-known/3fs.pub.pem'));
});
test('affiliate landing keeps the security headers and uses a meta tag, not an inline script', async () => {
  const { onRequest } = await import('../functions/a/[code].js'); const { fakeD1 } = await import('../../tests/kit/fake-d1.mjs');
  const ASSETS = { fetch: async u => new Response(fs.readFileSync('hub/public' + (new URL(u).pathname === '/' ? '/index.html' : new URL(u).pathname), 'utf8'), { headers: { 'content-type': 'text/html', 'content-security-policy': "default-src 'self'", 'x-frame-options': 'SAMEORIGIN' } }) };
  const DB = fakeD1(); DB.tables.affiliates.push({ code: 'buck', name: 'Buck Vaughan', status: 'active' });
  const r = await onRequest({ request: new Request('https://3fs.app/a/buck'), env: { DB, ASSETS }, params: { code: 'buck' } });
  assert.equal(r.headers.get('content-security-policy'), "default-src 'self'"); assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN');
  const html = await r.text(); assert.ok(html.includes('<meta name="3fs-ref" content="buck">')); assert.ok(!/<script>try\{localStorage/.test(html));
});
