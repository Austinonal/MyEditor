// End-to-end check of the core loop (F01..F04) in real Chromium. Run: npm run build && node e2e/flow.mjs
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { statSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const shots = path.resolve(here, '../../replica/clone-screens'); mkdirSync(shots, { recursive: true })
const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: path.resolve(here, '..'), stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })
const pg = await ctx.newPage()
const errors = []; pg.on('pageerror', (e) => errors.push(String(e))); pg.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const ok = (c, msg) => { if (!c) throw new Error('FAIL: ' + msg); console.log('ok  ' + msg) }
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
  await pg.getByRole('button', { name: 'เล่น' }).click(); await pg.waitForTimeout(600); await pg.screenshot({ path: `${shots}/S06-editor.png` })
  await pg.getByRole('button', { name: 'หยุด' }).click()
  await pg.getByRole('button', { name: /ส่งออก/ }).first().click()
  await pg.waitForSelector('text=มี 3 ช่องว่าง'); ok(true, 'export warns about empty slots')
  await pg.screenshot({ path: `${shots}/S12-export-warn.png` })
  await pg.getByRole('button', { name: 'เริ่มส่งออก' }).click()
  const dl = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.waitForSelector('text=บันทึกไฟล์').then((e) => e.click())]).then((r) => r[0])
  const f = path.join('/tmp', 'e2e-out.' + dl.suggestedFilename().split('.').pop()); await dl.saveAs(f)
  ok(statSync(f).size > 5000, `exported file saved (${statSync(f).size} bytes, ${dl.suggestedFilename()})`)
  // reopen from home: autosave
  await pg.goto('http://localhost:4173/'); await pg.waitForSelector('.proj')
  ok((await pg.locator('.proj').count()) === 1, 'draft is listed on home after reload (autosave)')
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''))
  console.log('E2E PASS')
} catch (e) { console.error(String(e)); await pg.screenshot({ path: '/tmp/e2e-fail.png' }); console.error('errors:', errors); process.exitCode = 1 } finally { await b.close(); srv.kill() }
