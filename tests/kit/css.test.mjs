import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const tokens = fs.readFileSync('kit/tokens.css', 'utf8'), kit = fs.readFileSync('kit/kit.css', 'utf8'), headers = fs.readFileSync('kit/_headers', 'utf8');
test('tokens carry the 3FS palette and type', () => {
  for (const hex of ['#A30D22', '#6E0717', '#111214', '#30343A', '#5F646C', '#F7F7F4', '#D8DADF']) assert.ok(tokens.includes(hex), hex);
  assert.match(tokens, /font-family:\s*Inter/); assert.match(tokens, /IBM Plex Mono/);
});
test('kit.css defines every shared component class', () => {
  for (const c of ['.site-header', '.brand', '.mark', '.nav', '.glass', '.hero', '.grid2', '.grid3', '.btn', '.btn-primary', '.btn-soft', '.chip', '.kv', '.verdict', '.ok', '.no', '.maybe', '.status', '.live', '.down', '.soon', '.tile', '.legal', '.small', '.muted', '.num', '.site-footer', '.wrap']) assert.ok(kit.includes(c), c);
});
test('_headers carries the security baseline', () => {
  for (const h of ['Strict-Transport-Security', 'Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'X-Frame-Options']) assert.ok(headers.includes(h), h);
  assert.ok(headers.includes('https://static.cloudflareinsights.com'));
});
