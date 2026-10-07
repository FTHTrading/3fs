# 3FS hub launch checklist (cycle 1)

## Verified live (2026-10-07) — https://3fs-hub.pages.dev
- All 12 pages 200; HSTS, CSP, nosniff present; 404 page real
- /api/health: usda live, five doors "soon"; aggregate times out per door at 3 s
- /api/agents.json: usda endpoint indexed from usda's own /api/agents.json
- /api/pro/me 401 (no key, bad key); /api/pro/claim 400 on bad session
- /.well-known/3fs.json verifies (Ed25519), origins all *.3fs.app
- /a/<junk> and /a/<unknown> 404; guide routes without quoting numbers; 413 on 200 KB body
- Shared D1 migrated: cases, affiliates, referrals tables + pro_accounts.affiliate_code (0 Pro rows affected)
- Sandbox: https://sandbox.3fs-hub.pages.dev (shares the production D1 for now)
- usda.3fs.app: publishes /api/agents.json, captures ?ref=, links Verify

## Kevan: three steps to finish launch
1. **Stripe webhook for the hub.** Stripe dashboard → Developers → Webhooks → Add endpoint `https://3fs.app/api/stripe/webhook`, events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` (same as usda's). Copy the signing secret, then from `C:\Users\Kevan\workers\3fs`:
   `npx wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name 3fs-hub`
   Then on the Pro Payment Link set the success URL to `https://3fs.app/pro-claim?session_id={CHECKOUT_SESSION_ID}` (replacing usda's claim page) and rename the product to "3FS Pro".
2. **DNS cutover.** Cloudflare → Workers & Pages → 3fs-hub → Custom domains → add `3fs.app` (this removes it from the Gemini-built project). Then `node tools/live-check.mjs https://3fs.app`.
3. **First affiliates.** Insert rows (code, name, contact, payout) — e.g. `npx wrangler d1 execute usda-3fs --remote --config hub/wrangler.toml --command "INSERT INTO affiliates (code,name,contact,payout_flat_usd,status,created) VALUES ('buck','Buck Vaughan','buck@unykorn.org',25,'active',strftime('%s','now')*1000)"`. Their link is `https://3fs.app/a/buck`.

## Optional
- Separate sandbox D1 when grants ships (write-heavy)
- NOTIFY_WEBHOOK + NOTIFY_TOKEN secrets (Resend) so cases email the team; until then cases sit in D1 (`SELECT * FROM cases WHERE status='new'`)
- Register ERC-8004 agent identities per door and fill `agents.erc8004.ids` in hub/origins.json, re-sign (`ORIGINS_SIGNING_KEY=... node tools/sign-origins.mjs`)
