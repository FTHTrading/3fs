// 3FS kit: "Send to the team". A case is what the AI could not finish; a person on the team picks it up.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function caseId() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return 'C-' + [...b].map(x => B32[x % 32]).join('');
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, PHONE = /^\+?[1-9]\d{7,14}$/;

export async function createCase(env, { door, role, place, facts, matches, message, contact }) {
  const facts_json = JSON.stringify(facts || {}), matches_json = JSON.stringify(matches || []);
  if (facts_json.length > 8192 || matches_json.length > 16384) throw { status: 413, error: 'too_large' };
  message = String(message || '').slice(0, 2000);
  contact = String(contact || '').trim();
  if (contact && !EMAIL.test(contact) && !PHONE.test(contact.replace(/[\s().-]/g, ''))) throw { status: 400, error: 'bad_contact' };
  const id = caseId(), created = Date.now();
  await env.DB.prepare('INSERT INTO cases (id, door, role, place, facts_json, matches_json, message, contact, status, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, String(door || '').slice(0, 64), String(role || '').slice(0, 32), String(place || '').slice(0, 120), facts_json, matches_json, message, contact, 'new', created).run();
  return { id, created };
}

// Posts a Resend-compatible JSON message to NOTIFY_WEBHOOK when set. Never throws: the case is already stored.
export async function notify(env, row, fetchFn = fetch) {
  if (!env || !env.NOTIFY_WEBHOOK) return false;
  try {
    const body = { to: env.TEAM_INBOX || 'kevan@unykorn.org', from: env.NOTIFY_FROM || 'cases@3fs.app', subject: `3FS case ${row.id} · ${row.door || ''}`, text: `Case ${row.id}\nDoor: ${row.door || ''}\nRole: ${row.role || ''}\nPlace: ${row.place || ''}\nContact: ${row.contact || '(none)'}\n\n${row.message || ''}\n\nFacts: ${row.facts_json || JSON.stringify(row.facts || {})}` };
    const headers = { 'content-type': 'application/json' };
    if (env.NOTIFY_TOKEN) headers.authorization = 'Bearer ' + env.NOTIFY_TOKEN;
    const r = await fetchFn(env.NOTIFY_WEBHOOK, { method: 'POST', headers, body: JSON.stringify(body) });
    return r.ok;
  } catch { return false; }
}
