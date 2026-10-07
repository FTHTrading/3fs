import { test } from 'node:test'; import assert from 'node:assert/strict';
import { aggregate, agentsIndex } from '../functions/_aggregate.js';
const doors = [
  { id: 'a', url: 'https://a.3fs.app', status: 'live', health: 'https://a.3fs.app/api/health', agents_url: 'https://a.3fs.app/api/agents.json' },
  { id: 'b', url: 'https://b.3fs.app', status: 'live', health: 'https://b.3fs.app/api/health', agents_url: 'https://b.3fs.app/api/agents.json' },
  { id: 'c', url: 'https://c.3fs.app', status: 'soon' }
];
const ok = body => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
test('a door that never answers is unknown and the aggregate returns within the timeout', async () => {
  const calls = []; const fetchFn = (url, init) => { calls.push(url); if (url.startsWith('https://b')) return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))); return Promise.resolve(ok({ ok: true, areas: 2724 })); };
  const t0 = Date.now(); const r = await aggregate(doors, fetchFn, { timeoutMs: 300 });
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(r.doors.find(d => d.id === 'a').status, 'live'); assert.equal(r.doors.find(d => d.id === 'a').health.areas, 2724);
  assert.equal(r.doors.find(d => d.id === 'b').status, 'unknown'); assert.equal(r.doors.find(d => d.id === 'c').status, 'soon');
  assert.ok(!calls.some(u => u.startsWith('https://c')), 'soon doors are never fetched'); assert.ok(r.checked_at);
});
test('a door answering ok:false or 500 is down', async () => {
  const r = await aggregate(doors.slice(0, 2), async url => url.startsWith('https://a') ? ok({ ok: false }) : new Response('x', { status: 500 }), { timeoutMs: 300 });
  assert.equal(r.doors[0].status, 'down'); assert.equal(r.doors[1].status, 'down');
});
test('agentsIndex merges each live door\'s agents.json and skips failures', async () => {
  const fetchFn = async url => url.startsWith('https://a') ? ok([{ endpoint: 'https://a.3fs.app/api/check', price_usdc: '0.02', network: 'base', mcp: 'https://a.3fs.app/mcp' }]) : new Response('x', { status: 500 });
  const idx = await agentsIndex(doors, fetchFn, { timeoutMs: 300 });
  assert.equal(idx.length, 1); assert.equal(idx[0].door, 'a'); assert.equal(idx[0].price_usdc, '0.02');
});
