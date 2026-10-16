// Pure functions, no DOM: unit-tested in histogram.test.ts.
export const BINS = 16

/** RGBA pixels -> normalised per-channel colour histogram (3 * BINS values). */
export function histogram(rgba: Uint8ClampedArray): Float32Array {
  const h = new Float32Array(BINS * 3)
  const n = rgba.length / 4
  // soft binning: a value spreads over its two nearest bins, so a flat colour drifting across a
  // bin edge does not look like a cut
  const add = (c: number, v: number) => {
    const p = v / (256 / BINS) - 0.5
    const lo = Math.floor(p), f = p - lo
    h[c * BINS + Math.min(Math.max(lo, 0), BINS - 1)] += 1 - f
    h[c * BINS + Math.min(Math.max(lo + 1, 0), BINS - 1)] += f
  }
  for (let i = 0; i < rgba.length; i += 4) { add(0, rgba[i]); add(1, rgba[i + 1]); add(2, rgba[i + 2]) }
  for (let i = 0; i < h.length; i++) h[i] /= n
  return h
}

/** 0 (identical) .. 1 (completely different), mean L1 distance per channel / 2. */
export function histDiff(a: Float32Array, b: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i])
  return s / 6
}

export interface Frame { tMs: number; hist: Float32Array }
export interface CutOpts { absMin: number; relFactor: number; minShotMs: number }
export const DEFAULT_CUT: CutOpts = { absMin: 0.22, relFactor: 3, minShotMs: 400 }

const median = (v: number[]) => { const s = [...v].sort((x, y) => x - y); return s[s.length >> 1] ?? 0 }

/** Times (ms) where a hard cut happens. A cut is a jump that is both big and much bigger than its neighbours. */
export function detectCuts(frames: Frame[], o: CutOpts = DEFAULT_CUT): number[] {
  const d: number[] = [0]
  for (let i = 1; i < frames.length; i++) d.push(histDiff(frames[i - 1].hist, frames[i].hist))
  const cand: { t: number; s: number }[] = []
  for (let i = 1; i < d.length; i++) {
    const around = [...d.slice(Math.max(1, i - 5), i), ...d.slice(i + 1, i + 6)]
    if (d[i] >= o.absMin && d[i] >= o.relFactor * Math.max(median(around), 0.01)) cand.push({ t: frames[i].tMs, s: d[i] })
  }
  // non-max suppression: keep the strongest cut inside any minShot window
  cand.sort((a, b) => b.s - a.s)
  const kept: number[] = []
  for (const c of cand) if (kept.every((k) => Math.abs(k - c.t) >= o.minShotMs)) kept.push(c.t)
  return kept.sort((a, b) => a - b)
}

export function scenesFromCuts(cuts: number[], durationMs: number) {
  const edges = [0, ...cuts.filter((c) => c > 0 && c < durationMs), durationMs]
  return edges.slice(0, -1).map((startMs, idx) => ({ idx, startMs, endMs: edges[idx + 1] }))
}
