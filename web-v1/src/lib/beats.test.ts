import { describe, expect, it } from 'vitest'
import { detectBeats } from './beats'
import { animTransform, IN, OUT, COMBO } from './anim'
import { alignToBeats } from './timeline'

function clicks(bpm: number, offsetS: number, seconds: number, sr = 44100) {
  const x = new Float32Array(seconds * sr), step = (60 / bpm) * sr
  for (let t = offsetS * sr; t < x.length; t += step) for (let i = 0; i < 400 && t + i < x.length; i++) x[Math.round(t) + i] = Math.sin(i * 0.3) * (1 - i / 400)
  return x
}

describe('detectBeats', () => {
  it.each([[120, 0.2], [100, 0.37], [140, 0.05]])('finds %i bpm with offset %f', (bpm, off) => {
    const r = detectBeats(clicks(bpm, off, 12), 44100)
    expect(Math.abs(r.bpm - bpm)).toBeLessThan(2)
    expect(Math.abs(r.beats[0] - off * 1000)).toBeLessThan(35)
    const spacing = r.beats[5] - r.beats[4]
    expect(Math.abs(spacing - 60000 / bpm)).toBeLessThan(40)
  })
  it('returns nothing for silence', () => { expect(detectBeats(new Float32Array(44100 * 6), 44100).confidence).toBeLessThan(0.1) })
})

describe('animations', () => {
  it('every named animation returns finite values across its whole range', () => {
    for (const [id] of [...IN, ...OUT, ...COMBO]) for (const t of [0, 100, 250, 499, 500, 1000, 1700, 2000]) {
      const x = animTransform({ in: id, out: id, combo: id }, t, 2000)
      for (const v of Object.values(x)) expect(Number.isFinite(v)).toBe(true)
      expect(x.a).toBeGreaterThanOrEqual(0); expect(x.s).toBeGreaterThan(0)
    }
  })
  it('fade in starts invisible and ends fully visible', () => {
    expect(animTransform({ in: 'fade' }, 0, 2000).a).toBe(0)
    expect(animTransform({ in: 'fade' }, 600, 2000).a).toBe(1)
  })
  it('out animation only acts in the tail', () => {
    expect(animTransform({ out: 'fade' }, 500, 2000).a).toBe(1)
    expect(animTransform({ out: 'fade' }, 2000, 2000).a).toBe(0)
  })
  it('no config means identity', () => { expect(animTransform(undefined, 10, 100)).toEqual({ a: 1, s: 1, tx: 0, ty: 0, rot: 0 }) })
})

describe('alignToBeats', () => {
  const mk = (d: number[]) => d.map((durationMs, i) => ({ id: 's' + i, sceneIdx: i, durationMs, mediaId: null, inMs: 0 }))
  it('moves boundaries onto nearby beats and keeps the total', () => {
    const out = alignToBeats(mk([1020, 980, 1000]), [0, 500, 1000, 1500, 2000, 2500, 3000], 200)
    expect(out.map((s) => s.durationMs)).toEqual([1000, 1000, 1000])
  })
  it('leaves boundaries alone when no beat is close', () => {
    expect(alignToBeats(mk([1300, 1000]), [0, 1000, 2000], 100).map((s) => s.durationMs)).toEqual([1300, 1000])
  })
})
