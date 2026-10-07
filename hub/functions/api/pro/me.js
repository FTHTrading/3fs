// GET /api/pro/me  (Authorization: Bearer rh_...) -> is this 3FS Pro key active? Works for every door.
import { json, preflight, proFromAuth } from '../../_kit/core.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight();
  const pro = await proFromAuth(request, env);
  if (!pro) return json({ active: false }, 401);
  const e = pro.email || '';
  return json({ active: true, email: e ? e.replace(/^(.).*(@.*)$/, '$1…$2') : null, doors: 'all' });
}
