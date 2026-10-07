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

// /a/<code> landing path -> code, or null
export function refFromPath(pathname) {
  const m = /^\/a\/([^/?#]+)$/.exec(pathname || ''); if (!m) return null;
  let c; try { c = decodeURIComponent(m[1]); } catch { return null; }
  return validCode(c) ? c.toLowerCase() : null;
}

// Carry the ref onto outgoing links to other 3FS doors so attribution survives moving between doors.
const DOOR_LINK = /^https:\/\/([a-z0-9-]+\.)?3fs\.app(\/|$)/i;
export function decorateLinks(anchors, store, origin) {
  const code = currentRef(store); if (!code) return 0; let n = 0;
  for (const a of anchors) {
    const href = a.href || ''; if (!DOOR_LINK.test(href) || href.startsWith(origin + '/') || href === origin) continue;
    if (/[?&]ref=/.test(href)) continue;
    a.href = href + (href.includes('?') ? '&' : '?') + 'ref=' + encodeURIComponent(code); n++;
  }
  return n;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const store = window.localStorage;
  try {
    captureRef(window.location.search, store);
    const meta = document.querySelector('meta[name="3fs-ref"]'); const fromMeta = meta && meta.getAttribute('content');
    const fromPath = refFromPath(window.location.pathname);
    const c = fromMeta && validCode(fromMeta) ? fromMeta : fromPath; if (c) captureRef('?ref=' + encodeURIComponent(c), store);
  } catch { /* ignore */ }
  const apply = () => {
    for (const a of document.querySelectorAll('a[data-stripe]')) a.href = decorate(a.getAttribute('data-stripe') || a.href, store);
    decorateLinks([...document.querySelectorAll('a[href^="https://"]')], store, window.location.origin);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
  window.ThreeFS = Object.assign(window.ThreeFS || {}, { ref: { validCode, captureRef, currentRef, decorate, decorateLinks, refFromPath, apply } });
}
