import { ASPECT_SIZE, type Project } from './types'
import { total } from './timeline'
import { getBlob, getMedia } from './store'
import { Player } from './player'

export function exportMime(): string | null {
  return ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? null
}

/**
 * shortcut: records the canvas in real time with MediaRecorder (export takes as long as the video, no audio track).
 * Upgrade to WebCodecs + a muxer for faster-than-real-time export and audio.
 */
export async function exportProject(p: Project, onProgress: (f: number) => void, signal: AbortSignal): Promise<{ blob: Blob; ext: string }> {
  const mime = exportMime()
  if (!mime) throw new Error('unsupported')
  const [w, h] = ASPECT_SIZE[p.aspect]
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
  const player = new Player(canvas, () => p.slots)
  const ids = [...new Set(p.slots.map((s) => s.mediaId).filter((x): x is string => !!x))]
  const items = (await Promise.all(ids.map(async (id) => ({ media: await getMedia(id), blob: await getBlob(id) })))).filter((x) => x.media && x.blob) as { media: any; blob: Blob }[]
  await player.load(items)
  const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 6_000_000 })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const len = total(p.slots)
  const done = new Promise<void>((res) => { rec.onstop = () => res() })
  rec.start(500)
  await player.seek(0)
  await new Promise<void>((res, rej) => {
    player.onTick = (t) => { onProgress(t / len); if (signal.aborted) { player.pause(); rej(new DOMException('cancelled', 'AbortError')) } }
    player.onEnd = () => res()
    player.play()
  }).finally(() => { rec.state !== 'inactive' && rec.stop(); player.dispose() })
  await done
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm' }
}
