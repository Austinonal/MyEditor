// Draws every bubble shape and gradient through the real text renderer, side by side. Run: node scripts/group2-look.mjs <out.png>
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const out = process.argv[2];
const port = 4197;
const srv = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const pg = await b.newPage();
const errors = [];
pg.on('pageerror', (e) => errors.push(String(e)));
await pg.goto(`http://localhost:${port}/`);
const png = await pg.evaluate(async () => {
  const T = await import('/src/text.ts');
  const F = await import('/src/fonts.ts');
  const B = await import('/src/bubbles.ts');
  await F.loadFonts();
  const c = new OffscreenCanvas(1200, 900);
  const g = c.getContext('2d');
  g.fillStyle = '#3a4a6b';
  g.fillRect(0, 0, 1200, 900);
  const base = { fontId: 'kanit', size: 64, colour: '#111111ff', align: 'center', stroke: null, shadow: null, background: null };
  const clip = (text, style) => ({ id: 'x', kind: 'text', text, style: { ...base, ...style }, transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1 }, start: 0, duration: 1, keyframes: [], animIn: null, animOut: null, animLoop: null });
  const put = (img, x, y) => g.drawImage(img.canvas, x - img.w / 2, y - img.h / 2);
  B.BUBBLES.forEach(([shape, name], i) => put(T.textImage(clip(name, { bubble: { shape, fill: i % 2 ? '#ffd84dff' : '#ffffffff', border: '#111111ff' } }), 1080, 1920), 200 + (i % 3) * 400, 150 + Math.floor(i / 3) * 230));
  B.GRADIENTS.forEach(([name, gr], i) => put(T.textImage(clip(name, { colour: '#ffffffff', size: 70, stroke: { colour: '#000000ff', width: 6 }, gradient: gr }), 1080, 1920), 200 + (i % 3) * 400, 620 + Math.floor(i / 3) * 150));
  const blob = await c.convertToBlob({ type: 'image/png' });
  return [...new Uint8Array(await blob.arrayBuffer())];
});
writeFileSync(out, Buffer.from(png));
console.log(errors.length ? errors.join(' | ') : 'no page errors');
await b.close();
srv.kill();
