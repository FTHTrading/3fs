// POST /api/case  {door, role, place, facts, matches, message, contact} -> {id}. "Send to the team."
import { json, preflight, limited, readJson } from '../_kit/core.js';
import { createCase, notify } from '../_kit/case.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (await limited(env, request, 'case', 5, 30)) return json({ error: 'rate_limited', message: 'Give it a minute and try again.' }, 429);
  try {
    const body = await readJson(request, 32 * 1024);
    const r = await createCase(env, body);
    await notify(env, { ...body, id: r.id, facts_json: JSON.stringify(body.facts || {}) });
    return json({ id: r.id, message: 'Received. A person on the team will reply.' });
  } catch (e) {
    return json({ error: e.error || 'case_failed' }, e.status || 500);
  }
}
