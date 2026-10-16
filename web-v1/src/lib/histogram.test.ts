import { describe, expect, it } from 'vitest'
import { histogram, histDiff, detectCuts, scenesFromCuts, type Frame } from './histogram'
import { moveBoundary, split, starts, total, snapTime, MIN_SLOT_MS } from './timeline'
import { buildSkeleton, autoFill } from './skeleton'
import type { Slot } from './types'

const solid = (r: number, g: number, b: number) => { const a = new Uint8ClampedArray(64 * 4); for (let i = 0; i < 64; i++) a.set([r, g, b, 255], i * 4); return histogram(a) }
const frames = (colors: [number, number, number][], fps = 6): Frame[] => colors.map((c, i) => ({ tMs: Math.round((i * 1000) / fps), hist: solid(...c) }))

describe('detectCuts', () => {
  it('finds hard cuts in solid colour segments', () => {
    const red = [200, 20, 20], green = [20, 200, 20], blue = [20, 20, 200]
    const seq = [...Array(6).fill(red), ...Array(6).fill(green), ...Array(6).fill(blue)] as [number, number, number][]
    const cuts = detectCuts(frames(seq))
    expect(cuts).toEqual([1000, 2000])
  })
  it('ignores gradual change and noise', () => {
    const seq = Array.from({ length: 30 }, (_, i) => [100 + i, 100, 100] as [number, number, number])
    expect(detectCuts(frames(seq))).toEqual([])
  })
  it('enforces a minimum shot length', () => {
    const a = [200, 20, 20], b = [20, 200, 20]
    const seq = [a, a, a, b, a, a, a, a, a] as [number, number, number][]
    expect(detectCuts(frames(seq)).length).toBeLessThanOrEqual(1)
  })
  it('diff is 0 for same frame, near 1 for opposite', () => {
    expect(histDiff(solid(0, 0, 0), solid(0, 0, 0))).toBe(0)
    expect(histDiff(solid(0, 0, 0), solid(255, 255, 255))).toBeCloseTo(1, 5)
  })
  it('scenesFromCuts covers the whole duration', () => {
    const sc = scenesFromCuts([1000, 2000], 3000)
    expect(sc.map((s) => [s.startMs, s.endMs])).toEqual([[0, 1000], [1000, 2000], [2000, 3000]])
    expect(scenesFromCuts([], 5000)).toHaveLength(1)
  })
})

const mk = (d: number[]): Slot[] => d.map((durationMs, i) => ({ id: 's' + i, sceneIdx: i, durationMs, mediaId: null, inMs: 0 }))

describe('timeline', () => {
  it('ripple grows total; non-ripple keeps total', () => {
    expect(total(moveBoundary(mk([1000, 1000]), 0, 500, true))).toBe(2500)
    expect(total(moveBoundary(mk([1000, 1000]), 0, 500, false))).toBe(2000)
  })
  it('never goes below the minimum and never locks', () => {
    const s = moveBoundary(mk([1000, 1000]), 0, -5000, true)
    expect(s[0].durationMs).toBe(MIN_SLOT_MS)
    const t = moveBoundary(mk([1000, 1000]), 0, 5000, false)
    expect(t[1].durationMs).toBe(MIN_SLOT_MS)
  })
  it('starts are derived and contiguous', () => { expect(starts(mk([1000, 500, 700]))).toEqual([0, 1000, 1500]) })
  it('split keeps total and moves the in point', () => {
    const s = split(mk([2000]), 0, 800)
    expect(s.map((x) => x.durationMs)).toEqual([800, 1200]); expect(s[1].inMs).toBe(800)
    expect(split(mk([2000]), 0, 100)).toHaveLength(1)
  })
  it('snap pulls to a nearby point only', () => {
    expect(snapTime(1030, [1000, 2000], 60)).toBe(1000)
    expect(snapTime(1500, [1000, 2000], 60)).toBe(1500)
  })
})

describe('skeleton', () => {
  const scenes = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ idx: i, startMs: i * 1000, endMs: i * 1000 + 800 }))
  it('1 media, 7 scenes: one filled slot and six empty blocks', () => {
    const s = buildSkeleton(scenes, ['m1'])
    expect(s).toHaveLength(7); expect(s.filter((x) => x.mediaId).length).toBe(1)
  })
  it('autoFill fills only empty slots with unused media', () => {
    const s = autoFill(buildSkeleton(scenes, ['m1']), ['m1', 'm2', 'm3'])
    expect(s.map((x) => x.mediaId).slice(0, 3)).toEqual(['m1', 'm2', 'm3'])
  })
})
