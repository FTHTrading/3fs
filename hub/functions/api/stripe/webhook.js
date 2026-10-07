// POST /api/stripe/webhook  (Stripe -> 3fs.app). Records 3FS Pro subscriptions and affiliate attribution.
// Needs the STRIPE_WEBHOOK_SECRET secret. Shared D1 with every door.
import { json } from '../../_kit/core.js';
import { validCode } from '../../_kit/ref.js';

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function safeEq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

export async function verifySignature(secret, header, raw) {
  const parts = Object.fromEntries((header || '').split(',').map(p => p.split('=')).filter(p => p.length === 2));
  const sigs = (header || '').split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  if (!parts.t || !sigs.length) return 'bad_signature';
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 600) return 'stale';
  const expected = await hmacHex(secret, parts.t + '.' + raw);
  return sigs.some(s => safeEq(s, expected)) ? null : 'bad_signature';
}

// Attribute a paid checkout to an active affiliate. Junk or unknown codes are ignored; Pro is never blocked by this.
export async function attribute(env, o) {
  const code = String(o.client_reference_id || '').toLowerCase();
  if (!validCode(code)) return false;
  const aff = await env.DB.prepare('SELECT code, status FROM affiliates WHERE code = ?').bind(code).first();
  if (!aff || aff.status !== 'active') return false;
  await env.DB.prepare('UPDATE pro_accounts SET affiliate_code = ? WHERE session_id = ?').bind(code, o.id).run();
  await env.DB.prepare('INSERT OR IGNORE INTO referrals (code, session_id, ts) VALUES (?, ?, ?)').bind(code, o.id, Date.now()).run();
  return true;
}

export async function handleEvent(env, ev) {
  const o = (ev.data && ev.data.object) || {};
  if (ev.type === 'checkout.session.completed' && (o.metadata || {}).plan === 'pro' && (o.payment_status === 'paid' || o.payment_status === 'no_payment_required')) {
    await env.DB.prepare('INSERT OR IGNORE INTO pro_accounts (session_id, customer, subscription, email, status, created) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(o.id, o.customer || null, o.subscription || null, (o.customer_details && o.customer_details.email) || null, 'active', Date.now()).run();
    try { await attribute(env, o); } catch { /* attribution never blocks activation */ }
    return 'activated';
  }
  if (ev.type === 'customer.subscription.updated' || ev.type === 'customer.subscription.deleted') {
    const active = ev.type === 'customer.subscription.updated' && (o.status === 'active' || o.status === 'trialing' || o.status === 'past_due');
    await env.DB.prepare('UPDATE pro_accounts SET status = ? WHERE subscription = ?').bind(active ? 'active' : 'inactive', o.id).run();
    return active ? 'active' : 'inactive';
  }
  return 'ignored';
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: 'webhook_not_configured' }, 503);
  const raw = await request.text();
  const bad = await verifySignature(env.STRIPE_WEBHOOK_SECRET, request.headers.get('stripe-signature'), raw);
  if (bad) return json({ error: bad }, 400);
  let ev; try { ev = JSON.parse(raw); } catch { return json({ error: 'bad_json' }, 400); }
  const result = await handleEvent(env, ev);
  return json({ received: true, result });
}
