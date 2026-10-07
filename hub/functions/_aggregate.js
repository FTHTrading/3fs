// Hub: poll every door's /api/health and /api/agents.json with a per-door timeout. A slow door never stalls the hub.
async function fetchJson(fetchFn, url, timeoutMs) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try { const r = await fetchFn(url, { signal: ctl.signal, headers: { accept: 'application/json' } }); if (!r.ok) return { ok: false, status: r.status }; return { ok: true, body: await r.json() }; }
  catch { return { ok: false, aborted: true }; }
  finally { clearTimeout(t); }
}

export async function aggregate(doors, fetchFn = fetch, { timeoutMs = 3000 } = {}) {
  const out = await Promise.all(doors.map(async d => {
    if (d.status === 'soon' || !d.health) return { id: d.id, name: d.name, url: d.url, status: d.status || 'soon', cycle: d.cycle };
    const r = await fetchJson(fetchFn, d.health, timeoutMs);
    const status = r.aborted ? 'unknown' : (r.ok && r.body && r.body.ok === true ? 'live' : 'down');
    return { id: d.id, name: d.name, url: d.url, status, cycle: d.cycle, health: r.ok ? r.body : undefined };
  }));
  return { doors: out, checked_at: new Date().toISOString() };
}

export async function agentsIndex(doors, fetchFn = fetch, { timeoutMs = 3000 } = {}) {
  const lists = await Promise.all(doors.filter(d => d.status === 'live' && d.agents_url).map(async d => {
    const r = await fetchJson(fetchFn, d.agents_url, timeoutMs);
    return r.ok && Array.isArray(r.body) ? r.body.map(e => ({ door: d.id, ...e })) : [];
  }));
  return lists.flat();
}
