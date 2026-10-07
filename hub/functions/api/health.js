import { json } from '../_kit/core.js';
import { healthShape } from '../_kit/health.js';
import { aggregate } from '../_aggregate.js';
import DOORS from '../../doors.json';

export async function onRequest({ request, env }) {
  const deep = new URL(request.url).searchParams.get('deep') === '1';
  const [base, agg] = await Promise.all([healthShape(env, { door: '3fs.app', pro_link: env.PRO_LINK || null }, { deep }), aggregate(DOORS, fetch, { timeoutMs: 3000 })]);
  return json({ ...base, ...agg });
}
