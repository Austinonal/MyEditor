// Screenshots of the home and editor screens at phone and desktop width, for review. Run: node scripts/screens.mjs <outdir>
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const out = path.resolve(process.argv[2] ?? '../replica/clone-screens/current');
mkdirSync(out, { recursive: true });
const clip = path.resolve('../web-v1/e2e/fixtures/reference.webm');
const port = 4191;
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 3000));
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const errors = [];
for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['web', { width: 1280, height: 800 }]]) {
  const pg = await b.newPage({ viewport });
  pg.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  await pg.goto(`http://localhost:${port}/`);
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${out}/${name}-1-home.png` });
  await pg.getByText('ทำปก (Thumbnail)').click();
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: `${out}/${name}-2-home-thumbnail.png` });
  await pg.getByText('ตัดต่อคลิป').first().click();
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.getByRole('button', { name: /โปรเจกต์ใหม่/ }).click()]);
  await fc.setFiles(clip);
  await pg.waitForURL(/#\/edit\//, { timeout: 30000 });
  await pg.waitForTimeout(3000);
  await pg.screenshot({ path: `${out}/${name}-3-editor.png` });
  await pg.getByText('reference.webm').first().click();
  await pg.waitForTimeout(800);
  await pg.screenshot({ path: `${out}/${name}-4-clip-tools.png` });
  for (const [label, file] of [['ชโครมาคีย์', '5-chroma'], ['มาสก์', '6-mask']]) {
    const btn = pg.getByRole('button', { name: label });
    if (await btn.count()) {
      await btn.first().click();
      await pg.waitForTimeout(500);
      if (label === 'มาสก์') await pg.getByRole('radio', { name: 'หัวใจ' }).click().catch(() => {});
      await pg.waitForTimeout(800);
      await pg.screenshot({ path: `${out}/${name}-${file}.png` });
      await pg.keyboard.press('Escape');
    } else console.log(`${name}: no ${label} button (no clip selected)`);
  }
  await pg.close();
}
await b.close();
srv.kill();
console.log(errors.length ? errors.join('\n') : 'no page errors');
