// Which transition joins two shots, from small luma pictures around the join. Pure, so it is unit-tested; reference.ts
// decodes the frames. Answers are ids from transitions.ts, or null for a plain cut.

export interface Pic {
  t: number; // seconds
  w: number;
  h: number;
  luma: Float32Array; // 0..1
}

const mean = (a: Float32Array) => a.reduce((s, v) => s + v, 0) / a.length;
const diff = (a: Float32Array, b: Float32Array) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
};

// Best split of a 0..1 profile into "low then high" or "high then low". Only a profile that really goes from one to the
// other counts (a frame that is all one picture has no step).
function stepFit(p: number[]) {
  const none = { quality: 0, k: 0, highFirst: false };
  if (!p.some((v) => v < 0.35) || !p.some((v) => v > 0.65)) return none;
  let best = none;
  for (let k = 1; k < p.length; k++) {
    const up = (p.slice(0, k).filter((v) => v < 0.5).length + p.slice(k).filter((v) => v >= 0.5).length) / p.length;
    if (up > best.quality) best = { quality: up, k, highFirst: false };
    if (1 - up > best.quality) best = { quality: 1 - up, k, highFirst: true };
  }
  return best;
}

type Dir = 'left' | 'right' | 'up' | 'down';
// The middle of a push: A moved out by d pixels in `dir`, B coming in behind it.
function pushCost(m: Pic, A: Float32Array, B: Float32Array, dir: Dir, d: number) {
  const { w, h } = m;
  let s = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v: number;
      if (dir === 'left') v = x < w - d ? A[y * w + x + d] : B[y * w + x - (w - d)];
      else if (dir === 'right') v = x >= d ? A[y * w + x - d] : B[y * w + x + (w - d)];
      else if (dir === 'up') v = y < h - d ? A[(y + d) * w + x] : B[(y - (h - d)) * w + x];
      else v = y >= d ? A[(y - d) * w + x] : B[(y + (h - d)) * w + x];
      s += Math.abs(m.luma[y * w + x] - v);
    }
  }
  return s / (w * h);
}

