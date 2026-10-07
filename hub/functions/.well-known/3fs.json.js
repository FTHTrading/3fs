// GET /.well-known/3fs.json -> the signed official-origins registry (see /verify)
import SIGNED from '../../origins.signed.json';
import { json } from '../_kit/core.js';
export async function onRequest() {
  return json(SIGNED, 200, { 'cache-control': 'public, max-age=3600' });
}
