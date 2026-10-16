import { useEffect, useRef, useState } from 'preact/hooks'
import { Icon } from '../ui/icons'
import { Notice, Top } from '../ui/kit'
import { deleteProject, getBlob, getProject, putProject } from '../lib/store'
import { analyseScenes, MAX_REF_MS } from '../lib/sampler'
import { decodeAudio, detectBeats, toMono } from '../lib/beats'
import { buildSkeleton } from '../lib/skeleton'

export function Analyze({ id }: { id: string }) {
  const [p, setP] = useState(0)
  const [state, setState] = useState<'run' | 'err' | 'cancel'>('run')
  const ctl = useRef<AbortController>()
  const [n, setN] = useState(0)
  const [stage, setStage] = useState<'scenes' | 'beats' | 'done'>('scenes')
  const [bpm, setBpm] = useState<number | null>(null)
  const [noAudio, setNoAudio] = useState(false)

  const run = async () => {
    setState('run'); setP(0)
    const c = (ctl.current = new AbortController())
    try {
      const proj = await getProject(id); const blob = proj?.referenceId ? await getBlob(proj.referenceId) : undefined
      if (!proj || !blob) throw new Error('missing')
      setStage('scenes')
      const r = await analyseScenes(blob, (x) => setP(x * 0.85), c.signal)
      setN(r.scenes.length); setStage('beats'); setP(0.9)
      const audio = await decodeAudio(blob)
      let beats: number[] = [], bpmV = 0
      if (audio) {
        const x = toMono(audio).subarray(0, Math.floor((MAX_REF_MS / 1000) * audio.sampleRate))
        const b = detectBeats(x, audio.sampleRate); bpmV = b.bpm; if (b.confidence > 0.05) beats = b.beats.filter((t) => t <= r.analysedMs)
        setBpm(beats.length ? b.bpm : null)
      } else setNoAudio(true)
      if (c.signal.aborted) throw new DOMException('cancelled', 'AbortError')
      setStage('done'); setP(1)
      await putProject({ ...proj, scenes: r.scenes, slots: buildSkeleton(r.scenes, []), beats, bpm: bpmV, audio: { on: !!audio, volume: 1 } })
      location.replace(`#/review/${id}`)
    } catch (e) { if ((e as Error).name === 'AbortError') setState('cancel'); else setState('err') }
  }
  useEffect(() => { run(); return () => ctl.current?.abort() }, [id])
  const cancel = async () => { ctl.current?.abort(); await deleteProject(id); location.hash = '#/' }

  const pct = Math.round(p * 100)
  return (
    <div class="page">
      <Top title="กำลังวิเคราะห์" back="#/ref" />
      <div class="card"><span class="muted" style={{ fontSize: 'var(--fs-caption)', fontWeight: 600 }}>ขั้นที่ {stage === 'scenes' ? 1 : 2} จาก 2 ในเวอร์ชันนี้</span><br /><b>{stage === 'scenes' ? 'ตรวจจับฉาก' : 'จับจังหวะเพลง'}</b>
        <div class="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: pct + '%' }} /></div>
        <span class="muted small">{pct}%{n ? ` · พบ ${n} ฉาก` : ''}</span></div>
      <h2>ขั้นตอน</h2>
      <div class="card" style={{ padding: '4px 16px' }}>
        <div class="stage"><span class={stage === 'scenes' ? 'run' : 'ok'}><Icon n={stage === 'scenes' ? 'film' : 'check'} /></span><b>ตรวจจับฉาก</b><span class="muted small">{stage === 'scenes' ? (state === 'run' ? 'กำลังทำ' : state === 'err' ? 'ล้มเหลว' : 'หยุดแล้ว') : `${n} ฉาก`}</span></div>
        <div class="stage"><span class={stage === 'done' ? 'ok' : stage === 'beats' ? 'run' : 'muted'}><Icon n={stage === 'done' ? 'check' : 'film'} /></span><b class={stage === 'scenes' ? 'muted' : ''}>จังหวะเพลง</b><span class="muted small">{stage === 'done' ? (noAudio ? 'ไม่พบเสียง' : bpm ? `${bpm} BPM` : 'ไม่พบจังหวะชัด') : stage === 'beats' ? 'กำลังทำ' : 'รอ'}</span></div>
        {['เอฟเฟกต์', 'ข้อความบนจอ', 'เสียงพูด (ไทย/อังกฤษ)'].map((s) => <div class="stage" key={s}><span class="muted"><Icon n="film" /></span><b class="muted">{s}</b><span class="muted small">เฟสถัดไป</span></div>)}
      </div>
      {state === 'err' && <Notice err>วิเคราะห์ไม่สำเร็จ ไฟล์อาจเสียหรือเบราว์เซอร์เปิดรูปแบบนี้ไม่ได้ ลองไฟล์อื่นหรือเริ่มใหม่</Notice>}
      <div class="footer">
        {state !== 'run' && <button class="btn block" onClick={run}>ลองใหม่</button>}
        <button class="btn sec block" onClick={cancel}>ยกเลิก</button>
      </div>
    </div>
  )
}
