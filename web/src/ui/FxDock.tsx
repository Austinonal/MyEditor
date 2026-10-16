import { useState } from 'preact/hooks'
import { COMBO, FILTERS, IN, OUT, TRANS } from '../lib/anim'
import type { Slot, TextOverlay } from '../lib/types'

type Tab = 'in' | 'out' | 'combo' | 'trans' | 'filter' | 'text' | 'speed'
const TABS: [Tab, string][] = [['in', 'เข้า'], ['out', 'ออก'], ['combo', 'คอมโบ'], ['trans', 'ทรานซิชัน'], ['filter', 'ฟิลเตอร์'], ['text', 'ข้อความ'], ['speed', 'ความเร็ว']]
const SPEEDS = [0.5, 1, 1.5, 2, 3]
const COLORS = ['#ffffff', '#ffd23f', '#ff6b6b', '#4cd28a', '#000000']
const DEF_TEXT: TextOverlay = { content: '', pos: 'bottom', size: 64, color: '#ffffff', anim: 'fade' }

/** CapCut-style effects dock: In / Out / Combo animations, transition, filter, text, speed. */
export function FxDock({ slot, isVideo, onPatch }: { slot: Slot; isVideo: boolean; onPatch: (f: (s: Slot) => Slot, opts?: { record?: boolean; preview?: boolean }) => void }) {
  const [tab, setTab] = useState<Tab>('in')
  const a = slot.anim ?? {}
  const setAnim = (k: 'in' | 'out' | 'combo', v: string) => onPatch((s) => ({ ...s, anim: { ...s.anim, [k]: v } }), { preview: true })
  const chip = (id: string, label: string, on: boolean, click: () => void) => <button key={id} class="chip" aria-pressed={on} onClick={click}>{label}</button>
  const range = (label: string, min: number, max: number, step: number, val: number, set: (v: number) => void, unit = 'ms') => (
    <label class="small muted fxrange">{label} {val}{unit}
      <input type="range" min={min} max={max} step={step} value={val} aria-label={label} onInput={(e) => set(+(e.target as HTMLInputElement).value)} onPointerDown={() => onPatch((s) => s, { record: true })} onKeyDown={() => onPatch((s) => s, { record: true })} /></label>)
  const half = Math.max(Math.floor(slot.durationMs / 2 / 50) * 50, 100)
  return (
    <div class="fx">
      <div class="fxtabs" role="tablist" aria-label="เอฟเฟกต์">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} class="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div class="fxbody">
        {tab === 'in' && <><div class="fxrow">{IN.map(([id, l]) => chip(id, l, (a.in ?? 'none') === id, () => setAnim('in', id)))}</div>
          {a.in && a.in !== 'none' && range('ความยาว', 100, half, 50, Math.min(a.inMs ?? 500, half), (v) => onPatch((s) => ({ ...s, anim: { ...s.anim, inMs: v } }), { record: false }))}</>}
        {tab === 'out' && <><div class="fxrow">{OUT.map(([id, l]) => chip(id, l, (a.out ?? 'none') === id, () => setAnim('out', id)))}</div>
          {a.out && a.out !== 'none' && range('ความยาว', 100, half, 50, Math.min(a.outMs ?? 500, half), (v) => onPatch((s) => ({ ...s, anim: { ...s.anim, outMs: v } }), { record: false }))}</>}
        {tab === 'combo' && <div class="fxrow">{COMBO.map(([id, l]) => chip(id, l, (a.combo ?? 'none') === id, () => setAnim('combo', id)))}</div>}
        {tab === 'trans' && <><div class="fxrow">{TRANS.map(([id, l]) => chip(id, l, (slot.trans?.type ?? 'none') === id, () => onPatch((s) => ({ ...s, trans: { type: id, ms: s.trans?.ms ?? 500 } }), { preview: true })))}</div>
          {slot.trans && slot.trans.type !== 'none' && range('ความยาว', 100, Math.min(1500, slot.durationMs - 100), 50, Math.min(slot.trans.ms, slot.durationMs - 100), (v) => onPatch((s) => ({ ...s, trans: { type: s.trans?.type ?? 'fade', ms: v } }), { record: false }))}
          <span class="small muted">ใช้ระหว่างฉากก่อนหน้ากับฉากนี้</span></>}
        {tab === 'filter' && <div class="fxrow">{FILTERS.map(([id, l]) => chip(id, l, (slot.filter ?? 'none') === id, () => onPatch((s) => ({ ...s, filter: id }))))}</div>}
        {tab === 'text' && (() => {
          const t = slot.text ?? DEF_TEXT
          const set = (patch: Partial<TextOverlay>, record = true) => onPatch((s) => ({ ...s, text: { ...(s.text ?? DEF_TEXT), ...patch } }), { record })
          return <>
            <input id="fx-text" class="fxinput" placeholder="พิมพ์ข้อความ" aria-label="ข้อความบนวิดีโอ" value={t.content} maxLength={80} onInput={(e) => set({ content: (e.target as HTMLInputElement).value }, false)} />
            <div class="fxrow">{([['top', 'บน'], ['center', 'กลาง'], ['bottom', 'ล่าง']] as const).map(([id, l]) => chip(id, l, t.pos === id, () => set({ pos: id })))}
              {COLORS.map((c) => <button key={c} class="chip swatch" aria-label={`สี ${c}`} aria-pressed={t.color === c} style={{ background: c }} onClick={() => set({ color: c })} />)}</div>
            <div class="fxrow">{['none', 'fade', 'pop', 'slideUp', 'zoomIn'].map((id) => chip(id, ({ none: 'ไม่มี', fade: 'เฟด', pop: 'เด้ง', slideUp: 'สไลด์ขึ้น', zoomIn: 'ซูมเข้า' } as Record<string, string>)[id], (t.anim ?? 'none') === id, () => set({ anim: id })))}</div>
            {range('ขนาด', 24, 160, 4, t.size, (v) => set({ size: v }, false), 'px')}
            {slot.text && <button class="chip" onClick={() => onPatch((s) => ({ ...s, text: undefined }))}>ลบข้อความ</button>}</>
        })()}
        {tab === 'speed' && (isVideo ? <><div class="fxrow">{SPEEDS.map((v) => chip(String(v), `${v}x`, (slot.speed ?? 1) === v, () => onPatch((s) => ({ ...s, speed: v }))))}</div><span class="small muted">เร่งหรือหน่วงการเล่นคลิปในสล็อต ความยาวสล็อตเท่าเดิม</span></> : <span class="small muted">ใช้ได้กับคลิปวิดีโอเท่านั้น</span>)}
      </div>
    </div>
  )
}
