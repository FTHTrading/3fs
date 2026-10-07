// 3FS kit: the signed official-origins registry served at https://3fs.app/.well-known/3fs.json
// Ed25519 over canonical JSON. Only https://<name>.3fs.app or https://3fs.app may appear as an origin.
const ORIGIN = /^https:\/\/([a-z0-9-]+\.)?3fs\.app$/;

export function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
function pemToDer(pem) {
  const b64 = pem.replace(/-----(BEGIN|END)[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out;
}
const b64u = { enc: u8 => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), dec: s => { const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; } };

export function validOrigins(list) { return Array.isArray(list) && list.length > 0 && list.every(o => typeof o === 'string' && ORIGIN.test(o)); }

export async function signOrigins(payload, privPem) {
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(privPem), { name: 'Ed25519' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('Ed25519', key, new TextEncoder().encode(canonical(payload))));
  return { payload, alg: 'Ed25519', sig: b64u.enc(sig) };
}

export async function verifyOrigins(signed, pubPem) {
  try {
    if (!signed || signed.alg !== 'Ed25519' || !validOrigins(signed.payload && signed.payload.origins)) return false;
    const key = await crypto.subtle.importKey('spki', pemToDer(pubPem), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, b64u.dec(signed.sig), new TextEncoder().encode(canonical(signed.payload)));
  } catch { return false; }
}
