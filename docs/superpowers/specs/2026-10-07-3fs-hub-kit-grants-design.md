# 3FS — Hub, shared kit and grants.3fs.app
Design spec · 2026-10-07 · Cycle 1 of the 3FS build · Owner: UnyKorn LLC

## 0. What 3FS is

**3FS: money and housing, handled.** One look, one hub, one AI, many doors. A person says what they need; 3FS finds the money or the housing path, proves every number with its source, fills the paperwork, and sends it to the team when it does not know. Every door is also an agent endpoint (x402 payments, ERC-8004 identity) so machines can use it and pay per use.

Serious tone, plain words, no hype. The usda.3fs.app build is the reference for look, tone and engineering pattern.

### Doors (full map; this spec builds the first three rows)
| Door | Purpose | Status |
|---|---|---|
| **3fs.app** | Hub: what do you need → the right door; live network map; agent index; Pro | **This cycle** |
| **3fs-kit** | Shared design + engineering kit every door vendors | **This cycle** |
| **grants.3fs.app** | Money you don't pay back: grants, down-payment assistance, forgivable/deferred loans, repair grants, unclaimed property, settlements, benefits | **This cycle** |
| usda.3fs.app | Rural home loans | Live |
| lending.3fs.app | Commercial & real-estate credit (LDX port: 6 programs, evaluator, stress suite, tokenized rail) | Cycle 2 |
| file.3fs.app | One intake, one KYC/CIP, AI fills every form for any door | Cycle 3 |
| give.3fs.app | Private 3FS giving token; donors fund, recipients receive, ledger + partner-charity receipt | Cycle 4 |
| fund.3fs.app | Verified family need → fundable RWA record | Cycle 4 |

Lawsuits/settlements are not a separate door: they live in grants as "Money owed to you".

## 1. Goals and success criteria

Goals
1. 3fs.app stops being confusing: a visitor knows in 5 seconds what 3FS does and clicks one door.
2. Every door makes money from day one through the same four levers (section 6).
3. A family finds real, verified free money for their place in under a minute and can start the application without leaving 3FS.
4. Every number shown has a source, a verified date and a fingerprint, like usda.
5. Every door looks identical in kit, differs only in purpose.

Success (measurable at launch)
- Hub: ≤ 7 pages, each under ~250 words, Lighthouse ≥ 90, every door node on the map shows live health.
- Grants: ≥ 150 verified programs at launch (all national + Georgia deep), 100% with source URL + verified date + fingerprint; match returns in < 300 ms; guide never emits an unverified dollar figure (same guard as usda, `grounded:false` fallback).
- Money: Stripe Pro live on hub + grants with one shared key; x402 402 flow live on `/api/match`; "Send to the team" produces a case in D1 and an email within 60 s.
- Kit: a new door scaffolds from the kit in < 1 hour (header, footer, tokens, guide, health, Pro, x402, headers).

Non-goals this cycle: KYC/CIP, the token, lending port, filling third-party PDFs (grants "Start" produces our packet + prefilled fields export; true form-filling is file.3fs.app).

## 2. Users and roles

| Role | Hub asks | Grants gives |
|---|---|---|
| Family / buyer | "Buy or build a home", "Fix my home", "Pay rent/bills", "Start a business", "Get money I'm owed" | DPA, closing-cost grants, forgivable seconds, bond-funded programs, unclaimed property, settlements |
| Homeowner | Repairs, energy, taxes | USDA 504 grant, weatherization, state repair programs, property-tax relief |
| Renter | Rent/utility help, path to buying | ERA-type programs, utility assistance, first-time-buyer prep |
| Small business | Grants, SBA, local incentives | Business grants, Opportunity Zone incentives, local EDC programs |
| Nonprofit / church | Program funding | Federal/state/foundation grants (Grants.gov-sourced) |
| Agent / Pro | Bulk, API, white-label | Pro key, CSV, MCP |

Roles are chosen on the hub and carried to doors in the URL (`?role=family`) and localStorage.

## 3. Architecture

Monorepo **FTHTrading/3fs**:
```
kit/        shared design + engineering kit (plain files, vendored by copy at build)
hub/        3fs.app            Cloudflare Pages project "3fs-hub"
grants/     grants.3fs.app     Cloudflare Pages project "3fs-grants"
tools/      build + scout scripts
docs/superpowers/specs|plans
```
Each door: `public/` (static) + `functions/` (Pages Functions) + `wrangler.toml` + D1. No framework; vanilla HTML/CSS/JS like usda. Deploy by `wrangler pages deploy`; CI runs `node --check` + `node --test`.

