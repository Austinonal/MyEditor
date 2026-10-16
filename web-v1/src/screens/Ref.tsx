import { useState } from 'preact/hooks'
import { Icon } from '../ui/icons'
import { Notice, Top, fmt } from '../ui/kit'
import { importFiles, pickFiles } from '../lib/media'
import { putProject } from '../lib/store'
import { MAX_REF_MS } from '../lib/sampler'
import { uid, type Aspect, type Media } from '../lib/types'

export function Ref() {
  const [ref, setRef] = useState<Media | null>(null)
  const [err, setErr] = useState('')
  const [aspect, setAspect] = useState<Aspect>('9:16')

  const choose = async () => {
    const r = await importFiles(await pickFiles(false, 'video/*'))
    if (!r.media.length) { if (r.rejected.length) setErr('เปิดไฟล์นี้ไม่ได้ ลองไฟล์ MP4 หรือ WebM'); return }
    setErr(''); setRef(r.media[0]); setAspect(r.media[0].w > r.media[0].h ? '16:9' : '9:16')
  }
  const start = async () => {
    if (!ref) return
    const id = uid()
    await putProject({ id, name: ref.name.replace(/\.[^.]+$/, '') || 'โปรเจกต์ใหม่', kind: 'video', aspect, referenceId: ref.id, scenes: [], slots: [], updatedAt: 0 })
    location.hash = `#/analyze/${id}`
  }
  return (
    <div class="page">
      <Top title="เลือกคลิปต้นแบบ" />
      <p class="sub">คลิปที่อยากตัดตาม เราจะวิเคราะห์ฉากแล้ววางโครงร่างให้ ไฟล์อยู่ในเครื่องคุณเท่านั้น ไม่ถูกอัปโหลด</p>
      {err && <Notice err>{err}</Notice>}
      {!ref ? (
        <div class="drop"><Icon n="film" /><b>ยังไม่ได้เลือกคลิป</b><button class="btn" onClick={choose}><Icon n="upload" />เลือกคลิปต้นแบบ</button></div>
      ) : (
        <>
          <div class="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div class="scene" style={{ margin: 0, padding: 0, background: 'none' }}><div class="st" style={{ backgroundImage: `url(${ref.thumb})` }} /></div>
            <div style={{ flex: 1, minWidth: 0 }}><b>{ref.name}</b><div class="muted small">{fmt(ref.durationMs)} · {ref.w}×{ref.h}</div></div>
            <button class="btn sec sm" onClick={choose}>เปลี่ยน</button>
          </div>
          {ref.durationMs > MAX_REF_MS && <Notice>คลิปยาวเกิน 3 นาที เราจะวิเคราะห์เฉพาะ 3 นาทีแรก</Notice>}
          <h2>สัดส่วนวิดีโอที่ต้องการ</h2>
          <div class="chips" role="group" aria-label="สัดส่วน">{(['9:16', '1:1', '4:5', '16:9'] as Aspect[]).map((a) => <button key={a} class="chip" aria-pressed={aspect === a} onClick={() => setAspect(a)}>{a}</button>)}</div>
          <div class="footer"><button class="btn block" onClick={start}><Icon n="wand" />เริ่มวิเคราะห์</button></div>
        </>
      )}
    </div>
  )
}
