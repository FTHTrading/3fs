// Minimal in-memory stand-in for the D1 binding used in tests. Supports the SQL shapes the kit uses.
export function fakeD1() {
  const tables = { hits: new Map(), pro_accounts: [], api_calls: [], cases: [], affiliates: [], referrals: [] };
  function stmt(sql) {
    let args = [];
    const s = sql.replace(/\s+/g, ' ').trim();
    const api = {
      bind(...a) { args = a; return api; },
      async run() {
        if (/^INSERT INTO hits/i.test(s)) { const [k, exp] = args; const cur = tables.hits.get(k); tables.hits.set(k, { n: (cur ? cur.n : 0) + 1, exp }); return { meta: { changes: 1 } }; }
        if (/^DELETE FROM hits/i.test(s)) { for (const [k, v] of tables.hits) if (v.exp < args[0]) tables.hits.delete(k); return { meta: { changes: 0 } }; }
        if (/^INSERT INTO api_calls/i.test(s)) { tables.api_calls.push(args); return { meta: { changes: 1 } }; }
        if (/^INSERT INTO cases/i.test(s)) { const [id, door, role, place, facts_json, matches_json, message, contact, status, created] = args; tables.cases.push({ id, door, role, place, facts_json, matches_json, message, contact, status, created }); return { meta: { changes: 1 } }; }
        if (/^INSERT OR IGNORE INTO pro_accounts/i.test(s)) { const [session_id, customer, subscription, email, status, created] = args; if (tables.pro_accounts.some(r => r.session_id === session_id)) return { meta: { changes: 0 } }; tables.pro_accounts.push({ session_id, customer, subscription, email, status, created, key_hash: null, affiliate_code: null }); return { meta: { changes: 1 } }; }
        if (/^UPDATE pro_accounts SET affiliate_code/i.test(s)) { const [code, sid] = args; const r = tables.pro_accounts.find(r => r.session_id === sid); if (r) r.affiliate_code = code; return { meta: { changes: r ? 1 : 0 } }; }
        if (/^UPDATE pro_accounts SET key_hash/i.test(s)) { const [hash, claimed, sid] = args; const r = tables.pro_accounts.find(r => r.session_id === sid && r.key_hash == null); if (r) { r.key_hash = hash; r.claimed = claimed; } return { meta: { changes: r ? 1 : 0 } }; }
        if (/^UPDATE pro_accounts SET status/i.test(s)) { const [status, sub] = args; let n = 0; for (const r of tables.pro_accounts) if (r.subscription === sub) { r.status = status; n++; } return { meta: { changes: n } }; }
        if (/^INSERT (OR IGNORE )?INTO referrals/i.test(s)) { const [code, session_id, ts] = args; if (tables.referrals.some(r => r.session_id === session_id)) return { meta: { changes: 0 } }; tables.referrals.push({ code, session_id, ts, paid: 0 }); return { meta: { changes: 1 } }; }
        if (/^INSERT INTO affiliates/i.test(s)) { const [code, name, contact, payout, status, created] = args; tables.affiliates.push({ code, name, contact, payout_flat_usd: payout, status, created }); return { meta: { changes: 1 } }; }
        throw new Error('fakeD1.run: unsupported SQL: ' + s);
      },
      async first() {
        if (/FROM pro_accounts WHERE key_hash = \?/i.test(s)) return tables.pro_accounts.find(r => r.key_hash === args[0]) || null;
        if (/FROM pro_accounts WHERE session_id = \?/i.test(s)) return tables.pro_accounts.find(r => r.session_id === args[0]) || null;
        if (/FROM affiliates WHERE code = \?/i.test(s)) return tables.affiliates.find(r => r.code === args[0]) || null;
        if (/FROM cases WHERE id = \?/i.test(s)) return tables.cases.find(r => r.id === args[0]) || null;
        if (/^SELECT 1/i.test(s)) return { 1: 1 };
        if (/count\(\*\)/i.test(s)) { const t = s.match(/FROM (\w+)/i)[1]; const v = tables[t]; return { n: v instanceof Map ? v.size : v.length }; }
        throw new Error('fakeD1.first: unsupported SQL: ' + s);
      },
      async all() {
        if (/FROM hits WHERE k IN/i.test(s)) return { results: args.filter(k => tables.hits.has(k)).map(k => ({ k, n: tables.hits.get(k).n })) };
        throw new Error('fakeD1.all: unsupported SQL: ' + s);
      }
    };
    return api;
  }
  return { prepare: stmt, async batch(stmts) { const out = []; for (const st of stmts) out.push(await st.run()); return out; }, tables };
}