### 3.1 Kit (`kit/`)
- `tokens.css` — colors (`--field:#A30D22`, `--ink:#111214`, `--bg:#F7F7F4`, `--line:#D8DADF`), type (Inter, IBM Plex Mono), radii, glass.
- `kit.css` — header, footer, glass cards, verdict rows, chips, buttons, tables, legal pages.
- `brand/` — 3fs-mark.svg, white, 512 png, favicon, og template.
- `header.html` / `footer.html` — fragments inlined by `tools/build.mjs` (door name, parent link, legal links).
- `network.js` — the network diagram component (nodes = doors, edges = flows, live health dots).
- `globe.js` + `places.js` — the d3 globe and ZIP/city/county index from usda (data split out to `places-data.js`).
- `guide-client.js` — chat UI + tool loop + local fallback, pointed at the door's `/api/guide`.
- `fn/` — Pages Functions helpers: `json/preflight/CORS`, `limited()` D1 rate limiter, `proFromAuth()`, `x402.js` (402 terms + CDP verify/settle), `health.js` shape, `guide-guard.js` (facts block + number guard), `case.js` (Send to the team).
- `_headers` — HSTS, CSP, nosniff, referrer, permissions, frame-ancestors.
- `pdf/` — pdf-lib header/footer with mark and disclaimer.
- `schema.sql` — `pro_accounts`, `api_calls`, `hits`, `cases` (shared shape; each door has its own D1 or binds the shared one).

Doors copy `kit/` into `public/kit/` and `functions/_kit/` at build (`node tools/build.mjs grants`), so each deploy is self-contained.

