import { useEffect, useState } from 'preact/hooks'
import { Icon } from '../ui/icons'
import { MediaSheet } from '../ui/MediaSheet'
import { Notice, Top, fmt } from '../ui/kit'
import { getProject, listMedia, putProject } from '../lib/store'
import { importFiles, pickFiles } from '../lib/media'
import { autoFill } from '../lib/skeleton'
import type { Media, Project } from '../lib/types'

export function Review({ id }: { id: string }) {
  const [p, setP] = useState<Project>()
  const [media, setMedia] = useState<Record<string, Media>>({})
  const [pick, setPick] = useState<number | null>(null)
  const [bad, setBad] = useState<string[]>([])
  const reload = async () => { setP(await getProject(id)); const m = await listMedia(); setMedia(Object.fromEntries(m.map((x) => [x.id, x]))) }
  useEffect(() => { reload() }, [id])
  if (!p) return <div class="page"><Top title="โครงร่าง" /></div>

  const save = async (next: Project) => { await putProject(next); setP(next) }
  const addMany = async () => {
    const r = await importFiles(await pickFiles(true)); setBad(r.rejected); await reload()
    if (r.media.length) await save({ ...p, slots: autoFill(p.slots, r.media.map((m) => m.id)) })
  }
  const empty = p.slots.filter((s) => !s.mediaId).length
  const filled = p.slots.length - empty

  return (
    <div class="page">
      <Top title={`โครงร่าง · ${p.slots.length} ฉาก`} back="#/ref" />
      {p.slots.length === 0 ? <Notice err>ไม่พบฉากในคลิปนี้ ลองคลิปที่มีการตัดต่อหลายฉาก</Notice> :
        empty > 0 ? <Notice>ต้นแบบใช้ {p.slots.length} ฉาก คุณใส่แล้ว {filled} ฉาก เติมช่องว่างทีหลังได้ และลากปรับความยาวได้ทุกช่อง</Notice> : <Notice>ใส่สื่อครบทุกฉากแล้ว ปรับความยาวในตัวตัดต่อได้</Notice>}
      {bad.length > 0 && <Notice err>เปิดไฟล์เหล่านี้ไม่ได้: {bad.join(', ')}</Notice>}
      <button class="btn sec block" onClick={addMany}><Icon n="upload" />เพิ่มสื่อของคุณ (เติมตามลำดับ)</button>
      <h2>ฉาก</h2>
      {p.slots.map((s, i) => {
        const m = s.mediaId ? media[s.mediaId] : undefined
        const th = m?.thumb ?? undefined
        return (
          <div class={'scene' + (m ? '' : ' empty')} key={s.id}>
            <div class="st" style={th ? { backgroundImage: `url(${th})` } : {}}>{!m && <Icon n="plus" />}</div>
            <div class="info"><b>ฉาก {i + 1}{m ? '' : ' ว่าง'}</b><div class="muted small">{fmt(s.durationMs)} วิ{m ? ` · ${m.name}` : ''}</div></div>
            <button class="btn sec sm" onClick={() => setPick(i)}>{m ? 'เปลี่ยน' : 'เติม'}</button>
          </div>)
      })}
      <div class="footer"><button class="btn block" disabled={!p.slots.length} onClick={() => (location.hash = `#/edit/${id}`)}><Icon n="film" />เปิดในตัวตัดต่อ</button></div>
      {pick !== null && <MediaSheet title={`เลือกสื่อสำหรับฉาก ${pick + 1}`} onClose={() => setPick(null)} onPick={async (m) => {
        await save({ ...p, slots: p.slots.map((s, k) => (k === pick ? { ...s, mediaId: m.id, inMs: 0 } : s)) }); await reload(); setPick(null) }} />}
    </div>
  )
}
