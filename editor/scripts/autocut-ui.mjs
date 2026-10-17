// "ตัดตามคลิปต้นแบบ" end to end in the app: a project from 3 photos, read the reference, apply, screenshot.
// Run (after npm run build): node scripts/autocut-ui.mjs <reference.webm> <out prefix> <photo>...
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const [ref, out, ...photos] = process.argv.slice(2);
const port = 4195;
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 3000));
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
pg.on('pageerror', (e) => errors.push(String(e)));
await pg.goto(`http://localhost:${port}/`);
const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.getByRole('button', { name: /โปรเจกต์ใหม่/ }).click()]);
await fc.setFiles(photos);
await pg.waitForURL(/#\/edit\//, { timeout: 30000 });
await pg.waitForTimeout(1500);
await pg.getByRole('button', { name: 'เทมเพลต' }).click();
const [fc2] = await Promise.all([pg.waitForEvent('filechooser'), pg.getByRole('button', { name: 'เลือกคลิปต้นแบบ' }).click()]);
await fc2.setFiles(ref);
await pg.getByRole('button', { name: 'ใช้กับโปรเจกต์' }).waitFor({ timeout: 120000 });
await pg.screenshot({ path: `${out}-read.png` });
await pg.getByRole('button', { name: 'ใช้กับโปรเจกต์' }).click();
await pg.waitForTimeout(2500);
await pg.screenshot({ path: `${out}-applied.png` });
const p = await pg.evaluate(() => new Promise((res) => { const r = indexedDB.open('editor'); r.onsuccess = () => { const g = r.result.transaction('projects').objectStore('projects').getAll(); g.onsuccess = () => { const p = g.result[0]; res({ main: p.tracks[0].clips.length, transitions: p.transitions.map((t) => t.presetId), texts: p.tracks.flatMap((t) => t.clips).filter((c) => c.kind === 'text').map((c) => c.text) }); }; }; }));
console.log(JSON.stringify({ ...p, errors }));
await b.close();
srv.kill();
