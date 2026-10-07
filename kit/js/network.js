// 3FS kit: the network diagram. Hub in the center, doors on a ring, live health dots.
// Pure layout() for tests; renderNetwork()/refresh() touch the DOM.
export const COLORS = { live: '#A30D22', soon: '#5F646C', down: '#D8DADF', unknown: '#D8DADF', hub: '#111214' };

export function layout(nodes, edges, { w, h }) {
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.36;
  const hub = nodes.find(n => n.hub) || nodes[0];
  const ring = nodes.filter(n => n !== hub);
  const placed = new Map();
  placed.set(hub.id, { ...hub, x: cx, y: cy });
  ring.forEach((n, i) => {
    const a = -Math.PI / 2 + (i / ring.length) * 2 * Math.PI;
    placed.set(n.id, { ...n, x: Math.round((cx + R * Math.cos(a)) * 100) / 100, y: Math.round((cy + R * Math.sin(a)) * 100) / 100 });
  });
  const out = nodes.map(n => placed.get(n.id));
  const es = edges.map(([a, b]) => ({ from: a, to: b, x1: placed.get(a).x, y1: placed.get(a).y, x2: placed.get(b).x, y2: placed.get(b).y }));
  return { nodes: out, edges: es, w, h };
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderNetwork(el, model, { onSelect } = {}) {
  const { w, h } = model;
  const edges = model.edges.map(e => `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="#D8DADF" stroke-width="1.5"/>`).join('');
  const nodes = model.nodes.map(n => {
    const r = n.hub ? 26 : 18, fill = n.hub ? COLORS.hub : (COLORS[n.status] || COLORS.unknown);
    const dot = n.hub ? '' : `<circle class="dot" cx="${n.x + r * 0.75}" cy="${n.y - r * 0.75}" r="5" fill="${fill}" stroke="#fff" stroke-width="2"/>`;
    return `<g class="node" data-id="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.label)}" style="cursor:pointer">
      <circle cx="${n.x}" cy="${n.y}" r="${r}" fill="#fff" stroke="${fill}" stroke-width="${n.hub ? 4 : 3}"/>
      ${n.hub ? `<text x="${n.x}" y="${n.y + 5}" text-anchor="middle" font-family="Inter,Arial" font-weight="800" font-size="13" fill="#111214">3fs</text>` : ''}
      ${dot}
      <text x="${n.x}" y="${n.y + r + 16}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="11" fill="#30343A">${esc(n.label)}</text>
    </g>`;
  }).join('');
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="3FS network">${edges}${nodes}</svg>`;
  if (onSelect) el.querySelectorAll('.node').forEach(g => {
    const n = model.nodes.find(x => x.id === g.dataset.id);
    g.addEventListener('click', () => onSelect(n)); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n); } });
  });
}

// Polls each node's health URL and recolors its ring/dot. status: live | down | unknown; 'soon' nodes are not polled.
export async function refresh(el, model, fetchFn = fetch, timeoutMs = 3000) {
  await Promise.all(model.nodes.map(async n => {
    if (n.hub || !n.health || n.status === 'soon') return;
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    try { const r = await fetchFn(n.health, { signal: ctl.signal }); const j = r.ok ? await r.json() : null; n.status = j && j.ok ? 'live' : 'down'; }
    catch { n.status = 'unknown'; } finally { clearTimeout(t); }
    const g = el.querySelector(`.node[data-id="${n.id}"]`); if (!g) return;
    const fill = COLORS[n.status] || COLORS.unknown;
    g.querySelector('circle').setAttribute('stroke', fill); const d = g.querySelector('.dot'); if (d) d.setAttribute('fill', fill);
  }));
  return model;
}

if (typeof window !== 'undefined') window.ThreeFS = Object.assign(window.ThreeFS || {}, { network: { layout, renderNetwork, refresh, COLORS } });
