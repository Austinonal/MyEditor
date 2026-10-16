// End-to-end check of the core loop (F01..F04) in real Chromium. Run: npm run build && node e2e/flow.mjs
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { statSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const shots = path.resolve(here, '../../replica/web-v1/clone-screens'); mkdirSync(shots, { recursive: true })
const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: path.resolve(here, '..'), stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })
const pg = await ctx.newPage()
const errors = []; pg.on('pageerror', (e) => errors.push(String(e))); pg.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const ok = (c, msg) => { if (!c) throw new Error('FAIL: ' + msg); console.log('ok  ' + msg) }
const proj = () => pg.evaluate(() => new Promise((res) => { const r = indexedDB.open('autocut'); r.onsuccess = () => { const g = r.result.transaction('projects').objectStore('projects').getAll(); g.onsuccess = () => res(g.result[0]) } }))
const pick = async (btn, files) => { const [fc] = await Promise.all([pg.waitForEvent('filechooser'), btn.click()]); await fc.setFiles(files) }
try {
  await pg.goto('http://localhost:4173/'); await pg.waitForSelector('text=วันนี้อยากสร้างอะไร')
  await pg.screenshot({ path: `${shots}/S01-home.png` })
  await pg.getByRole('button', { name: /Auto Cut/ }).click()
  await pick(pg.getByRole('button', { name: 'เลือกคลิปต้นแบบ' }), path.join(here, 'fixtures/reference.webm'))
  await pg.waitForSelector('text=เริ่มวิเคราะห์'); await pg.screenshot({ path: `${shots}/S03-reference.png` })
  await pg.getByRole('button', { name: 'เริ่มวิเคราะห์' }).click()
  await pg.waitForSelector('h1:has-text("โครงร่าง ·")', { timeout: 60000 })
  const scenes = await pg.locator('.scene').count()
  ok(scenes === 4, `reference with 3 cuts becomes 4 empty slots (got ${scenes})`)
  ok((await pg.locator('.scene.empty').count()) === 4, 'all slots start empty')
  await pg.screenshot({ path: `${shots}/S05-review-empty.png` })
  await pick(pg.getByRole('button', { name: /เพิ่มสื่อของคุณ/ }), path.join(here, 'fixtures/photo.png'))
  await pg.waitForFunction(() => document.querySelectorAll('.scene.empty').length === 3)
  ok(true, '1 photo vs 4 scenes: 1 filled, 3 empty blocks')
  await pg.screenshot({ path: `${shots}/S05-review.png` })
  await pg.getByRole('button', { name: 'เปิดในตัวตัดต่อ' }).click()
  await pg.waitForSelector('.slot')
  const slot = pg.locator('.slot'); ok((await slot.count()) === 4, 'editor shows 4 slots')
  const w0 = (await slot.nth(1).boundingBox()).width
  await slot.nth(1).click()
  const h = pg.locator('.h').last(); const hb = await h.boundingBox()
  await pg.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await pg.mouse.down(); await pg.mouse.move(hb.x + hb.width / 2 + 60, hb.y + hb.height / 2, { steps: 6 }); await pg.mouse.up()
  const w1 = (await slot.nth(1).boundingBox()).width
  ok(w1 > w0 + 30, `dragging the handle resizes the slot (${w0.toFixed(0)} -> ${w1.toFixed(0)}px, never locked)`)
  await slot.nth(1).focus(); await pg.keyboard.press('Shift+ArrowLeft')
  ok((await slot.nth(1).boundingBox()).width < w1, 'keyboard arrows resize too')
  await pg.getByRole('button', { name: 'เลิกทำ' }).click(); await pg.getByRole('button', { name: 'เลิกทำ' }).click()
  ok(Math.abs((await slot.nth(1).boundingBox()).width - w0) < 2, 'undo twice restores the original length')
  // --- beats
  await pg.waitForSelector('text=/ดูดตามบีต 1(19|20|21)/'); ok(true, 'beat tracker reads ~120 BPM from the reference audio')
  await pg.waitForTimeout(600)
  const p0 = await proj(); ok(p0.beats.length >= 10 && Math.abs(p0.beats[1] - p0.beats[0] - 500) < 30 && Math.abs(p0.beats[0] - 200) < 40, `beat grid stored (${p0.beats.length} beats, first at ${p0.beats[0]}ms, spacing ${p0.beats[1] - p0.beats[0]}ms)`)
  await pg.getByRole('button', { name: 'จัดตามบีต' }).click(); await pg.waitForTimeout(600)
  const p1 = await proj(); const sum = (a) => a.reduce((x, y) => x + y.durationMs, 0)
  ok(p1.slots.every((x) => Math.abs((x.durationMs - 0) % 1) === 0) && Math.abs(p1.slots[0].durationMs - 1700) < 60 && sum(p1.slots) === sum(p0.slots), `"จัดตามบีต" snaps cuts to beats and keeps total (${p1.slots.map((x) => x.durationMs).join(', ')})`)
  // --- CapCut-style effects: In / Out / Combo / transition / filter / text
  const fxBtn = (n) => pg.locator('.fxrow').getByRole('button', { name: n, exact: true }).click()
  const tab = (n) => pg.getByRole('tab', { name: n }).click()
  await slot.nth(1).click(); await tab('ทรานซิชัน'); await fxBtn('สไลด์ซ้าย')
  await slot.nth(0).click()
  await tab('เข้า'); await fxBtn('ซูมเข้า'); await tab('ออก'); await fxBtn('เฟดออก'); await tab('คอมโบ'); await fxBtn('ซูมช้า')
  await tab('ฟิลเตอร์'); await fxBtn('ขาวดำ')
  await tab('ข้อความ'); await pg.getByLabel('ข้อความบนวิดีโอ').fill('สวัสดีทะเล')
  await pg.waitForTimeout(900)
  const pj = await proj(); const p2 = pj.slots[0]
  ok(p2.anim.in === 'zoomIn' && p2.anim.out === 'fade' && p2.anim.combo === 'kenburns' && p2.filter === 'bw' && p2.text.content === 'สวัสดีทะเล' && pj.slots[1].trans.type === 'slideLeft', 'in / out / combo / transition / filter / text saved on the slots')
  await pg.getByRole('button', { name: 'หยุด' }).click().catch(() => {})
  const seekAt = async (ms) => { const r = await pg.locator('.ruler').boundingBox(); const pxPerMs = (await pg.locator('.slot').nth(0).boundingBox()).width / p2.durationMs; await pg.mouse.click(r.x + ms * pxPerMs + 2, r.y + 10); await pg.waitForTimeout(500); console.log('   seek', ms, '->', await pg.locator('.time').innerText()) }
  await seekAt(900); await pg.locator('.prev canvas').screenshot({ path: `${shots}/fx-mid-slot-bw-text.png` })
  await tab('ออก'); await fxBtn('ไม่มี') // so the outgoing frame is visible in the transition shot
  await seekAt(p2.durationMs + 100); await pg.locator('.prev canvas').screenshot({ path: `${shots}/fx-transition-slide.png` })
  await pg.getByRole('button', { name: 'เลิกทำ' }).click(); await pg.waitForTimeout(700)
  ok((await proj()).slots[0].anim.out === 'fade', 'undo reverts the last effect change')
  await pg.getByRole('button', { name: 'เล่น' }).click(); await pg.waitForTimeout(600); await pg.screenshot({ path: `${shots}/S06-editor.png` })
  await pg.getByRole('button', { name: 'หยุด' }).click()
  await pg.getByRole('button', { name: /ส่งออก/ }).first().click()
  await pg.waitForSelector('text=มี 3 ช่องว่าง'); ok(true, 'export warns about empty slots')
  await pg.screenshot({ path: `${shots}/S12-export-warn.png` })
  await pg.getByRole('button', { name: 'เริ่มส่งออก' }).click()
  const dl = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.waitForSelector('text=บันทึกไฟล์').then((e) => e.click())]).then((r) => r[0])
  const f = path.join('/tmp', 'e2e-out.' + dl.suggestedFilename().split('.').pop()); await dl.saveAs(f)
  const probe = (await import('node:child_process')).execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', f]).toString()
  ok(probe.includes('audio') && probe.includes('video'), 'exported file has video and the reference soundtrack (audio)')
  ok(statSync(f).size > 5000, `exported file saved (${statSync(f).size} bytes, ${dl.suggestedFilename()})`)
  // reopen from home: autosave
  await pg.goto('http://localhost:4173/'); await pg.waitForSelector('.proj')
  ok((await pg.locator('.proj').count()) === 1, 'draft is listed on home after reload (autosave)')
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''))
  console.log('E2E PASS')
} catch (e) { console.error(String(e)); await pg.screenshot({ path: '/tmp/e2e-fail.png' }); console.error('errors:', errors); process.exitCode = 1 } finally { await b.close(); srv.kill() }
