// Scores the reference reader against a made-up edit with known answers (scripts/make-reference.py).
// Run: node scripts/autocut-check.mjs <ref.webm> <ref.json>
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [mp4, json] = process.argv.slice(2);
const truth = JSON.parse(readFileSync(json, 'utf8'));
const port = 4194;
const srv = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const pg = await b.newPage();
const errors = [];
pg.on('pageerror', (e) => errors.push(String(e)));
await pg.goto(`http://localhost:${port}/`);
const res = await pg.evaluate(async (bytes) => {
  const R = await import('/src/reference.ts');
  globalThis.__dbg = [];
  const file = new File([new Uint8Array(bytes)], 'ref.webm', { type: 'video/webm' });
  const t0 = performance.now();
  const slots = await R.analyzeReference(file, () => {}, new AbortController().signal);
  return { ms: Math.round(performance.now() - t0), slots, dbg: globalThis.__dbg.filter((d) => d.t > 8 && d.t < 8.8) };
}, [...readFileSync(mp4)]);
await b.close();
srv.kill();
if (process.env.DBG) console.log(JSON.stringify(res.dbg.map((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, +v.toFixed(2)])))));

const expect = { cut: null, fade: 'dissolve', fadeblack: 'fade-black', fadewhite: 'fade-white', wipeleft: 'wipe', slideleft: 'slide-left', circleopen: 'circle' };
const found = res.slots.slice(1).map((s) => ({ at: s.start, tr: s.transition?.presetId ?? (s.dissolve ? 'dissolve' : null), s }));
let hit = 0, typed = 0;
const rows = truth.boundaries.map((t) => {
  const f = found.find((x) => x.at >= t.from - 0.1 && x.at <= t.to + 0.1);
  if (f) hit++;
  const ok = f && (f.tr === expect[t.kind] || (t.kind === 'fadewhite' && f.tr === 'flash'));
  if (ok) typed++;
  return `${t.kind.padEnd(10)} at ${t.at.toFixed(2)}  ->  ${f ? `found ${f.at.toFixed(2)} as ${f.tr ?? 'cut'}${ok ? '' : `  (want ${expect[t.kind] ?? 'cut'})`}` : 'MISSED'}`;
});
const extra = found.filter((x) => !truth.boundaries.some((t) => x.at >= t.from - 0.1 && x.at <= t.to + 0.1));
const textsFound = res.slots.flatMap((s, i) => (s.texts ?? []).map((t) => `${i}:${t.text}`));
console.log(rows.join('\n'));
console.log(`extra boundaries: ${extra.map((x) => x.at.toFixed(2)).join(', ') || 'none'}`);
console.log(`texts found: ${textsFound.join(' | ') || 'none'} (truth: ${truth.texts.map((t) => `${t.shot}:${t.text}`).join(' | ')})`);
console.log(`in/out/combo per slot: ${res.slots.map((s) => [s.in?.presetId, s.out?.presetId, s.combo?.presetId].filter(Boolean).join('+') || '-').join(' / ')}`);
const textHits = truth.texts.filter((t) => res.slots[t.shot]?.texts?.some((x) => x.text?.replace(/\s/g, '').includes(t.text.replace(/\s/g, '')))).length;
console.log(`SCORE boundaries ${hit}/${truth.boundaries.length}, transition type ${typed}/${truth.boundaries.length}, extra ${extra.length}, texts ${textHits}/${truth.texts.length}, ${res.ms} ms${errors.length ? ', errors: ' + errors.join(' | ') : ''}`);
