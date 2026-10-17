// Draws frames through the real renderer in Chromium and checks pixels: chroma key, mask, picture canvas.
// Run: npm run check:render   (needs Chromium; set CHROME to its path)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const port = 4190;
const srv = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));
const exe = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const pg = await b.newPage();
const errors = [];
pg.on('pageerror', (e) => errors.push(String(e)));
await pg.goto(`http://localhost:${port}/`);
const result = await pg.evaluate(async () => {
  const T = await import('/src/timeline.ts');
  const R = await import('/src/render.ts');
  const B = await import('/src/canvasbg.ts');
  const asset = (id, name) => ({ id, kind: 'photo', name, file: `media/p1/${id}`, bytes: 1, duration: 0, width: 200, height: 200, rotation: 0, hasAudio: false });
  const source = (draw) => { const c = new OffscreenCanvas(200, 200); draw(c.getContext('2d')); return c; };
  const frame = (p, clip, src) => {
    const out = new OffscreenCanvas(200, 200);
    R.renderFrame(out.getContext('2d'), 200, 200, p, 0, new Map([[clip.id, src]]));
    const d = out.getContext('2d').getImageData(0, 0, 200, 200).data;
    return (x, y) => [...d.slice((y * 200 + x) * 4, (y * 200 + x) * 4 + 3)];
  };
  const make = () => { const p = T.newProject('p1', 't', asset('a1', 'a.jpg'), '2026-01-01T00:00:00Z'); p.aspect = '1:1'; p.canvas = { kind: 'colour', colour: '#0000ff' }; return [p, p.tracks[0].clips[0]]; };
  const out = {};
  const greenScreen = source((g) => { g.fillStyle = '#00ff00'; g.fillRect(0, 0, 200, 200); g.fillStyle = '#dd2222'; g.fillRect(60, 60, 80, 80); });
  { const [p, c] = make(); const px = frame(p, c, greenScreen); out.chromaOff = [px(10, 10), px(100, 100)]; }
  { const [p, c] = make(); T.setChroma(p, c.id, { colour: '#00ff00', similarity: 0.4, smoothness: 0.1 }); const px = frame(p, c, greenScreen); out.chromaOn = [px(10, 10), px(100, 100)]; }
  const white = source((g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 200, 200); });
  { const [p, c] = make(); T.setMask(p, c.id, { shape: 'circle', size: 0.5, x: 0.5, y: 0.5, feather: 0, invert: false }); const px = frame(p, c, white); out.maskIn = [px(100, 100), px(5, 5)]; }
  { const [p, c] = make(); T.setMask(p, c.id, { shape: 'circle', size: 0.5, x: 0.5, y: 0.5, feather: 0, invert: true }); const px = frame(p, c, white); out.maskInverted = [px(100, 100), px(5, 5)]; }
  { const [p, c] = make(); T.setMask(p, c.id, { shape: 'heart', size: 0.8, x: 0.5, y: 0.5, feather: 0.3, invert: false }); const px = frame(p, c, white); out.heart = [px(100, 100), px(2, 2)]; }
  { // picture canvas: a red picture behind a masked clip
    const [p, c] = make();
    const red = new OffscreenCanvas(50, 50); red.getContext('2d').fillStyle = '#ff0000'; red.getContext('2d').fillRect(0, 0, 50, 50);
    const blob = await red.convertToBlob({ type: 'image/png' });
    const root = await navigator.storage.getDirectory(); const m = await root.getDirectoryHandle('media', { create: true }); const d = await m.getDirectoryHandle('p1', { create: true });
    const w = await (await d.getFileHandle('bg', { create: true })).createWritable(); await w.write(blob); await w.close();
    T.setCanvas(p, { kind: 'image', image: 'bg' }, asset('bg', 'bg.png'));
    T.setMask(p, c.id, { shape: 'circle', size: 0.5, x: 0.5, y: 0.5, feather: 0, invert: false });
    await B.prepareCanvasImage(p);
    const px = frame(p, c, white); out.pictureCanvas = [px(100, 100), px(5, 5)];
  }
  return out;
});
await b.close();
srv.kill();
const near = (a, b, tol = 40) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
const checks = [
  ['no key: the green screen shows', near(result.chromaOff[0], [0, 255, 0]) && near(result.chromaOff[1], [221, 34, 34])],
  ['chroma key: the screen turns into the canvas colour, the subject stays', near(result.chromaOn[0], [0, 0, 255]) && near(result.chromaOn[1], [221, 34, 34])],
  ['mask circle: inside shows, outside is the canvas', near(result.maskIn[0], [255, 255, 255]) && near(result.maskIn[1], [0, 0, 255])],
  ['mask inverted: flipped', near(result.maskInverted[0], [0, 0, 255]) && near(result.maskInverted[1], [255, 255, 255])],
  ['mask heart with feather: centre shows, corner is canvas', near(result.heart[0], [255, 255, 255]) && near(result.heart[1], [0, 0, 255])],
  ['picture canvas: shows behind the masked clip', near(result.pictureCanvas[0], [255, 255, 255]) && near(result.pictureCanvas[1], [255, 0, 0])],
  ['no page errors', errors.length === 0],
];
let bad = 0;
for (const [name, ok] of checks) { console.log(ok ? 'ok  ' : 'FAIL', name); bad += ok ? 0 : 1; }
if (bad) { console.log(JSON.stringify(result), errors); process.exit(1); }
