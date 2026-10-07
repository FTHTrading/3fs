// 3FS kit: shared helpers for Pages Functions. Imported by every door as ../_kit/core.js
// Same signatures as usda.3fs.app functions/_lib.js, minus the data functions.

export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization, x-payment',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-expose-headers': 'x-payment-response'
};

export function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS, ...extra }
  });
}
export function preflight() { return new Response(null, { status: 204, headers: CORS }); }

export async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', typeof s === 'string' ? new TextEncoder().encode(s) : s);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Parse a JSON body with a hard size cap. Throws {status, error} for the caller to turn into json().
export async function readJson(request, maxBytes = 64 * 1024) {
  const len = +(request.headers.get('content-length') || 0);
  if (len > maxBytes) throw { status: 413, error: 'too_large' };
  const raw = await request.text();
  if (raw.length > maxBytes) throw { status: 413, error: 'too_large' };
  try { return JSON.parse(raw); } catch { throw { status: 400, error: 'bad_json' }; }
}

export async function ipHash(request, salt = '') {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  return (await sha256hex(ip + '|' + salt)).slice(0, 20);
}

// Pro key: Authorization: Bearer rh_<48 hex>. Only the SHA-256 of the key is stored.
export async function proFromAuth(request, env) {
  const h = request.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(rh_[a-f0-9]{48})$/i);
  if (!m || !env || !env.DB) return null;
  const hash = await sha256hex(m[1].toLowerCase());
  const row = await env.DB.prepare('SELECT session_id, email, status FROM pro_accounts WHERE key_hash = ?').bind(hash).first();
  return row && row.status === 'active' ? row : null;
}

export async function logCall(env, kind, ref, ok, tx) {
  try { await env.DB.prepare('INSERT INTO api_calls (ts, kind, zip, ok, tx) VALUES (?, ?, ?, ?, ?)').bind(Date.now(), kind, String(ref || ''), ok ? 1 : 0, tx || null).run(); } catch (e) { /* logging never blocks */ }
}

// Per-IP limiter backed by D1: at most perMin per minute and perDay per day for this bucket.
export async function limited(env, request, bucket, perMin, perDay) {
  if (!env || !env.DB) return false;
  const h = await ipHash(request, bucket);
  const now = Date.now(), minute = Math.floor(now / 60000), day = Math.floor(now / 86400000);
  const kM = h + ':m:' + minute, kD = h + ':d:' + day;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO hits (k, n, exp) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1').bind(kM, now + 120000),
    env.DB.prepare('INSERT INTO hits (k, n, exp) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1').bind(kD, now + 172800000)
  ]);
  const r = await env.DB.prepare('SELECT k, n FROM hits WHERE k IN (?, ?)').bind(kM, kD).all();
  const map = Object.fromEntries((r.results || []).map(x => [x.k, x.n]));
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM hits WHERE exp < ?').bind(now).run();
  return (map[kM] || 0) > perMin || (map[kD] || 0) > perDay;
}
