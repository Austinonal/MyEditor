// Export as WebM and as GIF from the export screen, then checks the files with ffprobe.
// Run (after npm run build): node scripts/group4-ui.mjs <clip.webm> <out prefix>
import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';

const [clip, out] = process.argv.slice(2);
const port = 4199;
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 3000));
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const pg = await b.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const errors = [];
pg.on('pageerror', (e) => errors.push(String(e)));
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const probe = (f) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', f]).toString());
await pg.goto(`http://localhost:${port}/`);
const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.getByRole('button', { name: /โปรเจกต์ใหม่/ }).click()]);
await fc.setFiles(clip);
await pg.waitForURL(/#\/edit\//);
await pg.waitForTimeout(2000);
await pg.getByRole('button', { name: 'ส่งออก' }).first().click();
await pg.waitForURL(/#\/export\//);
async function run(format, ext) {
  await pg.getByRole('button', { name: format, exact: true }).or(pg.getByRole('tab', { name: format, exact: true })).first().click();
  await pg.screenshot({ path: `${out}-${ext}-settings.png` });
  await pg.getByRole('button', { name: 'ส่งออก', exact: true }).click();
  await pg.getByText('ส่งออกเสร็จแล้ว').waitFor({ timeout: 180_000 });
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.getByRole('button', { name: 'บันทึกลงเครื่อง' }).click()]);
  const file = `${out}.${ext}`;
  await dl.saveAs(file);
  ok(dl.suggestedFilename().endsWith(`.${ext}`), `${format}: file name ${dl.suggestedFilename()}`);
  await pg.screenshot({ path: `${out}-${ext}-done.png` });
  return probe(file);
}
const webm = await run('WebM', 'webm');
ok(webm.format.format_name.includes('webm') || webm.format.format_name.includes('matroska'), 'WebM container ' + webm.format.format_name);
ok(webm.streams.some((s) => s.codec_type === 'video' && /vp8|vp9|av1/.test(s.codec_name)), 'WebM video codec ' + webm.streams.map((s) => s.codec_name));
ok(webm.streams.some((s) => s.codec_type === 'audio' && /opus|vorbis/.test(s.codec_name)), 'WebM keeps the sound');
const gif = await run('GIF', 'gif');
const v = gif.streams[0];
ok(gif.format.format_name === 'gif' && v.width === 320 && v.height === 568, `GIF ${v.width}x${v.height}`);
const frames = Number(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', `${out}.gif`]).toString().trim());
ok(Math.abs(frames - Number(gif.format.duration) * 12) <= 2 && frames > 90, `GIF frames ${frames} over ${gif.format.duration}s`);
ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
await b.close();
srv.kill();
