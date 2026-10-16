export type Aspect = '9:16' | '1:1' | '4:5' | '16:9'
export type Kind = 'video' | 'thumbnail'

export interface Media {
  id: string
  kind: 'video' | 'image'
  name: string
  durationMs: number // 0 for images
  w: number
  h: number
  thumb: string // small data URL
}

export interface Scene { idx: number; startMs: number; endMs: number; thumb?: string }

// start is derived from order (see timeline.ts), so slots can never overlap or leave gaps.
export interface TextOverlay { content: string; pos: 'top' | 'center' | 'bottom'; size: number; color: string; anim?: string }
export interface Slot {
  id: string; sceneIdx: number; durationMs: number; mediaId: string | null; inMs: number
  anim?: { in?: string; out?: string; combo?: string; inMs?: number; outMs?: number } // CapCut-style In / Out / Combo
  trans?: { type: string; ms: number } // transition into this slot from the previous one
  filter?: string
  speed?: number // source playback speed for video, 0.25..4
  text?: TextOverlay
}

export interface Project {
  id: string
  name: string
  kind: Kind
  aspect: Aspect
  referenceId: string | null
  beats?: number[] // ms on the reference timeline
  bpm?: number
  audio?: { on: boolean; volume: number } // soundtrack taken from the reference clip
  scenes: Scene[]
  slots: Slot[]
  updatedAt: number
}

export const ASPECT_SIZE: Record<Aspect, [number, number]> = {
  '9:16': [720, 1280], '1:1': [720, 720], '4:5': [720, 900], '16:9': [1280, 720],
}
export const uid = () => crypto.randomUUID()
