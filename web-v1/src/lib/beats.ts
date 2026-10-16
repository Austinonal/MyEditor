// Pure beat tracking: onset envelope -> tempo by autocorrelation -> beat grid aligned to the strongest phase.
const HOP = 512

export interface Beats { bpm: number; beats: number[]; confidence: number }

function onsetEnvelope(x: Float32Array): Float32Array {
  const n = Math.floor(x.length / HOP)
  const env = new Float32Array(n)
  let prev = Math.log(1e-6)
  for (let f = 0; f < n; f++) {
    let e = 0
    for (let i = f * HOP + 1; i < (f + 1) * HOP; i++) { const d = x[i] - x[i - 1]; e += d * d } // high-pass emphasises clicks and hats
    const l = Math.log(e + 1e-6)
    env[f] = Math.max(0, l - prev); prev = l
  }
  // subtract a centred local mean (~0.5 s) so steady loud passages do not read as onsets
  const w = Math.round(0.25 / (HOP / 44100)); const out = new Float32Array(n)
  const pre = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + env[i]
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - w), hi = Math.min(n, i + w + 1)
    out[i] = Math.max(0, env[i] - (pre[hi] - pre[lo]) / (hi - lo))
  }
  return out
}

export function detectBeats(x: Float32Array, sampleRate: number): Beats {
  const fps = sampleRate / HOP
  const o = onsetEnvelope(x)
  if (o.length < fps * 2) return { bpm: 0, beats: [], confidence: 0 }
  const r = (lag: number) => { let s = 0; for (let i = 0; i + lag < o.length; i++) s += o[i] * o[i + lag]; return s }
  const r0 = r(0) || 1
  let best = 0, bestScore = -1
  for (let bpm = 200; bpm >= 60; bpm -= 0.5) {
    const L = (60 / bpm) * fps; const lo = Math.floor(L)
    const rl = r(lo) * (1 - (L - lo)) + r(lo + 1) * (L - lo)
    const score = rl + 0.5 * r(Math.round(2 * L))
    if (score > bestScore) { bestScore = score; best = L }
  }
  const confidence = Math.min(bestScore / r0, 1)
  let bpm = (60 * fps) / best
  while (bpm < 75) bpm *= 2
  while (bpm >= 150) bpm /= 2
  const period = (60 * fps) / bpm
  // phase: the offset whose grid collects the most onset energy
  let phase = 0, ps = -1
  for (let p = 0; p < period; p += 0.5) { let s = 0; for (let k = p; k < o.length; k += period) s += o[Math.round(k)] ?? 0; if (s > ps) { ps = s; phase = p } }
  const beats: number[] = []
  for (let k = phase; k < o.length; k += period) beats.push(Math.round((k / fps) * 1000))
  return { bpm: Math.round(bpm * 10) / 10, beats, confidence }
}

/** Decode any audio-bearing file to mono samples. Returns null when there is no audio track. */
export async function decodeAudio(blob: Blob): Promise<AudioBuffer | null> {
  try { return await new OfflineAudioContext(1, 1, 44100).decodeAudioData(await blob.arrayBuffer()) } catch { return null }
}

export const toMono = (b: AudioBuffer) => b.getChannelData(0)
