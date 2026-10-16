import { useEffect, useRef, useState } from 'preact/hooks'
import { Icon } from '../ui/icons'
import { Notice, Top } from '../ui/kit'
import { deleteProject, getBlob, getProject, putProject } from '../lib/store'
import { analyseScenes } from '../lib/sampler'
import { buildSkeleton } from '../lib/skeleton'

export function Analyze({ id }: { id: string }) {
  const [p, setP] = useState(0)
  const [state, setState] = useState<'run' | 'err' | 'cancel'>('run')
  const ctl = useRef<AbortController>()
  const [n, setN] = useState(0)

  const run = async () => {
    setState('run'); setP(0)
    const c = (ctl.current = new AbortController())
    try {
      const proj = await getProject(id); const blob = proj?.referenceId ? await getBlob(proj.referenceId) : undefined
      if (!proj || !blob) throw new Error('missing')
      const r = await analyseScenes(blob, setP, c.signal)
      setN(r.scenes.length)
      await putProject({ ...proj, scenes: r.scenes, slots: buildSkeleton(r.scenes, []) })
      location.replace(`#/review/${id}`)
    } catch (e) { if ((e as Error).name === 'AbortError') setState('cancel'); else setState('err') }
  }
  useEffect(() => { run(); return () => ctl.current?.abort() }, [id])
  const cancel = async () => { ctl.current?.abort(); await deleteProject(id); location.hash = '#/' }

  const pct = Math.round(p * 100)
  return (
    <div class="page">
      <Top title="กำลังวิเคราะห์" back="#/ref" />
      <div class="card"><span class="muted" style={{ fontSize: 'var(--fs-caption)', fontWeight: 600 }}>ขั้นที่ 1 จาก 1 ในเวอร์ชันนี้</span><br /><b>ตรวจจับฉาก</b>
        <div class="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: pct + '%' }} /></div>
        <span class="muted small">{pct}%{n ? ` · พบ ${n} ฉาก` : ''}</span></div>
      <h2>ขั้นตอน</h2>
      <div class="card" style={{ padding: '4px 16px' }}>
        <div class="stage"><span class={state === 'err' ? '' : 'run'}><Icon n={pct === 100 ? 'check' : 'film'} /></span><b>ตรวจจับฉาก</b><span class="muted small">{state === 'run' ? 'กำลังทำ' : state === 'err' ? 'ล้มเหลว' : 'หยุดแล้ว'}</span></div>
        {['จังหวะเพลง', 'เอฟเฟกต์', 'ข้อความบนจอ', 'เสียงพูด (ไทย/อังกฤษ)'].map((s) => <div class="stage" key={s}><span class="muted"><Icon n="film" /></span><b class="muted">{s}</b><span class="muted small">เฟสถัดไป</span></div>)}
      </div>
      {state === 'err' && <Notice err>วิเคราะห์ไม่สำเร็จ ไฟล์อาจเสียหรือเบราว์เซอร์เปิดรูปแบบนี้ไม่ได้ ลองไฟล์อื่นหรือเริ่มใหม่</Notice>}
      <div class="footer">
        {state !== 'run' && <button class="btn block" onClick={run}>ลองใหม่</button>}
        <button class="btn sec block" onClick={cancel}>ยกเลิก</button>
      </div>
    </div>
  )
}
