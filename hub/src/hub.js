// 3fs.app page logic. Small, no framework. Everything shown here is read live or from doors.json; nothing is faked.
import { layout, renderNetwork, refresh } from '/kit/network.js';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const getJson = async (u, opt) => { const r = await fetch(u, opt); if (!r.ok) throw new Error(r.status); return r.json(); };

async function home() {
  if (!$('#tiles')) return;
  try {
    const h = await getJson('/api/health');
    const usda = (h.doors || []).find(d => d.id === 'usda');
    $('#t-areas').textContent = usda && usda.health && usda.health.areas ? Number(usda.health.areas).toLocaleString('en-US') : '—';
    $('#t-doors').textContent = String((h.doors || []).filter(d => d.status === 'live').length);
    const sha = usda && usda.health && usda.health.source && usda.health.source.sha256; $('#t-sha').textContent = sha ? sha.slice(0, 16) + '…' : '—';
  } catch { ['#t-areas', '#t-doors', '#t-sha'].forEach(s => { $(s).textContent = '—'; }); }
}

async function doors() {
  const el = $('#net'); if (!el) return;
  const list = await getJson('/doors.json');
  const nodes = [{ id: 'hub', label: '3fs.app', hub: true }, ...list.map(d => ({ id: d.id, label: d.id + '.3fs.app', url: d.url, status: d.status, health: d.health }))];
  const model = layout(nodes, list.map(d => ['hub', d.id]), { w: 520, h: 420 });
  const draw = () => renderNetwork(el, model, { onSelect: n => { const c = document.getElementById('d-' + n.id); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
  draw();
  $('#door-list').innerHTML = list.map(d => `<article id="d-${esc(d.id)}" class="card" style="padding:12px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h3>${esc(d.name)} <span class="small muted mono">${esc(d.id)}.3fs.app</span></h3><span class="status ${esc(d.status)}" id="s-${esc(d.id)}">${d.status === 'soon' ? 'cycle ' + d.cycle : d.status}</span></div><p class="small" style="margin-top:6px;color:var(--ink2)">${esc(d.purpose)}</p>${d.status === 'live' ? `<p style="margin-top:8px"><a class="btn small" href="${esc(d.url)}">Open</a></p>` : ''}</article>`).join('');
  await refresh(el, model); draw();
  for (const n of model.nodes) { const s = document.getElementById('s-' + n.id); if (s && !n.hub && n.status !== 'soon') { s.className = 'status ' + n.status; s.textContent = n.status; } }
  setInterval(async () => { await refresh(el, model); draw(); }, 60000);
}

async function agents() {
  const t = $('#agents tbody'); if (!t) return;
  try {
    const j = await getJson('/api/agents.json');
    t.innerHTML = j.endpoints.map(e => `<tr><td>${esc(e.door)}</td><td class="mono small">${esc(e.endpoint)}</td><td>$${esc(e.price_usdc)}</td><td>${esc(e.network)}</td><td class="mono small">${e.mcp ? esc(e.mcp) : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No endpoints yet.</td></tr>';
  } catch { t.innerHTML = '<tr><td colspan="5" class="muted">Could not load the index.</td></tr>'; }
}

async function verify() {
  const ul = $('#origins'); if (!ul) return;
  try {
    const j = await getJson('/.well-known/3fs.json');
    ul.innerHTML = j.payload.origins.map(o => `<li class="mono">${esc(o)}</li>`).join('');
    $('#sig').textContent = `Issued ${j.payload.issued} · signed ${j.alg} · signature ${j.sig.slice(0, 12)}…`;
  } catch { ul.innerHTML = '<li class="muted">Could not load the list.</li>'; }
}

async function claim() {
  const box = $('#claim'); if (!box) return;
  const sid = new URLSearchParams(location.search).get('session_id');
  if (!sid) { box.innerHTML = '<p>Open this page from the link Stripe sent you after checkout.</p>'; return; }
  let tries = 0;
  const poll = async () => {
    try {
      const j = await getJson('/api/pro/claim?session_id=' + encodeURIComponent(sid));
      if (j.status === 'ready') { try { localStorage.setItem('3fs_pro_key', j.key); } catch {} box.innerHTML = `<p>Your 3FS Pro key. It will not be shown again.</p><p class="code" style="margin-top:10px;user-select:all">${esc(j.key)}</p><p class="small muted" style="margin-top:8px">Saved in this browser. Works on every 3FS door.</p>`; return; }
      if (j.status === 'claimed') { box.innerHTML = `<p>${esc(j.message)}</p>`; return; }
      box.innerHTML = `<p class="muted">${esc(j.message || 'Setting up…')}</p>`;
    } catch { box.innerHTML = '<p class="muted">Still checking…</p>'; }
    if (++tries < 15) setTimeout(poll, 6000); else box.innerHTML = '<p>We could not confirm the payment yet. Email <a href="mailto:kevan@unykorn.org">kevan@unykorn.org</a> with your receipt and we will set you up by hand.</p>';
  };
  poll();
}

function affiliates() {
  const f = $('#aff-form'); if (!f) return;
  f.addEventListener('submit', async e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(f).entries()); const out = $('#aff-out'); out.textContent = 'Sending…';
    try {
      const j = await getJson('/api/case', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ door: 'affiliates', role: 'affiliate', place: d.name, facts: { name: d.name }, message: d.message, contact: d.contact }) });
      out.textContent = 'Received. Your case number is ' + j.id + '. We reply by email with your code.'; f.reset();
    } catch { out.textContent = 'Could not send. Email kevan@unykorn.org instead.'; }
  });
}

async function proLink() {
  const a = $('#get-pro'); if (!a) return;
  try { const h = await getJson('/api/health'); if (h.pro_link && /^https:\/\/buy\.stripe\.com\//.test(h.pro_link)) { a.setAttribute('data-stripe', h.pro_link); a.href = h.pro_link; if (window.ThreeFS && window.ThreeFS.ref) window.ThreeFS.ref.apply(); } } catch { /* keep the default */ }
}
function ask() {
  const f = $('#ask-form'); if (!f) return;
  f.addEventListener('submit', async e => {
    e.preventDefault(); const q = new FormData(f).get('q'); const out = $('#ask-out'); out.textContent = 'One moment…';
    try {
      const j = await getJson('/api/guide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: q }] }) });
      out.innerHTML = esc(j.text).replace(/(https:\/\/[a-z0-9.-]+\.?3fs\.app[^\s]*)/gi, '<a href="$1">$1</a>');
    } catch { out.textContent = 'Could not reach the guide. Pick a door above.'; }
  });
}
home(); doors(); agents(); verify(); claim(); affiliates(); proLink(); ask();
