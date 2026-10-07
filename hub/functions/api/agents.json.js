// GET /api/agents.json -> every x402 endpoint across the live doors
import { json } from '../_kit/core.js';
import { agentsIndex } from '../_aggregate.js';
import DOORS from '../../doors.json';

const USDA_FALLBACK = [{ door: 'usda', endpoint: 'https://usda.3fs.app/api/check', price_usdc: '0.02', network: 'base', mcp: 'https://usda.3fs.app/mcp', description: 'FY2026 USDA Direct and Guaranteed income limits for a ZIP and household, with the source page.' }];

export async function onRequest() {
  let idx = await agentsIndex(DOORS, fetch, { timeoutMs: 3000 });
  if (!idx.some(e => e.door === 'usda')) idx = [...USDA_FALLBACK, ...idx];
  return json({ x402Version: 1, network: 'base', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', pay_to: '0xFCc1D28Ad797d65CDDb2A7219c5BE6B062653cb3', pro: 'https://3fs.app/pro', endpoints: idx, generated_at: new Date().toISOString() }, 200, { 'cache-control': 'public, max-age=300' });
}
