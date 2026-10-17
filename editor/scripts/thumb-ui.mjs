// "ทำตามรูปต้นแบบ" end to end in the app: pick a reference picture, wait for the editor, screenshot it.
// Run (after npm run build): node scripts/thumb-ui.mjs <reference.png> <out.png>
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const [ref, out] = process.argv.slice(2);
const port = 4193;
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 3000));
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
pg.on('pageerror', (e) => errors.push(String(e)));
await pg.goto(`http://localhost:${port}/`);
await pg.getByText('ทำปก (Thumbnail)').click();
const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.getByRole('button', { name: /ทำตามรูปต้นแบบ/ }).click()]);
await fc.setFiles(ref);
await pg.waitForURL(/#\/edit\//, { timeout: 90000 });
await pg.waitForTimeout(4000);
await pg.screenshot({ path: out });
const clips = await pg.evaluate(() => new Promise((res) => { const r = indexedDB.open('editor'); r.onsuccess = () => { const g = r.result.transaction('projects').objectStore('projects').getAll(); g.onsuccess = () => { const p = g.result[0]; res(p.tracks.flatMap((t) => t.clips.map((c) => [t.kind, p.assets[c.assetId]?.name ?? c.text, c.assetId ? p.assets[c.assetId].width + 'x' + p.assets[c.assetId].height : '', c.transform && [c.transform.x.toFixed(2), c.transform.y.toFixed(2), c.transform.scale.toFixed(2)].join(','), c.cutout?.bg ?? '', !!p.assets[c.assetId]?.placeholder]))); }; }; }));
console.log(clips.map((c) => c.join(' | ')).join('\n'));
const layers = await pg.locator('text=/ช่อง|ข้อความ|TOP|รีวิว|NEW/').count();
console.log(JSON.stringify({ layers, errors }));
await b.close();
srv.kill();
