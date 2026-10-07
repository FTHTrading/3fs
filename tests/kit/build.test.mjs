import { test } from 'node:test'; import assert from 'node:assert/strict';
import { build } from '../../tools/build.mjs'; import fs from 'node:fs';
test('build renders a page with fragments and copies kit', async () => {
  const out = await build('hub', { dry: false });
  const html = fs.readFileSync('hub/public/index.html', 'utf8');
  assert.match(html, /<title>3FS/); assert.match(html, /class="site-header"/); assert.match(html, /UnyKorn LLC/);
  assert.ok(fs.existsSync('hub/public/kit/kit.css')); assert.ok(fs.existsSync('hub/functions/_kit/core.js'));
  assert.ok(fs.existsSync('hub/public/_headers')); assert.ok(out.pages.includes('index.html'));
});
