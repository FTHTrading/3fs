// 3FS kit: x402 v1 pay-per-call wrapper (USDC on Base via the Coinbase CDP facilitator) with Pro-key bypass.
// Ported from usda.3fs.app functions/api/check.js. Usage:
//   return paid(env, request, { resource: url.origin + url.pathname, description, kind: 'match' }, async () => result);
import { json, proFromAuth, logCall } from './core.js';
import { CDP_BASE, cdpJwt, correlation, keyKind, creds } from './cdp.js';

export const NETWORKS = {
  'base-sepolia': { asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', extra: { name: 'USDC', version: '2' } },
  'base': { asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', extra: { name: 'USD Coin', version: '2' } }
};

export function useCdp(env) {
  const c = creds(env), kind = keyKind(c.secret);
  return c.id.length > 0 && (kind === 'ed25519' || kind === 'ec') && env.X402_NETWORK === 'base';
}

export function requirements(env, resource, description) {
  const network = env.X402_NETWORK || 'base-sepolia';
  const net = NETWORKS[network];
  const payTo = (env.X402_PAY_TO || '').trim();
  if (!net || !/^0x[0-9a-fA-F]{40}$/.test(payTo)) return null;
  if (network === 'base' && !useCdp(env)) return null; // mainnet needs working Coinbase keys
  const price = Number(env.X402_PRICE_USDC || '0.02');
  return { scheme: 'exact', network, maxAmountRequired: String(Math.round(price * 1e6)), resource, description, mimeType: 'application/json', payTo, maxTimeoutSeconds: 60, asset: net.asset, extra: net.extra };
}

export async function facilitator(env, path, body) {
  const headers = { 'content-type': 'application/json' };
  let base;
  if (useCdp(env)) {
    base = CDP_BASE;
    headers.authorization = 'Bearer ' + await cdpJwt(env, 'POST', '/platform/v2/x402' + path);
    headers['correlation-context'] = correlation();
  } else {
    base = (env.X402_FACILITATOR_URL || 'https://x402.org/facilitator').replace(/\/$/, '');
    if (env.X402_FACILITATOR_BEARER) headers.authorization = 'Bearer ' + env.X402_FACILITATOR_BEARER;
  }
  const r = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { error: 'bad_facilitator_response', status: r.status }; }
}

// handler() returns the result object (or null for "not found"). ref is logged (e.g. a ZIP), never personal data.
export async function paid(env, request, { resource, description, kind, ref }, handler) {
  const pro = await proFromAuth(request, env);
  if (pro) {
    const r = await handler();
    await logCall(env, kind + '-pro', ref, !!r);
    return r ? json({ ...r, paid_by: 'pro_key' }) : json({ error: 'not_found' }, 404);
  }
  const reqs = requirements(env, resource, description);
  const pay = request.headers.get('x-payment');
  if (!reqs) return json({ error: 'payment_required', message: 'Use a 3FS Pro key (Authorization: Bearer rh_...). Pay-per-call for AI agents over x402 opens shortly.', pro: env.PRO_LINK }, 402);
  if (!pay) return json({ x402Version: 1, error: 'X-PAYMENT header is required', accepts: [reqs], pro_alternative: env.PRO_LINK }, 402);
  let payload;
  try { payload = JSON.parse(atob(pay)); } catch { return json({ x402Version: 1, error: 'invalid X-PAYMENT header', accepts: [reqs] }, 402); }
  const v = await facilitator(env, '/verify', { x402Version: payload.x402Version || 1, paymentPayload: payload, paymentRequirements: reqs });
  if (!v || v.isValid !== true) { await logCall(env, kind + '-x402', ref, false); return json({ x402Version: 1, error: v && (v.invalidReason || v.error) || 'payment_not_valid', accepts: [reqs] }, 402); }
  const result = await handler();
  if (!result) return json({ error: 'not_found' }, 404);
  const s = await facilitator(env, '/settle', { x402Version: payload.x402Version || 1, paymentPayload: payload, paymentRequirements: reqs });
  if (!s || s.success !== true) { await logCall(env, kind + '-x402', ref, false); return json({ x402Version: 1, error: s && (s.errorReason || s.error) || 'settlement_failed', accepts: [reqs] }, 402); }
  await logCall(env, kind + '-x402', ref, true, s.transaction);
  const receipt = btoa(JSON.stringify({ success: true, transaction: s.transaction, network: s.network || reqs.network, payer: s.payer || v.payer }));
  return json({ ...result, paid_by: 'x402', transaction: s.transaction }, 200, { 'x-payment-response': receipt });
}
