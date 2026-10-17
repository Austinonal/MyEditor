// Reads a busy, made-up thumbnail (two people, a cat, food, stickers, an arrow, a badge, text) with the real reader in
// Chromium and draws what it found. Run: node scripts/thumb-check.mjs <images dir> <out.png>
// The images dir holds portrait.jpg, pose.jpg, cat.jpg, burger.jpg (MediaPipe's sample pictures).
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [dir, out] = process.argv.slice(2);
const pics = Object.fromEntries(['portrait', 'pose', 'cat', 'burger'].map((n) => [n, [...readFileSync(path.join(dir, `${n}.jpg`))]]));
const port = 4192;
const srv = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const pg = await b.newPage();
pg.on('console', (m) => m.type() === 'warning' && console.log('warn:', m.text().slice(0, 200)));
await pg.goto(`http://localhost:${port}/`);
const res = await pg.evaluate(async (pics) => {
  const T = await import('/src/thumbnail.ts');
  const bmp = async (n) => createImageBitmap(new Blob([new Uint8Array(pics[n])]));
  const c = new OffscreenCanvas(1280, 720);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 1280, 720);
  grad.addColorStop(0, '#1b2a6b');
  grad.addColorStop(1, '#6b1b5a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1280, 720);
  const put = async (n, x, y, w) => { const im = await bmp(n); g.drawImage(im, x, y, w, (w * im.height) / im.width); };
  await put('portrait', 40, 140, 330);
  await put('pose', 900, 120, 340);
  await put('cat', 470, 400, 260);
  await put('burger', 640, 120, 220);
  const text = (s, x, y, size, fill, stroke) => { g.font = `900 ${size}px sans-serif`; g.lineWidth = size / 8; g.strokeStyle = stroke; g.strokeText(s, x, y); g.fillStyle = fill; g.fillText(s, x, y); };
  text('TOP 5', 380, 100, 96, '#ffd84d', '#000');
  text('รีวิว', 420, 690, 80, '#fff', '#e02020');
  g.fillStyle = '#ff2d2d'; g.fillRect(380, 300, 110, 28); g.beginPath(); g.moveTo(490, 284); g.lineTo(540, 314); g.lineTo(490, 344); g.fill(); // arrow
  g.fillStyle = '#ffd400'; g.beginPath(); g.arc(1180, 640, 55, 0, 7); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.arc(1160, 625, 8, 0, 7); g.arc(1200, 625, 8, 0, 7); g.fill(); // emoji
  g.fillStyle = '#18a558'; g.beginPath(); g.roundRect(40, 30, 240, 80, 20); g.fill(); text('NEW', 90, 95, 56, '#fff', '#18a558'); // badge
  g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(780, 520, 70, 0, 7); g.stroke(); // highlight ring
  const refBlob = await c.convertToBlob({ type: 'image/png' });
  const file = new File([refBlob], 'ref.png', { type: 'image/png' });
  const t0 = performance.now();
  const layout = await T.analyzeThumbnail(file);
  const ms = Math.round(performance.now() - t0);
  // draw what was found
  const colours = { person: '#00e5ff', object: '#ffea00', graphic: '#ff4fd8', text: '#7CFC00' };
  const box = (b, col, label) => { g.strokeStyle = col; g.lineWidth = 5; g.strokeRect((b.cx - b.w / 2) * 1280, (b.cy - b.h / 2) * 720, b.w * 1280, b.h * 720); g.font = 'bold 22px sans-serif'; g.fillStyle = col; g.fillText(label, (b.cx - b.w / 2) * 1280 + 4, (b.cy - b.h / 2) * 720 + 24); };
  for (const s of layout.spots ?? []) box(s, colours[s.kind], s.kind + (s.label ? `:${s.label} ${s.score.toFixed(2)}` : ''));
  for (const t of layout.texts) box(t, colours.text, `text:${(t.text ?? '').slice(0, 10)}`);
  const png = await c.convertToBlob({ type: 'image/png' });
  return { ms, spots: (layout.spots ?? []).map((s) => `${s.kind}${s.label ? ':' + s.label : ''}`), texts: layout.texts.map((t) => t.text ?? '?'), png: [...new Uint8Array(await png.arrayBuffer())], ref: [...new Uint8Array(await refBlob.arrayBuffer())] };
}, pics);
writeFileSync(out, Buffer.from(res.png));
writeFileSync(out.replace(/\.png$/, '-reference.png'), Buffer.from(res.ref));
console.log(JSON.stringify({ ms: res.ms, spots: res.spots, texts: res.texts }, null, 1));
await b.close();
srv.kill();
