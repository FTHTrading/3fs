// node tools/migrate.mjs [--remote] -> applies kit/schema-migrate-affiliates.sql to the shared D1 and adds pro_accounts.affiliate_code if missing.
import { execSync } from 'node:child_process';
const remote = process.argv.includes('--remote') ? '--remote' : '--local';
const run = sql => execSync(`npx wrangler d1 execute usda-3fs ${remote} --config hub/wrangler.toml --json --command "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
execSync(`npx wrangler d1 execute usda-3fs ${remote} --config hub/wrangler.toml --file kit/schema-migrate-affiliates.sql`, { stdio: 'inherit' });
const cols = JSON.parse(run('PRAGMA table_info(pro_accounts)'))[0].results.map(c => c.name);
if (!cols.includes('affiliate_code')) { run('ALTER TABLE pro_accounts ADD COLUMN affiliate_code TEXT'); console.log('added pro_accounts.affiliate_code'); } else console.log('pro_accounts.affiliate_code already present');
console.log(run('SELECT count(*) AS n FROM pro_accounts'));
