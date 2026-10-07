-- Idempotent additions for the existing usda-3fs D1 (pro_accounts/api_calls/hits already exist).
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY, door TEXT NOT NULL, role TEXT, place TEXT, facts_json TEXT, matches_json TEXT,
  message TEXT, contact TEXT, status TEXT NOT NULL DEFAULT 'new', created INTEGER NOT NULL, closed INTEGER, note TEXT
);
CREATE TABLE IF NOT EXISTS affiliates (code TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT, payout_flat_usd REAL NOT NULL DEFAULT 25, status TEXT NOT NULL DEFAULT 'active', created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS referrals (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, session_id TEXT UNIQUE NOT NULL, ts INTEGER NOT NULL, paid INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status, created);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(code, ts);
-- ALTER TABLE pro_accounts ADD COLUMN affiliate_code TEXT;  -- run by tools/migrate.mjs only if the column is missing
