// node tools/build.mjs <door>
// Copies the shared kit into a door and renders <door>/src/pages/*.html into <door>/public/.
// Placeholders: {{HEAD}} {{HEADER}} {{FOOTER}} (fragments) · {{DOOR}} {{NAME}} {{URL}} (door.json) · {{TITLE}} {{DESC}} {{PATH}} (page meta comment).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT = path.join(ROOT, 'kit');

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function copyDir(src, dst) {
  let n = 0;
  await fs.mkdir(dst, { recursive: true });
  for (const e of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) n += await copyDir(s, d); else { await fs.copyFile(s, d); n++; }
  }
  return n;
}
function meta(html) {
  const m = html.match(/<!--\s*meta:\s*(\{[\s\S]*?\})\s*-->/);
  return m ? JSON.parse(m[1]) : {};
}
export function render(template, vars) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => (k in vars ? vars[k] : ''));
}

export async function build(door, opts = {}) {
  const D = path.join(ROOT, door);
  const doorCfg = JSON.parse(await fs.readFile(path.join(D, 'door.json'), 'utf8'));
  const pub = path.join(D, 'public'), fns = path.join(D, 'functions');
  let copied = 0;
  // kit → public/kit (css, js), public/brand, public/_headers; kit/fn → functions/_kit
  await fs.mkdir(path.join(pub, 'kit'), { recursive: true });
  for (const f of ['tokens.css', 'kit.css']) if (await exists(path.join(KIT, f))) { await fs.copyFile(path.join(KIT, f), path.join(pub, 'kit', f)); copied++; }
  if (await exists(path.join(KIT, 'js'))) copied += await copyDir(path.join(KIT, 'js'), path.join(pub, 'kit'));
  if (await exists(path.join(KIT, 'brand'))) copied += await copyDir(path.join(KIT, 'brand'), path.join(pub, 'brand'));
  if (await exists(path.join(KIT, '_headers'))) { await fs.copyFile(path.join(KIT, '_headers'), path.join(pub, '_headers')); copied++; }
  if (await exists(path.join(KIT, 'fn'))) copied += await copyDir(path.join(KIT, 'fn'), path.join(fns, '_kit'));
  // fragments
  const frag = {};
  for (const f of ['head', 'header', 'footer']) frag[f.toUpperCase()] = await fs.readFile(path.join(KIT, 'fragments', f + '.html'), 'utf8');
  // pages
  const pagesDir = path.join(D, 'src', 'pages'), pages = [];
  for (const f of (await fs.readdir(pagesDir)).filter(f => f.endsWith('.html')).sort()) {
    const tpl = await fs.readFile(path.join(pagesDir, f), 'utf8');
    const m = meta(tpl);
    const vars = { DOOR: doorCfg.door, NAME: doorCfg.name, URL: doorCfg.url, TITLE: m.title || doorCfg.name, DESC: m.desc || '', PATH: m.path || '/' + f.replace(/\.html$/, '') };
    const inner = render(tpl, { ...vars, HEAD: render(frag.HEAD, vars), HEADER: render(frag.HEADER, vars), FOOTER: render(frag.FOOTER, vars) });
    if (!opts.dry) await fs.writeFile(path.join(pub, f), inner.replace(/<!--\s*meta:[\s\S]*?-->\n?/, ''));
    pages.push(f);
  }
  return { pages, copied };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const door = process.argv[2];
  if (!door) { console.error('usage: node tools/build.mjs <door>'); process.exit(2); }
  build(door).then(r => console.log(`built ${door}: ${r.pages.length} pages, ${r.copied} kit files`));
}
