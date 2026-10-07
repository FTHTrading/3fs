// node tools/sign-origins.mjs            -> signs hub/origins.json with $ORIGINS_SIGNING_KEY (Ed25519 PKCS8 PEM) into hub/origins.signed.json
// node tools/sign-origins.mjs --keygen   -> prints a new key pair (store the private key as a Pages secret; commit the public key to hub/origins.pub.pem)
import fs from 'node:fs/promises';
import { generateKeyPairSync } from 'node:crypto';
import { signOrigins, verifyOrigins } from '../kit/fn/origins.js';

if (process.argv.includes('--keygen')) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  console.log(privateKey.export({ type: 'pkcs8', format: 'pem' })); console.log(publicKey.export({ type: 'spki', format: 'pem' }));
  process.exit(0);
}
const priv = process.env.ORIGINS_SIGNING_KEY;
if (!priv) { console.error('ORIGINS_SIGNING_KEY (PEM) not set'); process.exit(2); }
const payload = JSON.parse(await fs.readFile('hub/origins.json', 'utf8'));
const signed = await signOrigins(payload, priv.replace(/\\n/g, '\n'));
const pub = await fs.readFile('hub/origins.pub.pem', 'utf8');
if (!(await verifyOrigins(signed, pub))) { console.error('signature does not verify against hub/origins.pub.pem'); process.exit(1); }
await fs.writeFile('hub/origins.signed.json', JSON.stringify(signed, null, 2));
console.log('signed', payload.origins.length, 'origins');
