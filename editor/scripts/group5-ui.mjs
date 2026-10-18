// Google Fonts download and drag & drop of files. Run (after npm run build): node scripts/group5-ui.mjs <out prefix>
// Needs the internet for the font; behind a proxy set HTTPS_PROXY.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const [out] = process.argv.slice(2);
const port = 4200;
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 3000));
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost' } : undefined;
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'], proxy });
const pg = await b.newPage({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
const errors = [];
pg.on('pageerror', (e) => errors.push(String(e)));
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const projects = () => pg.evaluate(() => new Promise((res) => { const r = indexedDB.open('editor'); r.onsuccess = () => { const g = r.result.transaction('projects').objectStore('projects').getAll(); g.onsuccess = () => res(g.result); }; }));
// Drops a picture made in the page, as a file dragged from the computer would arrive.
const dropPicture = (colour, name) => pg.evaluate(async ([colour, name]) => {
  const c = new OffscreenCanvas(320, 240);
  const x = c.getContext('2d');
  x.fillStyle = colour;
  x.fillRect(0, 0, 320, 240);
  const dt = new DataTransfer();
  dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], name, { type: 'image/png' }));
  for (const type of ['dragenter', 'dragover', 'drop']) document.body.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
}, [colour, name]);

await pg.goto(`http://localhost:${port}/`);
await dropPicture('#ff0000', 'red.png');
await pg.waitForURL(/#\/edit\//, { timeout: 15000 });
await pg.waitForTimeout(1500);
ok((await projects()).length === 1, 'dropping a picture on the home page starts a project');
await dropPicture('#0000ff', 'blue.png');
await pg.waitForTimeout(1500);
ok((await projects())[0].tracks[0].clips.length === 2, 'dropping a picture in the editor adds it to the main track');
await pg.screenshot({ path: `${out}-dropped.png` });

await pg.locator('button[aria-pressed="true"]', { hasText: 'blue.png' }).click(); // tapping the selected clip lets go of it, so the main toolbar shows
await pg.getByRole('button', { name: 'ข้อความ', exact: true }).first().click();
await pg.getByRole('button', { name: 'แบบอักษร', exact: true }).click();
await pg.getByRole('button', { name: 'Chakra Petch' }).click();
const textFont = async () => (await projects())[0].tracks.flatMap((t) => t.clips).find((c) => c.kind === 'text')?.style.fontId;
for (let i = 0; i < 60 && !(await textFont())?.startsWith('custom-') && !(await pg.getByRole('alert').count()); i++) await pg.waitForTimeout(500);
const alert = await pg.getByRole('alert').allTextContents();
const fontId = await textFont();
ok(fontId?.startsWith('custom-') && alert.length === 0, `Google font downloaded and applied (${fontId}) ${alert.join(' ')}`);
ok(await pg.evaluate((id) => document.fonts.check(`16px ed-${id}`, 'ก'), fontId), 'the downloaded font has the Thai letters loaded');
await pg.getByRole('textbox', { name: 'ข้อความ' }).fill('ฟอนต์ใหม่ Chakra');
await pg.getByLabel('ชื่อฟอนต์ใน Google Fonts').fill('NoSuchFontAtAll');
await pg.getByRole('button', { name: 'ดาวน์โหลด', exact: true }).click();
ok(await pg.getByRole('alert').filter({ hasText: 'ไม่พบฟอนต์' }).waitFor({ timeout: 15000 }).then(() => true, () => false), 'an unknown font name gets a clear message');
await pg.screenshot({ path: `${out}-fonts.png` });
await pg.getByRole('button', { name: 'อังกฤษ', exact: true }).click();
await pg.getByRole('button', { name: 'Lobster' }).click(); // has no bold cut: falls back to the regular one
for (let i = 0; i < 60 && (await pg.getByRole('button', { name: 'Lobster' }).count()); i++) await pg.waitForTimeout(500);
await pg.waitForTimeout(500);
await pg.waitForTimeout(1000);
ok((await textFont()) !== fontId && (await pg.getByRole('alert').filter({ hasText: 'Lobster' }).count()) === 0, 'a font with only a regular weight downloads too ' + (await pg.getByRole('alert').allTextContents()));
await pg.getByRole('button', { name: 'เสร็จ' }).first().click();
await pg.waitForTimeout(800);
await pg.screenshot({ path: `${out}-font-preview.png` });
ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
await b.close();
srv.kill();
