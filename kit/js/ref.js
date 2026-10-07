// 3FS kit: affiliate reference capture. Pure ESM so the Stripe webhook can import validCode() too.
// Browser: <script type="module" src="/kit/ref.js"></script> captures ?ref=CODE and decorates every
// a[data-stripe] link with client_reference_id. Payouts are flat and disclosed; this only records who sent whom.
export const STORE_KEY = '3fs_ref';
export const TTL_MS = 90 * 86400000;
const CODE = /^[a-z0-9-]{3,32}$/;

export function validCode(s) { return typeof s === 'string' && CODE.test(s.toLowerCase()); }

export function captureRef(search, store) {
  const code = new URLSearchParams(search || '').get('ref');
  if (!code || !validCode(code)) return null;
  const rec = { code: code.toLowerCase(), ts: Date.now() };
  try { store.setItem(STORE_KEY, JSON.stringify(rec)); } catch { /* storage blocked: still return it */ }
  return rec;
}

export function currentRef(store) {
  try {
    const raw = store.getItem(STORE_KEY); if (!raw) return null;
    const rec = JSON.parse(raw);
    if (!rec || !validCode(rec.code) || Date.now() - rec.ts > TTL_MS) return null;
    return rec.code;
  } catch { return null; }
}

export function decorate(url, store) {
  const code = currentRef(store); if (!code) return url;
  return url + (url.includes('?') ? '&' : '?') + 'client_reference_id=' + encodeURIComponent(code);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const store = window.localStorage;
  try { captureRef(window.location.search, store); } catch { /* ignore */ }
  const apply = () => { for (const a of document.querySelectorAll('a[data-stripe]')) a.href = decorate(a.getAttribute('data-stripe') || a.href, store); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
  window.ThreeFS = Object.assign(window.ThreeFS || {}, { ref: { validCode, captureRef, currentRef, decorate } });
}
