// node tools/sandbox.mjs <door>  -> deploys the door to its `sandbox` branch (sandbox.<project>.pages.dev) with sandbox vars.
// Sandbox uses Base Sepolia for x402 and the Stripe TEST link. Set STRIPE_TEST_LINK in env to override the placeholder.
import { execSync } from 'node:child_process';
const door = process.argv[2]; if (!door) { console.error('usage: node tools/sandbox.mjs <door>'); process.exit(2); }
const project = door === 'hub' ? '3fs-hub' : '3fs-' + door;
execSync(`node tools/build.mjs ${door}`, { stdio: 'inherit' });
execSync(`npx wrangler pages deploy ${door}/public --project-name ${project} --branch sandbox --commit-dirty=true`, { stdio: 'inherit' });
console.log(`\nSandbox: https://sandbox.${project}.pages.dev\nSet sandbox-only vars in the Pages dashboard (Preview environment): X402_NETWORK=base-sepolia, PRO_LINK=<Stripe test link>.`);