export function classifyTransition(pics: Pic[]): { presetId: string | null; from: number; to: number } {
  const n = pics.length;
  if (n < 5) return { presetId: null, from: pics[0]?.t ?? 0, to: pics[n - 1]?.t ?? 0 };
  // How much of a frame is already the second picture (pixels that clearly tell the two apart).
  const shareB = (l: Float32Array, a: Float32Array, b: Float32Array) => {
    let inB = 0;
    let inA = 0;
    for (let i = 0; i < l.length; i++) {
      const span = Math.abs(a[i] - b[i]);
      if (span < 0.12) continue;
      if (Math.abs(l[i] - b[i]) < 0.3 * span) inB++;
      else if (Math.abs(l[i] - a[i]) < 0.3 * span) inA++;
    }
    return { inA, inB, all: inA + inB };
  };
  // Frames that are neither picture yet: mixed everywhere (dissolves, fades) or partly one and partly the other
  // (wipes, shapes, slides). Found against the window's ends, then again against the steady frames right next to the
  // change, so slow movement in the shots themselves does not blur the answer.
  const changing = (a: Float32Array, b: Float32Array) => {
    const dab = diff(a, b);
    return pics.map((p) => {
      const sh = shareB(p.luma, a, b);
      const part = sh.all > 0 && sh.inB > 0.08 * sh.all && sh.inA > 0.08 * sh.all;
      return (diff(p.luma, a) > 0.3 * dab && diff(p.luma, b) > 0.3 * dab) || part;
    });
  };
  let flags = changing(pics[0].luma, pics[n - 1].luma);
  let first = flags.indexOf(true);
  let last = flags.lastIndexOf(true);
  if (first > 0 && last >= 0 && last < n - 1) {
    flags = changing(pics[first - 1].luma, pics[last + 1].luma);
    first = Math.max(first - 1, flags.indexOf(true));
    last = Math.min(last + 1, flags.lastIndexOf(true));
  }
  const A = pics[Math.max(0, first - 1)].luma;
  const B = pics[Math.min(n - 1, last + 1)].luma;
  const dAB = diff(A, B);
  const mids = first < 0 ? [] : pics.slice(first, last + 1);
  const from = mids[0]?.t ?? pics[Math.floor(n / 2)].t;
  const to = mids.at(-1)?.t ?? from;
  if (mids.length < 2) return { presetId: null, from, to };
  const [ma, mb] = [mean(A), mean(B)];
  const lows = Math.min(...mids.map((p) => mean(p.luma)));
  const highs = Math.max(...mids.map((p) => mean(p.luma)));
  if (lows < 0.06 && ma > 0.1 && mb > 0.1) return { presetId: 'fade-black', from, to };
  if (highs > 0.85 && ma < 0.75 && mb < 0.75) return { presetId: to - from <= 0.3 ? 'flash' : 'fade-white', from, to };
  const votes = new Map<string, number>();
  const vote = (id: string) => votes.set(id, (votes.get(id) ?? 0) + 1);
  const core = mids.slice(Math.floor(mids.length * 0.2), Math.ceil(mids.length * 0.8)).filter(Boolean);
  for (const m of core.length ? core : mids) {
    const { w, h, luma } = m;
    const cost = (pick: (i: number) => number) => {
      let e = 0;
      for (let i = 0; i < luma.length; i++) e += Math.abs(luma[i] - pick(i));
      return e / luma.length;
    };
    const fits: [string, number][] = [];
    // A mix of both pictures everywhere: a dissolve.
    let num = 0;
    let den = 0;
    for (let i = 0; i < luma.length; i++) {
      num += (luma[i] - A[i]) * (B[i] - A[i]);
      den += (B[i] - A[i]) ** 2;
    }
    const alpha = den ? Math.min(1, Math.max(0, num / den)) : 0;
    if (alpha > 0.1 && alpha < 0.9) fits.push(['dissolve', cost((i) => A[i] + alpha * (B[i] - A[i]))]);
    // Part one picture, part the other, split along a line (a wipe) or a circle round the middle.
    const isB = new Float32Array(luma.length).fill(-1);
    for (let i = 0; i < luma.length; i++) {
      const span = Math.abs(A[i] - B[i]);
      if (span < 0.12) continue;
      const ea = Math.abs(luma[i] - A[i]);
      const eb = Math.abs(luma[i] - B[i]);
      isB[i] = eb < ea ? 1 : 0;
    }
    const share = (key: (x: number, y: number) => number, bins: number) => {
      const s = new Float32Array(bins);
      const c = new Float32Array(bins);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = isB[y * w + x];
        if (v < 0) continue;
        const k = Math.min(bins - 1, key(x, y));
        s[k] += v;
        c[k]++;
      }
      return [...s].map((v, k) => (c[k] ? v / c[k] : 0.5));
    };
    const R = Math.hypot(w, h) / 2;
    const geo: [string, (x: number, y: number) => number, number][] = [
      ['wipe', (x) => Math.floor((x * 16) / w), 16],
      ['wipe', (_, y) => Math.floor((y * 16) / h), 16],
      ['circle', (x, y) => Math.floor((Math.hypot(x - (w - 1) / 2, y - (h - 1) / 2) / R) * 12), 12],
    ];
    for (const [id, key, bins] of geo) {
      const st = stepFit(share(key, bins));
      if (st.quality < 0.8) continue;
      const bSide = (i: number) => {
        const k = key(i % w, Math.floor(i / w));
        return k < st.k === st.highFirst;
      };
      // A clean split is strong evidence by itself (a dissolve's pixels side with either picture at random), so it may
      // rebuild the frame a little worse than a blend and still win: soft edges blur the line.
      fits.push([id, cost((i) => (bSide(i) ? B[i] : A[i])) * (st.quality >= 0.9 ? 0.6 : 1)]);
    }
    // The first picture pushed out by the second: a slide.
    for (const dir of ['left', 'right', 'up', 'down'] as Dir[]) {
      const len = dir === 'left' || dir === 'right' ? w : h;
      let best = Infinity;
      for (let d = 1; d < len; d++) best = Math.min(best, pushCost(m, A, B, dir, d));
      fits.push([`slide-${dir}`, best]);
    }
    const [id, c] = fits.sort((x, y) => x[1] - y[1])[0];
    if (c < 0.3 * dAB) vote(id);
  }
  const top = [...votes.entries()].sort((x, y) => y[1] - x[1])[0];
  return { presetId: top && top[1] >= Math.max(1, (core.length || mids.length) * 0.4) ? top[0] : null, from, to };
}
