import { useEffect, useState } from 'preact/hooks'
import { Icon } from '../ui/icons'
import { Sheet, Notice } from '../ui/kit'
import { deleteProject, listProjects, putProject } from '../lib/store'
import { importFiles, pickFiles } from '../lib/media'
import { uid, type Project } from '../lib/types'

// Tool registry: a new tool is one entry here; the layout does not change.
const TOOLS = [
  { id: 'autocut', icon: 'wand', title: 'Auto Cut', desc: 'โยนคลิปต้นแบบ ได้โครงร่างพร้อมบล็อกว่าง', main: true },
  { id: 'edit', icon: 'scissors', title: 'ตัดต่อปกติ', desc: 'เริ่มจากรูปหรือคลิปของคุณเอง' },
  { id: 'thumb', icon: 'image', title: 'ปกคลิปอัตโนมัติ', desc: 'โยนปกต้นแบบ ได้เลย์เอาต์พร้อมช่องใส่รูป', soon: true },
]

export function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState<'all' | 'video' | 'thumbnail'>('all')
  const [soon, setSoon] = useState(false)
  const [del, setDel] = useState<Project | null>(null)
  const [err, setErr] = useState<string[]>([])
  const load = () => listProjects().then(setProjects)
  useEffect(() => { load() }, [])

  const open = async (id: string) => {
    if (id === 'autocut') location.hash = '#/ref'
    else if (id === 'thumb') setSoon(true)
    else {
      const r = await importFiles(await pickFiles(true)); setErr(r.rejected)
      if (!r.media.length) return
      const p: Project = { id: uid(), name: 'โปรเจกต์ใหม่', kind: 'video', aspect: '9:16', referenceId: null, scenes: [], updatedAt: 0,
        slots: r.media.map((m, i) => ({ id: uid(), sceneIdx: i, durationMs: m.kind === 'image' ? 2000 : Math.min(m.durationMs, 5000), mediaId: m.id, inMs: 0 })) }
      await putProject(p); location.hash = `#/edit/${p.id}`
    }
  }
  const shown = projects.filter((p) => filter === 'all' || p.kind === filter)

  return (
    <>
      <div class="page">
        <div class="top"><h1>AutoCut</h1></div>
        <h1 class="big">วันนี้อยากสร้างอะไร</h1><p class="sub">เลือกเครื่องมือ แล้วเริ่มจากต้นแบบหรือเริ่มเอง</p>
        <section aria-label="เครื่องมือ"><div class="tools">{TOOLS.map((t) => (
          <button key={t.id} class={`tool ${t.main ? 'main' : ''} ${t.soon ? 'soon' : ''}`} onClick={() => open(t.id)}>
            <span class="ic"><Icon n={t.icon} /></span><span><b>{t.title}</b><span class="d">{t.desc}</span></span>{t.soon && <span class="badge">เร็วๆ นี้</span>}
          </button>))}</div></section>
        {err.length > 0 && <Notice err>เปิดไฟล์เหล่านี้ไม่ได้: {err.join(', ')}</Notice>}
        <h2>ล่าสุด</h2>
        <div class="chips" role="group" aria-label="กรองประเภท">{([['all', 'ทั้งหมด'], ['video', 'วิดีโอ'], ['thumbnail', 'ปกคลิป']] as const).map(([k, l]) => (
          <button key={k} class="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>))}</div>
        {shown.length === 0 ? <p class="muted">ยังไม่มีโปรเจกต์ เลือกเครื่องมือด้านบนเพื่อเริ่มสร้าง</p> : (
          <div class="grid">{shown.map((p) => {
            const empty = p.slots.filter((s) => !s.mediaId).length
            const first = p.scenes[0]?.thumb
            return (
              <div class="proj" key={p.id}>
                <a href={`#/${p.slots.length ? 'edit' : 'analyze'}/${p.id}`} style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
                  <div class={'th' + (p.kind === 'thumbnail' ? ' t' : '')} style={first ? { backgroundImage: `url(${first})` } : {}}><span class="kind"><Icon n={p.kind === 'video' ? 'film' : 'image'} />{p.kind === 'video' ? 'วิดีโอ' : 'ปกคลิป'}</span></div>
                  <div class="m">{p.name}<small>{p.slots.length} สล็อต{empty ? ` · เหลือ ${empty} ช่องว่าง` : ' · พร้อมส่งออก'}</small></div>
                </a>
                <button class="ib del" aria-label={`ลบ ${p.name}`} onClick={() => setDel(p)}><Icon n="trash" /></button>
              </div>)
          })}</div>)}
      </div>
      <nav class="nav" aria-label="เมนูหลัก"><a class="on" href="#/"><Icon n="home" />หน้าแรก</a><a href="#/"><Icon n="film" />โปรเจกต์</a></nav>
      {soon && <Sheet title="ปกคลิปอัตโนมัติ" onClose={() => setSoon(false)}><p class="muted">เครื่องมือนี้ยังไม่เปิดใช้งาน ตอนนี้ลอง Auto Cut หรือตัดต่อปกติได้ก่อน</p><button class="btn block" onClick={() => setSoon(false)}>เข้าใจแล้ว</button></Sheet>}
      {del && <Sheet title="ลบโปรเจกต์นี้?" onClose={() => setDel(null)}><p class="muted">"{del.name}" จะถูกลบถาวร ไฟล์สื่อต้นฉบับในเครื่องคุณไม่ถูกลบ</p>
        <div class="footer"><button class="btn danger block" onClick={async () => { await deleteProject(del.id); setDel(null); load() }}>ลบ</button><button class="btn sec block" onClick={() => setDel(null)}>ยกเลิก</button></div></Sheet>}
    </>
  )
}
