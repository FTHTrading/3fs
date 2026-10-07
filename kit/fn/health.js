// 3FS kit: the health shape every door reports at /api/health. Never includes secret values.
import { CDP_BASE, cdpJwt, correlation, keyKind, creds } from './cdp.js';

export async function healthShape(env, extra = {}, { deep = false } = {}) {
  let database = false;
  try { if (env.DB) { await env.DB.prepare('SELECT 1').first(); database = true; } } catch { database = false; }
  const c = creds(env);
  const cdp = { key_id_set: c.id.length > 0, key_format: keyKind(c.secret) };
  if (deep && cdp.key_id_set && (cdp.key_format === 'ed25519' || cdp.key_format === 'ec')) {
    try {
      const r = await fetch(CDP_BASE + '/supported', { headers: { authorization: 'Bearer ' + await cdpJwt(env, 'GET', '/platform/v2/x402/supported'), 'correlation-context': correlation() } });
      cdp.sign_in = r.status;
    } catch (e) { cdp.sign_in = 'error'; }
  }
  return {
    service: env.SITE ? new URL(env.SITE).host : 'unknown',
    ok: true,
    guide: !!env.AI,
    database,
    pro_billing: !!env.STRIPE_WEBHOOK_SECRET,
    x402: { network: env.X402_NETWORK || 'base-sepolia', price_usdc: env.X402_PRICE_USDC || '0.02', pay_to_set: /^0x[0-9a-fA-F]{40}$/.test(env.X402_PAY_TO || ''), cdp },
    checked_at: new Date().toISOString(),
    ...extra
  };
}