### 3.2 Hub (`hub/`) — 3fs.app
Pages (separate HTML files, nav on every page):
1. `/` **Home** — mark, one line ("Money and housing, handled."), the question **"What do you need?"** with 6 big buttons (Buy or build a home · Fix my home · Money I don't pay back · Money I'm owed · Fund a project or business · I'm a pro or an agent). Each routes to a door with role preset. Below: three proof tiles (numbers from live `/api/health` of each door: areas/programs verified, source fingerprints, checks served).
2. `/doors` **Doors** — the network diagram, every door a node with live health dot, one-line purpose, "Open". Coming-soon nodes shown grey with their cycle.
3. `/how` **How it works** — four steps: Tell us · We check it against the source · AI fills the paperwork · The team finishes it. One diagram.
4. `/pro` **Pro** — $49/mo, one key for every door, bulk + API + MCP. Stripe link (UnyKorn LLC account), Manage billing link. Key claim page `/pro/claim`.
5. `/agents` **Agents** — index of every x402 endpoint across doors (pulled from each door's `/api/agents.json`), price, MCP add commands, ERC-8004 identity note.
6. `/about`, `/terms`, `/privacy`, `/404`.
Functions: `/api/health` (aggregates doors), `/api/pro/*` (shared Pro — the hub owns the Pro D1; doors validate keys by calling hub `/api/pro/verify` with a server secret, or by binding the same D1 — **decision: same D1 binding**, simplest), `/api/stripe/webhook` (moved here from usda; usda keeps validating against the shared D1), `/api/case` (team escalation), `/api/guide` (routing guide: asks what you need, sends you to a door).

### 3.3 Grants (`grants/`) — grants.3fs.app
Flow: role → place (globe) → facts (household size, income, own/rent, first-time buyer, 62+, veteran, business/nonprofit) → **matches** → Start / Send to the team.

Data model (D1 `programs`):
```
id, slug, type (grant|dpa|forgivable|deferred|repair|unclaimed|settlement|benefit|incentive),
name, operator, operator_type (federal|state|county|city|hfa|utility|foundation|court),
geo_level (us|state|county|zip|tract), geo (JSON list of state/county FIPS/ZIPs),
roles (JSON), income_rule (JSON: {basis: ami|fpl|fixed|none, pct, by_household}),
rules (JSON: first_time, own, rent, age_min, veteran, disability, oz_tract, credit_min, purchase_price_max),
amount_min, amount_max, amount_rule (text), repay (none|forgivable|deferred|low_interest),
how_to_apply (text), apply_url, forms (JSON list), deadline, funds_status (open|waitlist|closed|rolling),
source_url, source_sha256, verified_at, verified_by (scout|human), status (live|review|retired), notes
```
Match engine (`functions/_match.js`, deterministic): filter by geo (ZIP→county→state→US), role, rules; evaluate income_rule against AMI table (HUD FY2026 income limits by county — same parse pattern as usda; FPL table for benefits); sort by amount desc, repay none first, then forgivable. Returns matches + "maybe" (missing fact) + sources.

Scout (`tools/scout/`): scheduled Worker (cron) + local script. Per source (state HFA pages, HUD DPA list, USDA 504, Grants.gov API, state unclaimed-property portals, settlement registries), fetch → extract with Workers AI into the row schema → store as `status:review` with source hash → diff against existing. A review page `/admin/review` (Pro-admin key) approves to `live`. Nothing unreviewed is shown. Launch registry is seeded by hand-verified rows (target ≥150).

Pages: `/` (flow), `/program/<slug>` (one program, SEO page: who qualifies, amount, how to apply, source), `/owed` (unclaimed property + settlements: state portal links + open settlements list), `/proof`, `/pro`, `/blog/`, legal.
Functions: `/api/match` (free in browser via Pro/x402 rules as usda `/api/check`), `/api/program/:slug`, `/api/guide` (grounded: facts block = the matched rows), `/api/packet` (pdf-lib: the person's match sheet + checklist + prefilled fields per program), `/api/case`, `/api/health`, `/mcp` (tools: `match_programs`, `program`, `money_owed`, `program_info`), `/api/agents.json`.
"Start": for programs with a known form, show the field list prefilled from the person's facts and export (JSON + PDF packet); link to the official apply_url. Full form filling is file.3fs.app.
"Send to the team": `POST /api/case` {door, role, place, facts, matches, message} → D1 `cases` + email (Cloudflare Email Routing/Resend) to the team inbox; AI writes the one-paragraph summary; person gets a case number.

## 4. Data flow (grants)
Browser computes nothing it cannot prove: it calls `/api/match` (free for humans from the site origin via a short-lived site token; agents pay x402; Pro keys unlimited). Response carries every row's `source_url`, `verified_at`, `source_sha256`. Guide gets the same rows as its FACTS block; number guard replaces any unverified figure. PDF packet is generated server-side from the same rows.

## 5. Security and privacy baseline (from the usda audit, applied to every door)
- `_headers`: HSTS, CSP (self + cdnjs/jsdelivr with SRI + Cloudflare Insights), nosniff, referrer, permissions, frame-ancestors self.
- Rate limits via D1 hashed IP on every function; body caps; input clamps.
- Pro keys: `rh_` + 48 hex, SHA-256 hash stored, one-time claim with `changes===1` check; webhook requires `payment_status=paid`.
- Guide: server-side facts + number/page guard; no prompt disclosure; message overrides screen.
- Sensitive facts (age, veteran, disability) stay in the browser and are sent only in the match request the person triggers; not logged (api_calls logs ZIP + ok only). Cases store what the person chose to send.
- Privacy page states exactly what leaves the device (match request, guide, packet, case).

## 6. Money (every door, from day one)
| Lever | Hub | Grants | Mechanism |
|---|---|---|---|
| **Pro** $49/mo | sells it | honors it | Stripe Payment Link (UnyKorn LLC), one key for all doors, shared D1 |
| **Agents** $0.02/call | indexes | `/api/match`, `/api/program` | x402 v1, Base USDC, CDP facilitator, pay-to 0xFCc1…3cb3 |
| **Team cases** | routes | "Send to the team" | free intake → paid packet assembly / retainer quoted by the team (prices set by Kevan; shown before any charge) |
| **Partner referrals** | `/agents`, `/doors` | program-level "approved lender/packager" slots | flat disclosed fee per closed engagement, never hidden, never a % (partner program rule) |
Later doors add: lending (LDX term-sheet fee), file (packet/filing fee), give/fund (platform fee).

## 7. Error handling
- Door down → hub node shows grey "checking" after 2 failed health polls; home still routes.
- No matches → "maybe" list + nearest-county alternatives + Send to the team, never an empty screen.
- Source page changed (hash mismatch on re-crawl) → row flips to `review`, badge "re-verifying" on the card; amount shown with the last verified date.
- Model error → local deterministic guide (as usda); 429 → "give it a minute".
- Email send fails → case still stored, surfaced on `/admin/cases`.

## 8. Testing
- `node --test` per door: match engine (geo cascade, income rules vs AMI/FPL, rule gates), guard, limitFor-style helpers; kit build script; health shape.
- Live checks script (PowerShell + bash) per door: pages 200, headers, 402 shape, webhook 400s, rate limit trips, guide grounded on 6 probes.
- Registry QA: every live row has source_url 200, verified_at ≤ 90 days, sha256 present (CI job).

## 9. Build order inside this cycle
1. Kit extracted from usda (1 day) → usda re-based on kit later, not now.
2. Hub pages + shared Pro + Stripe webhook move + agents index (1–2 days). **Ship — 3fs.app makes sense and sells Pro.**
3. Grants: schema + AMI/FPL tables + match engine + tests → seed registry (national + Georgia) → pages → guide → packet → MCP/x402 → proof/blog → ship.
4. Scout automation + review page.
5. Audit pass (same checklist as usda) → done.

## 10. Open items for Kevan
- Create empty repo `FTHTrading/3fs` (I push everything).
- Team inbox for cases (default kevan@unykorn.org) and the price list for paid packet work.
- Stripe: reuse the existing Pro Payment Link or create "3FS Pro" (one product, all doors). Recommendation: reuse, rename the product to "3FS Pro".
- DNS: `3fs.app` currently points at the Gemini-built Worker/Pages; cut over to the new hub project at ship.
