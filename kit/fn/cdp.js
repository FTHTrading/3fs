// Coinbase CDP facilitator auth (same JWT scheme as @coinbase/cdp-sdk generateJwt).
// Supports Ed25519 keys (base64, 64 bytes) and EC P-256 keys (PEM, SEC1 or PKCS8).
export const CDP_BASE = 'https://api.cdp.coinbase.com/platform/v2/x402';
const HOST = 'api.cdp.coinbase.com';

const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uStr = (s) => b64u(new TextEncoder().encode(s));
const fromB64 = (s) => Uint8Array.from(atob(s.replace(/\s+/g, '')), c => c.charCodeAt(0));

// Accepts the raw key, or the whole Coinbase key file pasted as JSON ({ id|name, privateKey }).
export function creds(env) {
  let id = (env.CDP_API_KEY_ID || '').trim(), secret = (env.CDP_API_KEY_SECRET || '').trim();
  if (secret.startsWith('{')) {
    try { const j = JSON.parse(secret); secret = (j.privateKey || j.private_key || '').trim(); if (!id) id = (j.id || j.name || '').trim(); } catch { /* leave as is */ }
  }
  if (id.startsWith('{')) { try { const j = JSON.parse(id); id = (j.id || j.name || '').trim(); if (!secret) secret = (j.privateKey || '').trim(); } catch { /* */ } }
  return { id, secret };
}

export function keyKind(secret) {
  const s = (secret || '').trim();
  if (!s) return 'missing';
  if (/BEGIN (EC )?PRIVATE KEY/.test(s)) return 'ec';
  try { return fromB64(s).length === 64 ? 'ed25519' : 'invalid'; } catch { return 'invalid'; }
}

function derLen(n) { return n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255]; }
function sec1ToPkcs8(sec1) {
  const algId = [0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07];
  const octet = [0x04, ...derLen(sec1.length), ...sec1];
  const body = [0x02, 0x01, 0x00, ...algId, ...octet];
  return new Uint8Array([0x30, ...derLen(body.length), ...body]);
}

async function importKey(secret) {
  const kind = keyKind(secret);
  if (kind === 'ed25519') {
    const raw = fromB64(secret.trim());
    const jwk = { kty: 'OKP', crv: 'Ed25519', d: b64u(raw.slice(0, 32)), x: b64u(raw.slice(32)) };
    return { alg: 'EdDSA', key: await crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['sign']), sign: { name: 'Ed25519' } };
  }
  if (kind === 'ec') {
    const pem = secret.replace(/\\n/g, '\n');
    const isSec1 = /BEGIN EC PRIVATE KEY/.test(pem);
    const der = fromB64(pem.replace(/-----[^-]+-----/g, ''));
    const pkcs8 = isSec1 ? sec1ToPkcs8(der) : der;
    return { alg: 'ES256', key: await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']), sign: { name: 'ECDSA', hash: 'SHA-256' } };
  }
  throw new Error('CDP key secret is not a base64 Ed25519 key or a PEM EC key');
}

export async function cdpJwt(env, method, path) {
  const c = creds(env), kid = c.id;
  if (!kid) throw new Error('CDP_API_KEY_ID is empty');
  const k = await importKey(c.secret);
  const now = Math.floor(Date.now() / 1000);
  const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  const header = { alg: k.alg, kid, typ: 'JWT', nonce };
  const claims = { sub: kid, iss: 'cdp', uris: [method + ' ' + HOST + path], iat: now, nbf: now, exp: now + 120 };
  const input = b64uStr(JSON.stringify(header)) + '.' + b64uStr(JSON.stringify(claims));
  const sig = new Uint8Array(await crypto.subtle.sign(k.sign, k.key, new TextEncoder().encode(input)));
  return input + '.' + b64u(sig);
}

export function correlation() {
  return 'sdk_version=1.29.0,sdk_language=typescript,source=x402,source_version=2.1.0';
}
