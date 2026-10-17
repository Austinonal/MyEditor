// Noise reduction by spectral subtraction. The noise level per frequency is the quiet part of that frequency over the whole
// clip (its 15th percentile), so steady hiss and hum go while speech, which comes and goes, stays. Pure, so it is unit-tested.

const N = 1024;
const HOP = N / 4;

function fft(re: Float32Array, im: Float32Array, inverse: boolean) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

const WINDOW = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));

// amount 0..1. Returns a new array the same length.
export function denoise(x: Float32Array, amount: number): Float32Array {
  const a = Math.min(1, Math.max(0, amount));
  if (a === 0 || x.length < N * 2) return Float32Array.from(x);
  const frames = Math.floor((x.length - N) / HOP) + 1;
  const bins = N / 2 + 1;
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  const spec: { re: Float32Array; im: Float32Array }[] = [];
  const mags = new Float32Array(frames * bins);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N; i++) { re[i] = x[f * HOP + i] * WINDOW[i]; im[i] = 0; }
    fft(re, im, false);
    spec.push({ re: Float32Array.from(re), im: Float32Array.from(im) });
    for (let k = 0; k < bins; k++) mags[f * bins + k] = Math.hypot(re[k], im[k]);
  }
  const noise = new Float32Array(bins);
  const col = new Float32Array(frames);
  for (let k = 0; k < bins; k++) {
    for (let f = 0; f < frames; f++) col[f] = mags[f * bins + k];
    noise[k] = [...col].sort((p, q) => p - q)[Math.floor(frames * 0.15)];
  }
  const over = 1 + 2.5 * a; // subtract more than the estimate: the estimate is of the quiet part, noise has peaks
  const floor = 0.03 + 0.3 * (1 - a);
  const out = new Float32Array(x.length);
  const prev = new Float32Array(bins).fill(1);
  for (let f = 0; f < frames; f++) {
    const { re: sr, im: si } = spec[f];
    for (let k = 0; k < bins; k++) {
      const m = mags[f * bins + k] || 1e-9;
      let g = Math.max(floor, 1 - (over * noise[k]) / m);
      g = prev[k] = 0.5 * prev[k] + 0.5 * g; // smoothing in time keeps the leftovers from twittering
      re[k] = sr[k] * g;
      im[k] = si[k] * g;
      if (k > 0 && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; }
    }
    im[0] = 0;
    im[N / 2] = 0;
    fft(re, im, true);
    for (let i = 0; i < N; i++) out[f * HOP + i] += (re[i] * WINDOW[i]) / 1.5; // Hann analysis and synthesis at 75 % overlap sum to 1.5
  }
  return out;
}
