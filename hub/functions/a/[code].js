// GET /a/<code> -> affiliate landing page with their name on it; sets the ref and shows the front door.
import { validCode } from '../_kit/ref.js';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function onRequest({ request, env, params }) {
  const code = String(params.code || '').toLowerCase();
  if (!validCode(code)) return env.ASSETS.fetch(new URL('/404.html', request.url)).then(r => new Response(r.body, { status: 404, headers: r.headers }));
  const aff = env.DB ? await env.DB.prepare('SELECT code, name, status FROM affiliates WHERE code = ?').bind(code).first() : null;
  if (!aff || aff.status !== 'active') return env.ASSETS.fetch(new URL('/404.html', request.url)).then(r => new Response(r.body, { status: 404, headers: r.headers }));
  const page = await env.ASSETS.fetch(new URL('/', request.url));
  let html = await page.text();
  html = html.replace('<h1>Money and housing, handled.</h1>', `<p class="status live" style="margin-bottom:8px">Sent by ${esc(aff.name)}</p><h1>Money and housing, handled.</h1>`)
    .replace('</head>', `<meta name="3fs-ref" content="${esc(code)}"></head>`);
  const headers = new Headers(page.headers); headers.set('content-type', 'text/html; charset=utf-8'); headers.set('cache-control', 'no-store'); headers.delete('content-length');
  return new Response(html, { headers });
}
