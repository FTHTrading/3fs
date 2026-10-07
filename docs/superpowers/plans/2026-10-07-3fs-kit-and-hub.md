# 3FS Kit + Hub (3fs.app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the shared 3FS kit and the rebuilt 3fs.app hub: a multi-page front door that routes people to the right door, shows the live network, sells 3FS Pro (one key for every door), indexes every x402 endpoint, runs affiliates, and publishes the official-origins registry.

**Architecture:** Monorepo `FTHTrading/3fs`. `kit/` is plain CSS/JS/HTML fragments plus Pages Functions helpers, copied into each door at build by `tools/build.mjs` (no bundler, no framework). `hub/` is a Cloudflare Pages project (`3fs-hub`) with static pages + Functions, bound to the **existing usda D1** (id `30da0ed0-b676-424e-86a4-4527ba4a01bd`) so every Pro key already issued keeps working and becomes the shared 3FS Pro key.

**Tech Stack:** Cloudflare Pages + Pages Functions, D1, Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`), Stripe Payment Links + webhook, x402 v1 via Coinbase CDP (`functions/_cdp.js` from usda), pdf-lib, d3 (globe only, not in hub), Node 20 `node --test`, wrangler 4.

**Spec:** `docs/superpowers/specs/2026-10-07-3fs-hub-kit-grants-design.md` (sections 0–3.2, 5, 6, 11)

## Global Constraints

- Brand tokens exactly: `--field:#A30D22; --volt:#6E0717; --ink:#111214; --ink2:#30343A; --muted:#5F646C; --bg:#F7F7F4; --line:#D8DADF`; fonts Inter (400/600/700/800) + IBM Plex Mono; light theme only; mark is `3fs-mark.svg` from usda (`public/brand/`).
- Tone: serious, plain words, no hype, no emojis, no slang. Every page ≤ ~250 words. Multi-page with nav, never one long scroller.
- Operator line everywhere: "3FS is a technology service by UnyKorn LLC. Not affiliated with USDA or any agency; not a lender or broker." Office: 5655 Peachtree Pkwy NW, Norcross, GA 30099. Contact kevan@unykorn.org. Never the home address.
- Pro: $49/month, Stripe link `https://buy.stripe.com/28E8wQbaf2iKg4V2em9AA0y` (UnyKorn LLC account), Manage billing `https://billing.stripe.com/p/login/14A9AU1zF2iK8Ct06e9AA00`. Keys `rh_` + 48 hex, SHA-256 hash stored, shown once.
- Agents: $0.02 per call, USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), pay-to `0xFCc1D28Ad797d65CDDb2A7219c5BE6B062653cb3`, x402 v1 `accepts[]` shape identical to usda `/api/check`.
- Affiliates: flat disclosed USD payout per paid Pro signup; never a percentage, never hidden.
- Security baseline on every door: `_headers` with HSTS, CSP (`script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://static.cloudflareinsights.com`, SRI on CDN scripts), nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy, X-Frame-Options SAMEORIGIN; D1 hashed-IP rate limits; 64 KB body caps.
- No data about a person is logged beyond what a function needs (api_calls: ts, kind, zip/door, ok).
- Commits end with the two attribution lines given in this session.

## Review Focus

1. A Pro key issued by usda before this ships must still return 200 on usda `/api/check` and `active:true` on hub `/api/pro/me` — Task 10 tests the shared-D1 path with the existing schema.
2. `?ref=CODE` with junk (`<script>`, 300 chars, unicode) must never render into a page or reach Stripe unsanitized — Task 7 tests the code validator (`^[a-z0-9-]{3,32}$`).
3. A door that is down or slow must not stall the hub: `/api/health` aggregate and `/api/agents.json` time out per door at 3 s and mark it `unknown` — Task 9 tests the timeout path.
4. Stripe webhook events without `client_reference_id`, or with a code that is not an active affiliate, must still activate Pro and store no referral — Task 10 tests both.
5. `/.well-known/3fs.json` must list only `*.3fs.app` origins and verify against the published public key — Task 11 tests signature verify with a wrong key fails.

