import type { Scene, Slot } from './types'
import { uid } from './types'

/** One slot per scene, same length as the reference scene. User media fills slots in order; the rest stay empty. */
export function buildSkeleton(scenes: Scene[], mediaIds: string[]): Slot[] {
  return scenes.map((sc, i) => ({
    id: uid(), sceneIdx: sc.idx, durationMs: Math.max(sc.endMs - sc.startMs, 300), mediaId: mediaIds[i] ?? null, inMs: 0,
  }))
}

/** Fill only empty slots, in order, with media not already used. */
export function autoFill(slots: Slot[], mediaIds: string[]): Slot[] {
  const used = new Set(slots.map((s) => s.mediaId).filter(Boolean))
  const free = mediaIds.filter((m) => !used.has(m))
  return slots.map((s) => (s.mediaId || !free.length ? s : { ...s, mediaId: free.shift()!, inMs: 0 }))
}
