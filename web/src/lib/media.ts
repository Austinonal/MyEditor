import type { Media } from './types'
import { uid } from './types'
import { putMedia } from './store'

const THUMB_W = 96

export function isSupported(f: File) { return f.type.startsWith('video/') || f.type.startsWith('image/') }

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((res, rej) => {
    const v = document.createElement('video')
    v.muted = true; v.playsInline = true; v.preload = 'auto'
    v.onloadeddata = () => res(v)
    v.onerror = () => rej(new Error('video'))
    v.src = url
  })
}
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image')); i.src = url })
}
function thumbOf(src: CanvasImageSource, w: number, h: number): string {
  const c = document.createElement('canvas'); c.width = THUMB_W; c.height = Math.round((THUMB_W * h) / w)
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.7)
}

export async function thumbAt(video: HTMLVideoElement, tMs: number): Promise<string> {
  await seek(video, tMs / 1000)
  return thumbOf(video, video.videoWidth, video.videoHeight)
}

/** Seek and resolve only once the new frame is actually presentable (a bare 'seeked' can still show the old frame). */
export function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((res) => {
    const target = Math.min(Math.max(t, 0), Math.max((v.duration || 0) - 0.001, 0))
    const done = () => { v.removeEventListener('seeked', onSeeked); res() }
    const onSeeked = () => {
      const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback
      if (rvfc) { rvfc.call(v, done); setTimeout(done, 250) } else done() // timeout: rvfc may not fire if the frame was already shown
    }
    v.addEventListener('seeked', onSeeked)
    v.currentTime = target
  })
}

export interface ImportResult { media: Media[]; rejected: string[] }

/** Trust boundary: only decodable image/video files get in; everything else is reported, never silently dropped. */
export async function importFiles(files: File[]): Promise<ImportResult> {
  const media: Media[] = []; const rejected: string[] = []
  for (const f of files) {
    if (!isSupported(f)) { rejected.push(f.name); continue }
    const url = URL.createObjectURL(f)
    try {
      let m: Media
      if (f.type.startsWith('video/')) {
        const v = await loadVideo(url)
        m = { id: uid(), kind: 'video', name: f.name, durationMs: Math.round(v.duration * 1000), w: v.videoWidth, h: v.videoHeight, thumb: thumbOf(v, v.videoWidth, v.videoHeight) }
      } else {
        const i = await loadImage(url)
        m = { id: uid(), kind: 'image', name: f.name, durationMs: 0, w: i.naturalWidth, h: i.naturalHeight, thumb: thumbOf(i, i.naturalWidth, i.naturalHeight) }
      }
      await putMedia(m, f); media.push(m)
    } catch { rejected.push(f.name) } finally { URL.revokeObjectURL(url) }
  }
  return { media, rejected }
}

export function pickFiles(multiple: boolean, accept = 'image/*,video/*'): Promise<File[]> {
  return new Promise((res) => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = multiple
    i.onchange = () => res(Array.from(i.files ?? []))
    i.oncancel = () => res([])
    i.click()
  })
}
