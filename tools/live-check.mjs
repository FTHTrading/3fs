// node tools/live-check.mjs https://3fs-hub.pages.dev   -> probes a deployed hub and prints PASS/FAIL per check
const base = (process.argv[2] || 'https://3fs.app').replace(/\/$/, '');
let fails = 0;
const ok = (name, cond, extra = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!cond) fails++; };
const get = (p, init) => fetch(base + p, { redirect: 'manual', ...init });
for (const p of ['/', '/doors', '/how', '/pro', '/agents', '/affiliates', '/verify', '/about', '/terms', '/privacy', '/pro-claim', '/doors.json', '/kit/kit.css', '/brand/3fs-mark.svg']) {
  const r = await get(p); ok('GET ' + p, r.status === 200, String(r.status));
}
const home = await get('/');
ok('HSTS', !!home.headers.get('strict-transport-security')); ok('CSP', (home.headers.get('content-security-policy') || '').includes("script-src 'self'"));
ok('nosniff', home.headers.get('x-content-type-options') === 'nosniff');
const h = await (await get('/api/health')).json(); ok('/api/health ok', h.ok === true && Array.isArray(h.doors), JSON.stringify(h.doors && h.doors.map(d => d.id + ':' + d.status)));
ok('usda door live', !!(h.doors || []).find(d => d.id === 'usda' && d.status === 'live'));
const a = await (await get('/api/agents.json')).json(); ok('/api/agents.json', Array.isArray(a.endpoints) && a.endpoints.length >= 1);
ok('/api/pro/me 401', (await get('/api/pro/me')).status === 401);
ok('/api/pro/me bad key 401', (await get('/api/pro/me', { headers: { authorization: 'Bearer rh_' + 'a'.repeat(48) } })).status === 401);
ok('/api/pro/claim bad 400', (await get('/api/pro/claim?session_id=x')).status === 400);
ok('webhook bad sig 400', (await get('/api/stripe/webhook', { method: 'POST', body: '{}', headers: { 'stripe-signature': 't=1,v1=abc' } })).status === 400);
ok('webhook GET 404/405', [404, 405].includes((await get('/api/stripe/webhook')).status));
const w = await (await get('/.well-known/3fs.json')).json(); ok('.well-known/3fs.json', w.alg === 'Ed25519' && w.payload.origins.every(o => /^https:\/\/([a-z0-9-]+\.)?3fs\.app$/.test(o)));
ok('/a/nonexistent 404', (await get('/a/nonexistent-code')).status === 404);
ok('/a/<junk> 404', (await get('/a/%3Cscript%3E')).status === 404);
ok('404 page', (await get('/no-such-page')).status === 404);
const g = await (await get('/api/guide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'we want to buy a house in the country' }] }) })).json();
ok('guide routes home without numbers', /usda\.3fs\.app/.test(g.text) && !/\$\s?\d/.test(g.text), (g.text || '').slice(0, 80));
const big = await get('/api/guide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'A'.repeat(200000) }] }) });
ok('guide 413 on huge body', big.status === 413, String(big.status));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
