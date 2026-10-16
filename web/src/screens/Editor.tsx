import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { Icon } from '../ui/icons'
import { MediaSheet } from '../ui/MediaSheet'
import { Notice, Sheet, Top, fmt } from '../ui/kit'
import { getBlob, getMedia, getProject, listMedia, putProject } from '../lib/store'
import { Player } from '../lib/player'
import { exportProject, exportMime } from '../lib/exporter'
import { moveBoundary, remove, slotAt, snapTime, split, starts, total, MIN_SLOT_MS } from '../lib/timeline'
import { ASPECT_SIZE, uid, type Aspect, type Media, type Project, type Slot } from '../lib/types'

const SNAP_PX = 10
const TICKS = [0.5, 1, 2, 5, 10, 30]

export function Editor({ id }: { id: string }) {
  const [p, setP] = useState<Project>()
  const [media, setMedia] = useState<Record<string, Media>>({})
  const [sel, setSel] = useState<number | null>(null)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [snap, setSnap] = useState(true)
  const [ripple, setRipple] = useState(true)
  const [ppm, setPpm] = useState(0.08) // px per ms
  const [pick, setPick] = useState(false)
  const [exp, setExp] = useState<null | 'ask' | 'run' | 'done' | 'err'>(null)
  const [expP, setExpP] = useState(0)
  const [out, setOut] = useState<{ url: string; ext: string } | null>(null)
  const [toast, setToast] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const player = useRef<Player>()
  const slotsRef = useRef<Slot[]>([])
  const history = useRef<Slot[][]>([])
  const drag = useRef<{ b: number; x0: number; base: Slot[]; t0: number } | null>(null)
  const ctl = useRef<AbortController>()

  const reloadMedia = async () => setMedia(Object.fromEntries((await listMedia()).map((m) => [m.id, m])))
  useEffect(() => { getProject(id).then(setP); reloadMedia() }, [id])
  useEffect(() => { if (p) slotsRef.current = p.slots }, [p])

  // player lifecycle
  useEffect(() => {
    if (!p || !canvas.current || player.current) return
    const pl = new Player(canvas.current, () => slotsRef.current)
    pl.onTick = setT; pl.onEnd = () => setPlaying(false)
    player.current = pl
    return () => { pl.dispose(); player.current = undefined }
  }, [!!p])
  const mediaKey = p ? p.slots.map((s) => s.mediaId ?? '-').join(',') : ''
  useEffect(() => {
    const pl = player.current; if (!pl || !p) return
    const ids = [...new Set(p.slots.map((s) => s.mediaId).filter((x): x is string => !!x))]
    Promise.all(ids.map(async (i) => ({ media: (await getMedia(i))!, blob: (await getBlob(i))! }))).then(async (items) => { await pl.load(items.filter((x) => x.media && x.blob)); pl.seek(pl.t) })
  }, [mediaKey, p?.aspect, !!p])
  useEffect(() => { player.current?.seek(player.current.t) }, [p?.slots])

  // autosave (debounced) and flush on leave
  const dirty = useRef<Project>()
  useEffect(() => { if (!p || p === dirty.current) return; const h = setTimeout(() => putProject(p), 300); return () => clearTimeout(h) }, [p])
  useEffect(() => () => { if (dirty.current) putProject(dirty.current) }, [])
  useEffect(() => { dirty.current = p }, [p])

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }
  if (!p) return <div class="page"><Top title="ตัดต่อ" /></div>

  const slots = p.slots
  const st = starts(slots), len = total(slots)
  const setSlots = (next: Slot[], record = true) => {
    if (record) { history.current.push(slots); if (history.current.length > 50) history.current.shift() }
    setP({ ...p, slots: next }); slotsRef.current = next
  }
  const undo = () => { const h = history.current.pop(); if (h) { setP({ ...p, slots: h }); slotsRef.current = h; setSel((s) => (s !== null && s >= h.length ? null : s)) } else flash('ไม่มีอะไรให้เลิกทำ') }
  const toggle = () => { const pl = player.current!; if (pl.playing) { pl.pause(); setPlaying(false) } else { pl.play(); setPlaying(true) } }
  const snapPts = useMemo(() => p.scenes.map((s) => s.endMs).slice(0, -1), [p.scenes])

  // --- drag a boundary (right edge of slot b). Left handle of slot i is boundary i-1.
  const down = (b: number) => (e: PointerEvent) => {
    e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    history.current.push(slots)
    drag.current = { b, x0: e.clientX, base: slots, t0: starts(slots)[b] + slots[b].durationMs }
  }
  const moveH = (e: PointerEvent) => {
    const d = drag.current; if (!d) return
    let target = d.t0 + (e.clientX - d.x0) / ppm
    if (snap) target = snapTime(target, snapPts, SNAP_PX / ppm)
    const next = moveBoundary(d.base, d.b, target - d.t0, ripple)
    setP((q) => q && { ...q, slots: next }); slotsRef.current = next
  }
  const up = () => { drag.current = null }
  const key = (i: number) => (e: KeyboardEvent) => {
    const step = e.shiftKey ? 500 : 100
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setSlots(moveBoundary(slots, i, e.key === 'ArrowRight' ? step : -step, ripple)) }
    if (e.key === 'Delete') { e.preventDefault(); setSlots(remove(slots, i)); setSel(null) }
  }

  const s = sel !== null ? slots[sel] : undefined
  const sm = s?.mediaId ? media[s.mediaId] : undefined
  const step = TICKS.find((x) => x * 1000 * ppm >= 64) ?? 30
  const ticks = Array.from({ length: Math.floor(len / (step * 1000)) + 2 }, (_, k) => k * step)
  const emptyCount = slots.filter((x) => !x.mediaId).length
  const [cw, ch] = ASPECT_SIZE[p.aspect]

  const startExport = async () => {
    setExp('run'); setExpP(0); player.current?.pause(); setPlaying(false)
    const c = (ctl.current = new AbortController())
    try { const r = await exportProject(p, setExpP, c.signal); setOut({ url: URL.createObjectURL(r.blob), ext: r.ext }); setExp('done') }
    catch (e) { setExp((e as Error).name === 'AbortError' ? null : 'err') }
  }

  return (
    <div class="ed">
      <Top title={p.name} back="#/" right={<>
        <button class="ib" aria-label="เลิกทำ" onClick={undo}><Icon n="undo" /></button>
        <select aria-label="สัดส่วน" value={p.aspect} onChange={(e) => setP({ ...p, aspect: (e.target as HTMLSelectElement).value as Aspect })}>{['9:16', '1:1', '4:5', '16:9'].map((a) => <option key={a}>{a}</option>)}</select>
        <button class="btn sm" disabled={!slots.length} onClick={() => setExp('ask')}><Icon n="upload" />ส่งออก</button></>} />
      <div class="prev"><canvas ref={canvas} width={cw / 2} height={ch / 2} style={{ aspectRatio: `${cw}/${ch}` }} aria-label="ตัวอย่างวิดีโอ" /></div>
      <div class="ctrl">
        <div class="transport"><button class="ib" aria-label={playing ? 'หยุด' : 'เล่น'} onClick={toggle} disabled={!slots.length}><Icon n={playing ? 'pause' : 'play'} /></button><span class="time">{fmt(t)} / {fmt(len)}</span>
          <span style={{ flex: 1 }} /><button class="ib" aria-label="ซูมออก" onClick={() => setPpm((z) => Math.max(z / 1.5, 0.02))}><Icon n="zout" /></button><button class="ib" aria-label="ซูมเข้า" onClick={() => setPpm((z) => Math.min(z * 1.5, 0.4))}><Icon n="zin" /></button></div>
        <div class="opts"><button class="chip" aria-pressed={snap} onClick={() => setSnap(!snap)}><Icon n="magnet" />ดูดตามต้นแบบ</button><button class="chip" aria-pressed={ripple} onClick={() => setRipple(!ripple)}><Icon n="ripple" />เลื่อนตาม</button>
          <button class="chip" onClick={() => setSlots([...slots, { id: uid(), sceneIdx: slots.length, durationMs: 2000, mediaId: null, inMs: 0 }])}><Icon n="plus" />สล็อตว่าง</button></div>
      </div>
      <div class="tl"><div class="tl-in"><div style={{ position: 'relative', width: len * ppm + 48 }}>
        <div class="ruler" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); player.current?.seek((e.clientX - r.left) / ppm) }}>{ticks.map((x) => <span key={x} style={{ left: x * 1000 * ppm }}>{x}s</span>)}</div>
        <div class="lane">{slots.map((x, i) => {
          const m = x.mediaId ? media[x.mediaId] : undefined
          return (
            <button key={x.id} class={'slot' + (m ? '' : ' e') + (sel === i ? ' s' : '')} style={{ left: st[i] * ppm, width: Math.max(x.durationMs * ppm - 3, 28), ...(m ? { backgroundImage: `url(${m.thumb})` } : {}) }}
              aria-label={`ฉาก ${i + 1} ${m ? m.name : 'ว่าง'} ยาว ${fmt(x.durationMs)} วินาที ใช้ลูกศรซ้ายขวาเพื่อปรับความยาว`} aria-pressed={sel === i}
              onClick={() => { setSel(i); player.current?.seek(st[i]) }} onKeyDown={key(i)}>
              {!m && <Icon n="plus" />}<span>{i + 1}</span>
            </button>)
        })}
          {sel !== null && slots[sel] && <>
            {sel > 0 && <div class="h" style={{ left: st[sel] * ppm - 12 }} onPointerDown={down(sel - 1)} onPointerMove={moveH} onPointerUp={up} aria-hidden="true"><i /></div>}
            <div class="h" style={{ left: (st[sel] + slots[sel].durationMs) * ppm - 14 }} onPointerDown={down(sel)} onPointerMove={moveH} onPointerUp={up} aria-hidden="true"><i /></div></>}
        </div>
        <div class="cuts">{snap && snapPts.map((x) => <i key={x} style={{ left: x * ppm, top: 'var(--l-ruler)', height: 'var(--l-timeline-row)' }} />)}</div>
        <div class="ph" style={{ left: t * ppm }} />
      </div></div></div>
      <div class="panel" aria-live="polite">
        {!s ? <span class="muted small">แตะสล็อตเพื่อแก้ไข ลากที่จับสองข้างเพื่อปรับความยาว หรือใช้ลูกศรซ้ายขวา</span> : <>
          <b>ฉาก {sel! + 1}</b><span class="muted small">{fmt(s.durationMs)} วิ</span>
          <button class="btn sec sm" onClick={() => setPick(true)}><Icon n="image" />{sm ? 'เปลี่ยนสื่อ' : 'เติมสื่อ'}</button>
          <button class="btn sec sm" onClick={() => setSlots(split(slots, sel!, t - st[sel!]))} disabled={t - st[sel!] < MIN_SLOT_MS || st[sel!] + s.durationMs - t < MIN_SLOT_MS}><Icon n="scissors" />แบ่งตรงเพลย์เฮด</button>
          <button class="btn sec sm" onClick={() => { setSlots(remove(slots, sel!)); setSel(null) }}><Icon n="trash" />ลบ</button>
          {sm?.kind === 'video' && <label class="small muted" style={{ display: 'flex', gap: 8, alignItems: 'center', flex: '1 1 100%' }}>เริ่มที่ {fmt(s.inMs)}
            <input type="range" min={0} max={Math.max(sm.durationMs - s.durationMs, 0)} step={100} value={s.inMs} aria-label="จุดเริ่มของคลิปในสล็อต"
              onInput={(e) => setSlots(slots.map((x, k) => (k === sel ? { ...x, inMs: +(e.target as HTMLInputElement).value } : x)), false)} onChange={() => history.current.push(slots)} /></label>}
        </>}
      </div>
      {pick && s && <MediaSheet title={`เลือกสื่อสำหรับฉาก ${sel! + 1}`} onClose={() => setPick(false)} onPick={async (m) => { setSlots(slots.map((x, k) => (k === sel ? { ...x, mediaId: m.id, inMs: 0 } : x))); await reloadMedia(); setPick(false) }} />}
      {exp && <Sheet title="ส่งออกวิดีโอ" onClose={() => { if (exp !== 'run') setExp(null) }}>
        {exp === 'ask' && <>
          {!exportMime() && <Notice err>เบราว์เซอร์นี้ส่งออกวิดีโอไม่ได้ ลองใช้ Chrome</Notice>}
          {emptyCount > 0 && <Notice>มี {emptyCount} ช่องว่าง จะส่งออกเป็นจอดำ ตรวจดูก่อนหรือเติมให้ครบ</Notice>}
          <p class="muted small">{p.aspect} · {cw}×{ch} · ใช้เวลาเท่าความยาวคลิป ({fmt(len)}) ส่งออกยังไม่มีเสียงในเวอร์ชันนี้ ไฟล์อยู่ในเครื่องคุณเท่านั้น</p>
          <div class="footer"><button class="btn block" disabled={!exportMime()} onClick={startExport}>เริ่มส่งออก</button><button class="btn sec block" onClick={() => setExp(null)}>{emptyCount ? 'กลับไปเติมสื่อ' : 'ยกเลิก'}</button></div></>}
        {exp === 'run' && <><div class="bar" role="progressbar" aria-valuenow={Math.round(expP * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: expP * 100 + '%' }} /></div><p class="muted small">กำลังส่งออก {Math.round(expP * 100)}% อย่าปิดหน้านี้</p><button class="btn sec block" onClick={() => ctl.current?.abort()}>ยกเลิก</button></>}
        {exp === 'done' && out && <><Notice>ส่งออกเสร็จแล้ว</Notice><div class="footer"><a class="btn block" href={out.url} download={`${p.name}.${out.ext}`}><Icon n="upload" />บันทึกไฟล์ .{out.ext}</a><button class="btn sec block" onClick={() => setExp(null)}>ปิด</button></div></>}
        {exp === 'err' && <><Notice err>ส่งออกไม่สำเร็จ ลองใหม่อีกครั้ง</Notice><button class="btn block" onClick={startExport}>ลองใหม่</button></>}
      </Sheet>}
      {toast && <div class="toast" role="status">{toast}</div>}
    </div>
  )
}
