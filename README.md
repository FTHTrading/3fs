# 3FS — money and housing, handled.

**3fs.app** · one look, one hub, one AI, many doors · a UnyKorn LLC technology service · MIT

A person says what they need. 3FS finds the money or the housing path, proves every number with its source, fills the paperwork, and sends it to the team when it does not know. Every door is also an agent endpoint (x402 payments, ERC-8004 identity).

| Door | What it does | Status |
|---|---|---|
| [3fs.app](https://3fs.app) `hub/` | What do you need → the right door · live network map · 3FS Pro · agent index · affiliates · official-origins registry | **building (cycle 1)** |
| `kit/` | The shared design + engineering kit every door vendors: tokens, components, mark, header/footer, network diagram, guide guard, x402 wrapper, Pro keys, rate limits, security headers, schema | **building (cycle 1)** |
| grants.3fs.app `grants/` | Money you don't pay back: grants, down-payment assistance, forgivable loans, repair grants, education, veterans, seniors, business, unclaimed property, settlements — found for your situation and filled out for you | cycle 1 (after hub) |
| [usda.3fs.app](https://usda.3fs.app) | Rural home loans with FY2026 USDA income limits ([repo](https://github.com/FTHTrading/usda)) | **live** |
| lending.3fs.app | Commercial & real-estate credit (LDX port: 6 programs, evaluator, stress suite, tokenized rail) | cycle 2 |
| file.3fs.app | One intake, one KYC/CIP, AI fills every form for any door | cycle 3 |
| give.3fs.app · fund.3fs.app | The 3FS giving token and family funding through RWA records | cycle 4 |

## How money moves (every door, from day one)
- **3FS Pro** $49/mo — one key works on every door (bulk, API, MCP)
- **Agents** $0.02 per call — x402, USDC on Base
- **Send to the team** — cases that become paid packet work at prices set by 3FS, shown before any charge
- **Affiliates & partners** — flat, disclosed payout per paid signup; never a percentage, never hidden

## Docs
- Spec: [`docs/superpowers/specs/2026-10-07-3fs-hub-kit-grants-design.md`](docs/superpowers/specs/2026-10-07-3fs-hub-kit-grants-design.md)
- Plan 1 (kit + hub): [`docs/superpowers/plans/2026-10-07-3fs-kit-and-hub.md`](docs/superpowers/plans/2026-10-07-3fs-kit-and-hub.md)

## Run
```bash
npm install
npm test            # kit + hub tests
npm run build:hub   # kit → hub/public, pages rendered
npm run deploy:hub  # wrangler pages deploy → 3fs-hub
```
Stack: Cloudflare Pages + Functions, D1, Workers AI, Stripe, Coinbase CDP (x402), pdf-lib. No framework, no bundler.

3FS is not affiliated with USDA or any agency and is not a lender or broker. Code MIT; 3FS mark and brand assets are trademarks of UnyKorn LLC.
