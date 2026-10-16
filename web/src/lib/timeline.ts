import type { Slot } from './types'
import { uid } from './types'

export const MIN_SLOT_MS = 300

export const total = (s: Slot[]) => s.reduce((a, x) => a + x.durationMs, 0)

export function starts(s: Slot[]): number[] {
  let t = 0
  return s.map((x) => { const r = t; t += x.durationMs; return r })
}

export function slotAt(s: Slot[], tMs: number): number {
  const st = starts(s)
  for (let i = s.length - 1; i >= 0; i--) if (tMs >= st[i]) return i
  return 0
}

/**
 * Move the boundary on the right edge of slot i by deltaMs.
 * ripple on: slot i grows or shrinks and everything after it shifts.
 * ripple off: the next slot gives or takes the difference, total length stays.
 * Nothing is ever locked: only the minimum length is enforced.
 */
export function moveBoundary(s: Slot[], i: number, deltaMs: number, ripple: boolean): Slot[] {
  if (i < 0 || i >= s.length) return s
  const a = s[i]
  const b = !ripple ? s[i + 1] : undefined
  let d = Math.max(deltaMs, MIN_SLOT_MS - a.durationMs)
  if (b) d = Math.min(d, b.durationMs - MIN_SLOT_MS)
  if (d === 0) return s
  return s.map((x, k) => (k === i ? { ...x, durationMs: x.durationMs + d } : b && k === i + 1 ? { ...x, durationMs: x.durationMs - d } : x))
}

export function snapTime(tMs: number, points: number[], thresholdMs: number): number {
  let best = tMs, bd = thresholdMs
  for (const p of points) { const d = Math.abs(p - tMs); if (d <= bd) { best = p; bd = d } }
  return best
}

export function split(s: Slot[], i: number, atMs: number): Slot[] {
  const x = s[i]
  if (!x || atMs < MIN_SLOT_MS || x.durationMs - atMs < MIN_SLOT_MS) return s
  const a = { ...x, durationMs: atMs }
  const b = { ...x, id: uid(), durationMs: x.durationMs - atMs, inMs: x.inMs + atMs }
  return [...s.slice(0, i), a, b, ...s.slice(i + 1)]
}

export const remove = (s: Slot[], i: number): Slot[] => s.filter((_, k) => k !== i)

export function move(s: Slot[], i: number, j: number): Slot[] {
  if (j < 0 || j >= s.length || i === j) return s
  const c = [...s]; const [x] = c.splice(i, 1); c.splice(j, 0, x); return c
}
