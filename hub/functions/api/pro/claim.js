// GET /api/pro/claim?session_id=cs_...  -> issues the 3FS Pro key once, right after checkout.
import { json, preflight, sha256hex, limited } from '../../_kit/core.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight();
  if (await limited(env, request, 'claim', 10, 60)) return json({ error: 'rate_limited' }, 429);
  const sid = new URL(request.url).searchParams.get('session_id') || '';
  if (!/^cs_(live|test)_[A-Za-z0-9]{10,200}$/.test(sid)) return json({ error: 'bad_session' }, 400);
  const row = await env.DB.prepare('SELECT email, status, key_hash FROM pro_accounts WHERE session_id = ?').bind(sid).first();
  if (!row) return json({ status: 'pending', message: 'Your payment went through. Your Pro key is being set up; this page checks again in a few seconds.' });
  if (row.key_hash) return json({ status: 'claimed', message: 'This Pro key was already shown once. Email kevan@unykorn.org to reissue it.' });
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const key = 'rh_' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  const upd = await env.DB.prepare('UPDATE pro_accounts SET key_hash = ?, claimed = ? WHERE session_id = ? AND key_hash IS NULL').bind(await sha256hex(key), Date.now(), sid).run();
  if (!upd.meta || upd.meta.changes !== 1) return json({ status: 'claimed', message: 'This Pro key was already shown once. Email kevan@unykorn.org to reissue it.' });
  return json({ status: 'ready', key, email: row.email });
}
