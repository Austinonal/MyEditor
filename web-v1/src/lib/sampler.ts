import { histogram, detectCuts, scenesFromCuts, type Frame } from './histogram'
import { seek, thumbAt } from './media'
import type { Scene } from './types'

export const MAX_REF_MS = 180_000
const W = 64, H = 36

export interface Analysis { scenes: Scene[]; analysedMs: number }

/**
 * Stage 1 of Auto Cut: shot boundaries.
 * shortcut: samples at fps (default 6) so a cut is placed within ~170 ms, and caps the reference at 3 min;
 * refine with a second pass around each cut and chunked processing when beats/effects stages arrive.
 */
export async function analyseScenes(blob: Blob, onProgress: (p: number) => void, signal: AbortSignal, fps = 6): Promise<Analysis> {
  const url = URL.createObjectURL(blob)
  try {
    const v = document.createElement('video')
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url
    await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('decode')) })
    const durationMs = Math.min(Math.round(v.duration * 1000), MAX_REF_MS)
    if (!isFinite(durationMs) || durationMs <= 0) throw new Error('duration')
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    const frames: Frame[] = []
    const step = 1000 / fps
    const n = Math.floor(durationMs / step)
    for (let i = 0; i <= n; i++) {
      if (signal.aborted) throw new DOMException('cancelled', 'AbortError')
      const tMs = Math.round(i * step)
      await seek(v, tMs / 1000)
      ctx.drawImage(v, 0, 0, W, H)
      frames.push({ tMs, hist: histogram(ctx.getImageData(0, 0, W, H).data) })
      if (i % 4 === 0) onProgress(i / n)
    }
    const scenes: Scene[] = scenesFromCuts(detectCuts(frames), durationMs)
    for (const s of scenes) {
      if (signal.aborted) throw new DOMException('cancelled', 'AbortError')
      s.thumb = await thumbAt(v, s.startMs + Math.min(150, (s.endMs - s.startMs) / 2))
    }
    onProgress(1)
    return { scenes, analysedMs: durationMs }
  } finally { URL.revokeObjectURL(url) }
}