---

## File structure

```
3fs/
  package.json                  scripts: test, check, build:<door>, deploy:<door>, sandbox:<door>
  tools/build.mjs               copy kit → door (public/kit, functions/_kit), inline header/footer fragments
  tools/sandbox.mjs             deploy --branch sandbox with sandbox vars
  tools/live-check.mjs          live probes for a door (pages 200, headers, 402 shape, webhook 400)
  kit/
    tokens.css  kit.css         design tokens + components
    brand/                      3fs-mark.svg, 3fs-mark-white.svg, 3fs-mark-512.png, favicon.svg, favicon.ico, icon-192/512.png, apple-touch-icon.png
    fragments/header.html footer.html head.html   placeholders {{DOOR}}, {{TITLE}}, {{DESC}}, {{URL}}, {{NAV}}
    js/ref.js                   affiliate capture + Stripe link decoration
    js/network.js               network diagram (SVG) with live health dots
    js/guide-client.js          chat UI + tool loop (copied from usda app.js guide section, generalized)
    fn/core.js                  json, preflight, CORS, sha256hex, limited, proFromAuth, logCall
    fn/x402.js                  requirements(), facilitator verify/settle, paid() wrapper
    fn/cdp.js                   = usda functions/_cdp.js
    fn/guard.js                 seen(), unsupported(), money()
    fn/case.js                  createCase(), notify()
    fn/health.js                healthShape()
    _headers                    security baseline
    schema.sql                  pro_accounts (+affiliate_code), api_calls, hits, cases, affiliates, referrals
  hub/
    wrangler.toml               project 3fs-hub, D1 binding DB (shared), AI binding, vars
    src/pages/*.html            index, doors, how, pro, pro-claim, agents, affiliates, a, verify, about, terms, privacy, 404 (fragments not yet inlined)
    public/                     build output (committed? no — built in CI/deploy; .gitignore public/kit)
    functions/api/health.js  pro/claim.js  pro/me.js  stripe/webhook.js  case.js  guide.js  agents.js
    functions/.well-known/3fs.json.js
    functions/a/[code].js       affiliate landing page
    tests/*.test.mjs
  tests/kit/*.test.mjs
  .github/workflows/ci.yml
```

---

### Task 1: Monorepo scaffold and build tool

**Files:**
- Create: `package.json`, `.gitignore`, `.github/workflows/ci.yml`, `tools/build.mjs`, `kit/fragments/head.html`, `kit/fragments/header.html`, `kit/fragments/footer.html`, `hub/src/pages/index.html` (placeholder), `tests/kit/build.test.mjs`

**Interfaces:**
- Produces: `node tools/build.mjs <door>` → copies `kit/*.css`, `kit/brand/`, `kit/js/`, `kit/_headers` into `<door>/public/kit/` (brand to `<door>/public/brand/`, `_headers` to `<door>/public/_headers`), copies `kit/fn/*.js` into `<door>/functions/_kit/`, and renders every `<door>/src/pages/*.html` into `<door>/public/*.html` replacing `{{HEAD}}`, `{{HEADER}}`, `{{FOOTER}}` with the fragments and `{{DOOR}}`, `{{TITLE}}`, `{{DESC}}`, `{{URL}}` from a per-page front-matter comment `<!-- meta: {"title":"…","desc":"…","path":"/"} -->` plus `<door>/door.json` (`{"door":"3fs.app","name":"3FS","url":"https://3fs.app"}`).

- [ ] **Step 1: Write the failing test**

```js
// tests/kit/build.test.mjs
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { build } from '../../tools/build.mjs'; import fs from 'node:fs';
test('build renders a page with fragments and copies kit', async () => {
  const out = await build('hub', { dry: false });
  const html = fs.readFileSync('hub/public/index.html', 'utf8');
  assert.match(html, /<title>3FS/); assert.match(html, /class="site-header"/); assert.match(html, /UnyKorn LLC/);
  assert.ok(fs.existsSync('hub/public/kit/kit.css')); assert.ok(fs.existsSync('hub/functions/_kit/core.js'));
  assert.ok(fs.existsSync('hub/public/_headers')); assert.ok(out.pages.includes('index.html'));
});
```

