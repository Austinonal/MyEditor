import { useEffect, useState } from 'preact/hooks'
import { Sheet, Notice, fmt } from './kit'
import { Icon } from './icons'
import { listMedia } from '../lib/store'
import { importFiles, pickFiles } from '../lib/media'
import type { Media } from '../lib/types'

/** Pick from already imported media, or import new files. Used by Review and Editor. */
export function MediaSheet({ title, onPick, onClose, exclude = [] }: { title: string; onPick: (m: Media) => void; onClose: () => void; exclude?: string[] }) {
  const [items, setItems] = useState<Media[]>([])
  const [bad, setBad] = useState<string[]>([])
  const refresh = () => listMedia().then((m) => setItems(m.filter((x) => !exclude.includes(x.id))))
  useEffect(() => { refresh() }, [])
  const add = async () => {
    const r = await importFiles(await pickFiles(true))
    setBad(r.rejected); if (r.media.length === 1) onPick(r.media[0]); else refresh()
  }
  return (
    <Sheet title={title} onClose={onClose}>
      <button class="btn block" onClick={add}><Icon n="upload" />นำเข้ารูปหรือคลิป</button>
      {bad.length > 0 && <Notice err>เปิดไฟล์เหล่านี้ไม่ได้: {bad.join(', ')}</Notice>}
      {items.length === 0 ? <p class="muted">ยังไม่มีสื่อที่นำเข้า กดปุ่มด้านบนเพื่อเริ่ม</p> : (
        <div class="mgrid">{items.map((m) => (
          <button class="mcell" key={m.id} style={{ backgroundImage: `url(${m.thumb})` }} aria-label={`เลือก ${m.name}`} onClick={() => onPick(m)}>
            {m.kind === 'video' && <small>{fmt(m.durationMs)}</small>}
          </button>))}</div>)}
    </Sheet>
  )
}
