import { ASPECT_SIZE, type Project } from './types'
import { total } from './timeline'
import { getBlob, getMedia } from './store'
import { Player, type Soundtrack } from './player'

export function exportMime(audio = false): string | null {
  const list = audio
    ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return list.find((m) => MediaRecorder.isTypeSupported(m)) ?? null
}

/**
 * shortcut: records the canvas (and the soundtrack) in real time with MediaRecorder, so export takes as long as the video.
 * Upgrade to WebCodecs + a muxer for faster-than-real-time export and a proper duration header.
 */
export async function exportProject(p: Project, onProgress: (f: number) => void, signal: AbortSignal, soundtrack: Soundtrack | null = null): Promise<{ blob: Blob; ext: string }> {
  const mime = exportMime(!!soundtrack?.on)
  if (!mime) throw new Error('unsupported')
  const [w, h] = ASPECT_SIZE[p.aspect]
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
  const player = new Player(canvas, () => p.slots)
  const ids = [...new Set(p.slots.map((s) => s.mediaId).filter((x): x is string => !!x))]
  const items = (await Promise.all(ids.map(async (id) => ({ media: await getMedia(id), blob: await getBlob(id) })))).filter((x) => x.media && x.blob) as { media: any; blob: Blob }[]
  await player.load(items)
  player.soundtrack = soundtrack
  const audio = player.prepareExportAudio()
  const stream = canvas.captureStream(30)
  audio?.getAudioTracks().forEach((t) => stream.addTrack(t))
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
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