- [ ] **Step 2: Run test to verify it fails** — `npm test` → FAIL "Cannot find module tools/build.mjs"
- [ ] **Step 3: Implement `export async function build(door: string, opts?: {dry?: boolean}): Promise<{pages: string[], copied: number}>` in `tools/build.mjs`** (ESM, `fs/promises`, no deps). Head fragment carries charset/viewport/fonts link/canonical/OG/`<link rel=stylesheet href=/kit/tokens.css>` + `/kit/kit.css`; header fragment has mark + `{{DOOR}}` + nav links; footer has operator line + Terms/Privacy/About + "Verify this site" link.
- [ ] **Step 4: Run test to verify it passes** — `npm test` → PASS
- [ ] **Step 5: Add `package.json`** scripts: `"test":"node --test tests/**/*.test.mjs hub/tests/*.test.mjs"`, `"check":"node --check tools/build.mjs && for f in kit/fn/*.js hub/functions/**/*.js; do node --check $f || exit 1; done"`, `"build:hub":"node tools/build.mjs hub"`, `"deploy:hub":"npm run build:hub && wrangler pages deploy hub/public --project-name 3fs-hub --commit-dirty=true"`; `.gitignore`: `node_modules/ .wrangler/ */public/kit/ */functions/_kit/ */public/*.html` (generated), `*.tgz`; CI workflow: node 20, `npm ci`, `npm run check`, `npm test`.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(kit): monorepo scaffold and build tool"`

### Task 2: Kit design tokens, components and brand

