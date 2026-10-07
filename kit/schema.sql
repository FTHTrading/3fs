-- 3FS shared schema (D1). The hub owns Pro; every door binds the same database.
CREATE TABLE IF NOT EXISTS pro_accounts (
  session_id TEXT PRIMARY KEY, customer TEXT, subscription TEXT, email TEXT, status TEXT NOT NULL DEFAULT 'active',
  key_hash TEXT UNIQUE, created INTEGER NOT NULL, claimed INTEGER, affiliate_code TEXT
);
CREATE TABLE IF NOT EXISTS api_calls (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, kind TEXT NOT NULL, zip TEXT, ok INTEGER NOT NULL, tx TEXT);
CREATE TABLE IF NOT EXISTS hits (k TEXT PRIMARY KEY, n INTEGER NOT NULL, exp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY, door TEXT NOT NULL, role TEXT, place TEXT, facts_json TEXT, matches_json TEXT,
  message TEXT, contact TEXT, status TEXT NOT NULL DEFAULT 'new', created INTEGER NOT NULL, closed INTEGER, note TEXT
);
CREATE TABLE IF NOT EXISTS affiliates (code TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT, payout_flat_usd REAL NOT NULL DEFAULT 25, status TEXT NOT NULL DEFAULT 'active', created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS referrals (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, session_id TEXT UNIQUE NOT NULL, ts INTEGER NOT NULL, paid INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status, created);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(code, ts);
