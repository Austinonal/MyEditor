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
export interface Slot { id: string; sceneIdx: number; durationMs: number; mediaId: string | null; inMs: number }

export interface Project {
  id: string
  name: string
  kind: Kind
  aspect: Aspect
  referenceId: string | null
  scenes: Scene[]
  slots: Slot[]
  updatedAt: number
}

export const ASPECT_SIZE: Record<Aspect, [number, number]> = {
  '9:16': [720, 1280], '1:1': [720, 720], '4:5': [720, 900], '16:9': [1280, 720],
}
export const uid = () => crypto.randomUUID()