**Files:**
- Create: `kit/tokens.css`, `kit/kit.css`, `kit/brand/*` (copy from `C:\Users\Kevan\workers\usda-3fs\public\brand\` and `public/favicon.*`, `icon-*.png`, `apple-touch-icon.png`), `kit/_headers`
- Test: `tests/kit/css.test.mjs`

**Interfaces:**
- Produces CSS classes used by every door: `.site-header .brand .mark .nav`, `.glass` (card), `.hero`, `.grid2 .grid3`, `.btn .btn-primary .btn-soft`, `.chip`, `.kv` (key/value table), `.verdict .ok .no .maybe`, `.status .live .down .soon`, `.tile` (proof number), `.legal` (long-form pages), `.small .muted .num`.

- [ ] **Step 1: Write the failing test** — `css.test.mjs`: reads `kit/tokens.css`, asserts it contains each hex from Global Constraints and `font-family: Inter`; reads `kit/kit.css`, asserts every class name in the Interfaces list appears; asserts `kit/_headers` contains `Strict-Transport-Security` and `Content-Security-Policy`.
- [ ] **Step 2: Run** → FAIL (files missing)
- [ ] **Step 3: Write `tokens.css` and `kit.css`** by extracting the shared rules from usda `public/index.html` `<style>` and `public/legal.css` (glass cards: white 75% + 1px white border + `0 14px 34px -12px rgba(26,50,84,.24)` shadow, radius 10–14px; dark band `#111214` for footer). Copy usda `public/_headers` `/*` block as `kit/_headers`.
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat(kit): tokens, components, brand, security headers`

### Task 3: Kit Functions core (`core.js`)

**Files:**
- Create: `kit/fn/core.js`; Test: `tests/kit/core.test.mjs`

**Interfaces:**
- Produces (same signatures as usda `_lib.js`): `json(obj, status=200, extra={})`, `preflight()`, `sha256hex(s)`, `limited(env, request, bucket, perMin, perDay)`, `proFromAuth(request, env)` → `{session_id,email,status}|null`, `logCall(env, kind, ref, ok, tx)`, `readJson(request, maxBytes=65536)` → parsed body or throws `{status:413|400}`, `ipHash(request)`.

- [ ] **Step 1: Failing tests**: `json()` sets `content-type`, `cache-control: no-store`, `access-control-allow-origin: *`; `readJson` rejects a 70 000-byte body with status 413 and bad JSON with 400; `proFromAuth` returns null for `Bearer rh_` + 47 chars and for `rh_' OR 1=1` (regex gate, no DB call — pass `env={}`); `limited` with a fake `env.DB` (in-memory map implementing `prepare().bind().run()/.first()/.all()`, `batch()`) returns false for call 1–10 and true for call 11 at perMin 10.
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** by porting usda `_lib.js` helpers verbatim minus data functions; add `readJson` and `ipHash`.
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat(kit): functions core helpers`

### Task 4: Kit x402 + CDP + health shape

**Files:**
- Create: `kit/fn/x402.js`, `kit/fn/cdp.js` (copy of usda `functions/_cdp.js`), `kit/fn/health.js`; Test: `tests/kit/x402.test.mjs`

**Interfaces:**
- `requirements(env, resourceUrl, description)` → x402 v1 accepts object or `null` when `X402_NETWORK==='base'` and CDP creds missing (usda rule).
- `paid(env, request, {resource, description, kind}, handler)` → runs the usda check.js flow: Pro key → handler; else no `X-PAYMENT` → 402 JSON `{x402Version:1,error,accepts:[…],pro_alternative}`; else verify → handler → settle → 200 with `x-payment-response`.
- `healthShape(env, extra)` → `{service, ok, database, pro_billing, x402:{network, price_usdc, pay_to_set}, ...extra}`.

- [ ] **Step 1: Failing tests**: `requirements({X402_NETWORK:'base',X402_PRICE_USDC:'0.02',X402_PAY_TO:'0xFCc1…', CDP_API_KEY_ID:'x', CDP_API_KEY_SECRET:'y'}, 'https://3fs.app/api/x', 'd')` returns `maxAmountRequired:'20000'`, `asset` = USDC Base address, `payTo` as given, `scheme:'exact'`, `network:'base'`; returns `null` without CDP vars; `paid()` with a request lacking `X-PAYMENT` and no auth returns status 402 and body has `accepts.length===1` and `pro_alternative`.
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** by extracting from usda `functions/api/check.js` + `_cdp.js`.
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat(kit): x402 paid() wrapper, CDP auth, health shape`

### Task 5: Kit guide guard

**Files:**
- Create: `kit/fn/guard.js`; Test: `tests/kit/guard.test.mjs`

**Interfaces:**
- `money(n)`; `seen(msgs: {role,content}[])` → `{amounts:Set<number>, pages:Set<number>}` (pages excluded from the last message unless it starts with `Results from the 3FS agents`); `unsupported(text, facts|null, prior)` where `facts = {allowed:Set<number>, page:number|null}`; `extractFigures(text)` → `{amounts:number[], pages:number[]}`.

- [ ] **Step 1: Failing tests** (values from the usda incident): text "limit is $105,700 (page 9)" with facts `{allowed:new Set([61600,122800]), page:71}` → true; text "$61,600 on page 71" → false; "$480 per child" alone → false; text "$1,000,000" with prior amounts containing 1000000 → false; no facts and "$52,000" → true.
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** by extracting from usda `functions/api/guide.js` (`AMT`, `PAGE`, `seen`, `unsupported`).
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat(kit): grounded-guide number guard`

### Task 6: Kit cases (Send to the team)

**Files:**
- Create: `kit/fn/case.js`, add `cases` table to `kit/schema.sql`; Test: `tests/kit/case.test.mjs`

**Interfaces:**
- `createCase(env, {door, role, place, facts, matches, message, contact})` → `{id: 'C-' + 8 base32 chars, created}`; inserts into `cases(id, door, role, place, facts_json, matches_json, message, contact, status='new', created)`; `facts_json` ≤ 8 KB, `message` ≤ 2 000 chars, `contact` validated as email or E.164 phone or empty.
- `notify(env, caseRow)` → POSTs to `env.NOTIFY_WEBHOOK` if set (Resend-compatible JSON `{to: env.TEAM_INBOX || 'kevan@unykorn.org', subject, text}`); never throws.

- [ ] **Step 1: Failing tests**: id format `/^C-[A-Z2-7]{8}$/`; a 10 KB facts object is rejected with `{status:413}`; `contact:'not-an-email'` rejected with 400; valid insert visible via the fake DB `.first()`.
- [ ] **Step 2: Run** → FAIL — **Step 3: Implement** — **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat(kit): cases table and Send-to-the-team helper`

### Task 7: Kit affiliate capture (`ref.js`) and schema

**Files:**
- Create: `kit/js/ref.js`, add `affiliates`, `referrals` tables and `pro_accounts.affiliate_code TEXT` to `kit/schema.sql`, `kit/schema-migrate-affiliates.sql` (ALTER + CREATE for the existing usda D1); Test: `tests/kit/ref.test.mjs`

**Interfaces:**
- `ref.js` (browser, also importable in Node for tests): `validCode(s)` → boolean (`/^[a-z0-9-]{3,32}$/` after lowercase); `captureRef(search, store)` stores `{code, ts}` under `3fs_ref` when valid, 90-day expiry; `decorate(url, store)` → Stripe link with `?client_reference_id=<code>` (appended to existing query) or unchanged.
- Schema: `affiliates(code PK, name, contact, payout_flat_usd REAL, status, created)`, `referrals(id PK AUTOINCREMENT, code, session_id UNIQUE, ts, paid INTEGER DEFAULT 0)`.

- [ ] **Step 1: Failing tests**: `validCode('<script>')` false; 300-char string false; `'Buck-2026'` true (lowercased); `captureRef('?ref=buck', store)` sets it; `decorate('https://buy.stripe.com/x', store)` → `…/x?client_reference_id=buck`; expired entry (ts 91 days ago) → undecorated.
- [ ] **Step 2: Run** → FAIL — **Step 3: Implement** (store is an object with `getItem/setItem`, localStorage in browser) — **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat(kit): affiliate ref capture and schema`

### Task 8: Kit network diagram component

**Files:**
- Create: `kit/js/network.js`; Test: `tests/kit/network.test.mjs`

**Interfaces:**
- `layout(nodes: {id,label,url,status}[], edges: [from,to][], {w,h})` → `{nodes: [{...node,x,y}], edges: [{x1,y1,x2,y2}]}` deterministic (hub centered, doors on a ring by index).
- `renderNetwork(el, model, {onSelect})` → draws SVG: node circle (fill `#A30D22` live, `#5F646C` soon, `#D8DADF` down/unknown), label, status dot, click → `onSelect(node)`; `window.ThreeFS.network = {layout, renderNetwork, refresh(el, healthUrls)}` where `refresh` polls each node's `/api/health` and updates status (`live|down|unknown`).

- [ ] **Step 1: Failing test**: `layout` of 1 hub + 6 doors returns hub at `(w/2,h/2)`, all door radii equal within 1px, edges.length 6; same input twice → deep-equal output.
- [ ] **Step 2: Run** → FAIL — **Step 3: Implement** — **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat(kit): network diagram component`

### Task 9: Hub health and agents aggregators

**Files:**
- Create: `hub/door.json`, `hub/wrangler.toml`, `hub/doors.json` (registry of doors: `{id,name,url,purpose,status:'live'|'soon',cycle,agents_url}` for usda, grants, lending, file, give, fund), `hub/functions/api/health.js`, `hub/functions/api/agents.js`; Test: `hub/tests/aggregate.test.mjs`

**Interfaces:**
- `aggregate(doors, fetchFn, {timeoutMs:3000})` (exported from `hub/functions/_aggregate.js`) → `{doors:[{id,status:'live'|'down'|'unknown'|'soon', health}], checked_at}`; `agentsIndex(doors, fetchFn)` → merged `[{door, endpoint, price_usdc, network, mcp}]` from each live door's `/api/agents.json`, usda entry hard-coded until usda publishes one.
- `/api/health` → `healthShape` + `aggregate` result; `/api/agents.json` → index.

- [ ] **Step 1: Failing tests**: a fetchFn that never resolves for door B → B `unknown` and the call returns within 3 500 ms; door with `ok:true` → `live`; status `soon` doors are never fetched.
- [ ] **Step 2: Run** → FAIL — **Step 3: Implement** with `Promise.race` + `AbortController` — **Step 4: Run** → PASS
- [ ] **Step 5: `wrangler.toml`**: `name="3fs-hub"`, `pages_build_output_dir="./public"`, `[[d1_databases]] binding="DB" database_name="usda-3fs" database_id="30da0ed0-b676-424e-86a4-4527ba4a01bd"`, `[ai] binding="AI"`, vars `SITE="https://3fs.app"`, `PRO_LINK`, `BILLING_LINK`, `TEAM_INBOX="kevan@unykorn.org"`, `X402_*` as usda.
- [ ] **Step 6: Commit** — `feat(hub): door registry, health and agents aggregators`

### Task 10: Hub shared Pro + Stripe webhook with affiliate attribution

**Files:**
- Create: `hub/functions/api/pro/claim.js`, `hub/functions/api/pro/me.js`, `hub/functions/api/stripe/webhook.js`; Test: `hub/tests/webhook.test.mjs`

**Interfaces:**
- `claim.js`, `me.js`: copies of usda's (with the `changes===1` fix), importing from `../../_kit/core.js`.
- `webhook.js`: usda's verified flow (HMAC, 600 s tolerance, `payment_status` paid|no_payment_required) plus: `attribute(env, session)` → if `session.client_reference_id` passes `validCode` and `affiliates.status='active'`, set `pro_accounts.affiliate_code` and insert `referrals(code, session_id, ts)`; otherwise no-op. Export `handleEvent(env, ev)` for tests (signature check stays in `onRequestPost`).

- [ ] **Step 1: Failing tests** with fake DB: `checkout.session.completed` + `metadata.plan='pro'` + `payment_status='paid'` + `client_reference_id='buck'` with active affiliate → account inserted with `affiliate_code='buck'` and 1 referral; same without `client_reference_id` → account inserted, 0 referrals; code `'ghost'` (not in affiliates) → account inserted, 0 referrals; `payment_status='unpaid'` → nothing inserted; existing usda-shaped row (no `affiliate_code`) read by `me.js` path returns `active:true`.
- [ ] **Step 2: Run** → FAIL — **Step 3: Implement** — **Step 4: Run** → PASS
- [ ] **Step 5: Apply migration** to the shared D1: `npx wrangler d1 execute usda-3fs --remote --file kit/schema-migrate-affiliates.sql` (idempotent: `CREATE TABLE IF NOT EXISTS`, ALTER guarded by `PRAGMA table_info` check in `tools/migrate.mjs`). Verify: `SELECT count(*) FROM pro_accounts` unchanged before/after.
- [ ] **Step 6: Commit** — `feat(hub): shared Pro endpoints and webhook with affiliate attribution`

### Task 11: Hub official-origins registry and verify page

**Files:**
- Create: `hub/functions/.well-known/3fs.json.js`, `tools/sign-origins.mjs`, `hub/origins.json`; Test: `hub/tests/origins.test.mjs`

**Interfaces:**
- `hub/origins.json`: `{issued, origins:["https://3fs.app","https://usda.3fs.app","https://grants.3fs.app", …], agents:{erc8004:{chain:"base", registry:"", ids:{}}}}` (agent ids filled when registered; empty allowed).
- `tools/sign-origins.mjs`: Ed25519 (`node:crypto`) signs canonical JSON → writes `hub/origins.signed.json` `{payload, sig, pub}`; private key read from env `ORIGINS_SIGNING_KEY` (PEM), public key committed in `hub/origins.pub.pem`.
- `/.well-known/3fs.json` serves `origins.signed.json` with `cache-control: public, max-age=3600`.
- `verifyOrigins(signed, pubPem)` (exported from `kit/fn/origins.js`) → boolean; every origin must match `/^https:\/\/([a-z0-9-]+\.)?3fs\.app$/`.

- [ ] **Step 1: Failing tests**: sign with a test key → verify true; verify with another key → false; a payload containing `https://3fs-app.com` → `verifyOrigins` false even with a valid signature.
- [ ] **Step 2: Run** → FAIL — **Step 3: Implement** — **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat(hub): signed official-origins registry`

### Task 12: Hub pages

**Files:**
- Create: `hub/src/pages/index.html, doors.html, how.html, pro.html, pro-claim.html, agents.html, affiliates.html, verify.html, about.html, terms.html, privacy.html, 404.html`, `hub/src/hub.js`, `hub/public/_redirects` (`/pro/claim /pro-claim.html 200`), `hub/functions/a/[code].js`; Test: `hub/tests/pages.test.mjs`

**Interfaces:**
- Home: h1 "Money and housing, handled." + the question "What do you need?" with six buttons routing: Buy or build a home → `https://usda.3fs.app/?role=family`; Fix my home → `https://grants.3fs.app/?role=homeowner`; Money I don't pay back → `https://grants.3fs.app/?role=family`; Money I'm owed → `https://grants.3fs.app/owed`; Fund a project or business → `https://grants.3fs.app/?role=business` (lending when live); I'm a pro or an agent → `/pro`. Three proof tiles filled by `hub.js` from `/api/health` (`areas`, `source.sha256` prefix, `checks_served` if present) — the live usda tile and placeholders labelled "coming" for others; never fake numbers.
- Doors: `renderNetwork` from `doors.json`, refresh every 60 s; node card: purpose, status, Open.
- How: four steps + one inline SVG diagram (Tell us → Checked against the source → AI fills the paperwork → The team finishes it).
- Pro: price, what you get, Stripe button decorated by `ref.js`, Manage billing link, Terms/Privacy links. pro-claim: polls `/api/pro/claim?session_id=` like usda.
- Agents: table from `/api/agents.json` + MCP add commands + ERC-8004 note + link to `/.well-known/3fs.json`.
- Affiliates: how it works, `PAYOUT_FLAT_USD` shown (var in `door.json`, default `25` until Kevan sets it), apply form → `POST /api/case` with `door:'affiliates'`; media kit section (marks, approved one-liners). `/a/<code>` renders `affiliates.html` with the affiliate's name and sets the ref cookie/localStorage via `?ref=<code>` redirect; unknown code → 404.
- Verify: explains official origins, shows the list from `/.well-known/3fs.json` live, "we never ask you to connect a wallet".
- About/Terms/Privacy: usda's text generalized to 3FS (Terms §7 covers all doors; Privacy lists per-door data flows with links); 404 copy from usda.

- [ ] **Step 1: Failing test** (`pages.test.mjs` runs `build('hub')` then checks): each page exists in `hub/public/`; word count of visible text ≤ 300 per page (strip tags; legal pages exempt); every page contains the operator line and the nav with Home/Doors/How it works/Pro/Agents; `index.html` contains the six door buttons with the exact hrefs above; no page contains "3545 Patterstone".
- [ ] **Step 2: Run** → FAIL — **Step 3: Write the pages** (short, plain) — **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat(hub): pages`

### Task 13: Hub case endpoint and routing guide

**Files:**
- Create: `hub/functions/api/case.js`, `hub/functions/api/guide.js`; Test: `hub/tests/guide.test.mjs`

**Interfaces:**
- `/api/case` POST → `createCase` + `notify`; rate limit 5/min 30/day; returns `{id}`.
- `/api/guide` POST `{messages, context}`: system prompt = routing guide (knows the six doors, their URLs and what each does; never quotes numbers; answers in ≤ 3 sentences and ends with exactly one door link); post-check `routeOnly(text)`: if the text contains a `$` figure → replaced with the deterministic route answer for the detected need (`detectNeed(text)` → one of the six keys by keyword table). Export `detectNeed` and `routeAnswer(need)`.

- [ ] **Step 1: Failing tests**: `detectNeed('we want to buy a house in the country')` → `home`; `'college money for my daughter'` → `free`; `'unclaimed property'` → `owed`; `routeAnswer('home')` contains `https://usda.3fs.app/`; `routeOnly('The limit is $105,700', 'home')` returns the route answer.
- [ ] **Step 2: Run** → FAIL — **Step 3: Implement** — **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat(hub): case endpoint and routing guide`

### Task 14: Deploy hub (production project + sandbox) and live checks

**Files:**
- Create: `tools/sandbox.mjs`, `tools/live-check.mjs`; Modify: `LAUNCH-CHECKLIST.md` (new, hub section)

- [ ] **Step 1: Create the Pages project** (from Kevan's Windows shell, project files synced to `C:\Users\Kevan\workers\3fs`): `npx wrangler pages project create 3fs-hub --production-branch main`; set secrets `STRIPE_WEBHOOK_SECRET` (new endpoint in Stripe pointing at `https://3fs.app/api/stripe/webhook` — Kevan creates it in the dashboard, same events as usda), `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `ORIGINS_SIGNING_KEY`, `NOTIFY_WEBHOOK` (optional).
- [ ] **Step 2: `npm run deploy:hub`** → `https://3fs-hub.pages.dev` 200.
- [ ] **Step 3: `node tools/live-check.mjs https://3fs-hub.pages.dev`** → all pages 200; `_headers` present (HSTS, CSP); `/api/health` ok with usda `live`; `/api/pro/me` 401; `/api/stripe/webhook` 400 on bad sig; `/.well-known/3fs.json` verifies; `/a/nonexistent` 404.
- [ ] **Step 4: Sandbox**: `node tools/sandbox.mjs hub` → deploys `--branch sandbox` with `X402_NETWORK=base-sepolia` and Stripe test link var → `https://sandbox.3fs-hub.pages.dev` 200.
- [ ] **Step 5: DNS cutover** (Kevan approves): in Cloudflare, add custom domain `3fs.app` to `3fs-hub` (removes it from the Gemini-built project); re-run live-check against `https://3fs.app`; confirm `https://usda.3fs.app/api/check` with an existing Pro key still 200.
- [ ] **Step 6: Push** to `FTHTrading/3fs` main; CI green. Commit — `chore(hub): deploy, sandbox, live checks`

### Task 15: Point usda at the kit's shared pieces (minimal)

**Files:**
- Modify: `usda-3fs/public/index.html` (footer: add "Verify this site" link to `https://3fs.app/verify`, header parent link already present), `usda-3fs/public/app.js` (include `ref.js` capture so `?ref=` on usda also attributes Pro), `usda-3fs/functions/api/agents.json.js` (new: publishes usda's x402 endpoint for the hub index)
- Test: usda `tests/limits.test.mjs` unchanged passes; live check: `https://usda.3fs.app/api/agents.json` 200 with one entry.

- [ ] **Step 1: Add `agents.json.js`** returning `[{door:'usda.3fs.app', endpoint:'https://usda.3fs.app/api/check', price_usdc:'0.02', network:'base', mcp:'https://usda.3fs.app/mcp'}]`.
- [ ] **Step 2: Add ref capture + footer link; deploy usda; verify live.**
- [ ] **Step 3: Commit in `FTHTrading/usda`** — `feat: publish agents.json, affiliate ref capture, verify link`

---

## Self-review notes
- Spec coverage: §3.1 kit → Tasks 1–8; §3.2 hub pages/functions → 9–13; §5 security → Tasks 2, 3, 10, 11; §6 money → Tasks 7, 10, 12; §11 affiliates/verify/sandbox → 7, 11, 12, 14; §9 order → task order. Grants (§3.3, §4, §11 categories/packets) is deliberately a separate plan.
- Names consistent: `build`, `json/preflight/limited/proFromAuth/readJson`, `requirements/paid/healthShape`, `seen/unsupported`, `createCase/notify`, `validCode/captureRef/decorate`, `layout/renderNetwork`, `aggregate/agentsIndex`, `verifyOrigins`, `detectNeed/routeAnswer/routeOnly`.
- Review Focus items 1–5 are pinned to Tasks 10, 7, 9, 10, 11 respectively.
