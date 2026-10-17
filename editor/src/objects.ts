// More of a reference thumbnail than "one person and the text": every person, real-world objects (from the detector in
// thumbnail.ts) and flat graphics (stickers, arrows, emoji, badges, highlight circles). Pure, so it is unit-tested.
import type { Box } from './layout.ts';

export interface Spot extends Box {
  kind: 'person' | 'object' | 'graphic';
  label?: string; // what the detector called it, for the layer name
  score: number; // 0..1
}

type Px = { x0: number; y0: number; x1: number; y1: number }; // inclusive pixel bounds

const toBox = (b: Px, w: number, h: number): Box => ({ cx: (b.x0 + b.x1 + 1) / 2 / w, cy: (b.y0 + b.y1 + 1) / 2 / h, w: (b.x1 - b.x0 + 1) / w, h: (b.y1 - b.y0 + 1) / h });
const edges = (b: Box) => [b.cx - b.w / 2, b.cy - b.h / 2, b.cx + b.w / 2, b.cy + b.h / 2];

export function iou(a: Box, b: Box) {
  const [ax0, ay0, ax1, ay1] = edges(a);
  const [bx0, by0, bx1, by1] = edges(b);
  const i = Math.max(0, Math.min(ax1, bx1) - Math.max(ax0, bx0)) * Math.max(0, Math.min(ay1, by1) - Math.max(ay0, by0));
  return i / (a.w * a.h + b.w * b.h - i || 1);
}
// How much of `a` lies inside `b`.
export function inside(a: Box, b: Box) {
  const [ax0, ay0, ax1, ay1] = edges(a);
  const [bx0, by0, bx1, by1] = edges(b);
  const i = Math.max(0, Math.min(ax1, bx1) - Math.max(ax0, bx0)) * Math.max(0, Math.min(ay1, by1) - Math.max(ay0, by0));
  return i / (a.w * a.h || 1);
}
const union = (a: Box, b: Box): Box => {
  const [ax0, ay0, ax1, ay1] = edges(a);
  const [bx0, by0, bx1, by1] = edges(b);
  const [x0, y0, x1, y1] = [Math.min(ax0, bx0), Math.min(ay0, by0), Math.max(ax1, bx1), Math.max(ay1, by1)];
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
};

// Connected parts of a mask (1 per pixel), as boxes, biggest first.
function parts(on: (i: number) => boolean, w: number, h: number) {
  const seen = new Uint8Array(w * h);
  const out: (Px & { n: number })[] = [];
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || !on(s)) continue;
    const b = { x0: w, y0: h, x1: -1, y1: -1, n: 0 };
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i - x) / w;
      b.n++;
      [b.x0, b.x1, b.y0, b.y1] = [Math.min(b.x0, x), Math.max(b.x1, x), Math.min(b.y0, y), Math.max(b.y1, y)];
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !seen[j] && on(j)) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    out.push(b);
  }
  return out.sort((a, b) => b.n - a.n);
}

// Every person in the cutout mask (alpha 0..255): one box per separate figure. A hand or a shoulder cut off by another
// layer is joined back to the figure it overlaps.
export function peopleBoxes(alpha: ArrayLike<number>, w: number, h: number, minShare = 0.01): Box[] {
  const boxes: Box[] = [];
  for (const p of parts((i) => alpha[i] >= 128, w, h)) {
    const b = toBox(p, w, h);
    const host = boxes.find((x) => inside(b, x) > 0.6 || iou(b, x) > 0.25);
    if (host) Object.assign(host, union(host, b));
    else if (p.n >= w * h * minShare) boxes.push(b);
  }
  return boxes;
}

// Two people standing close make one shape in the mask; their faces tell them apart. Faces are boxes too.
export function splitByFaces(people: Box[], faces: Box[]): Box[] {
  return people.flatMap((p) => {
    const mine = faces.filter((f) => inside(f, p) > 0.6).sort((a, b) => a.cx - b.cx);
    if (mine.length < 2) return [p];
    const [x0, y0, x1, y1] = edges(p);
    const cuts = [x0, ...mine.slice(1).map((f, i) => (f.cx + mine[i].cx) / 2), x1];
    return cuts.slice(1).map((r, i) => ({ cx: (cuts[i] + r) / 2, cy: (y0 + y1) / 2, w: r - cuts[i], h: y1 - y0 }));
  });
}

// Joins the detector's findings to the people from the mask: a detected person the mask missed is added; other things
// become objects, unless they are mostly a person or a text already found.
export function mergeDetections(people: Box[], found: (Box & { label: string; score: number })[], taken: Box[]): Spot[] {
  const out: Spot[] = people.map((b) => ({ ...b, kind: 'person', score: 1 }));
  for (const d of [...found].sort((a, b) => b.score - a.score)) {
    const { label, score } = d;
    const box: Box = { cx: d.cx, cy: d.cy, w: d.w, h: d.h };
    if (out.some((o) => iou(o, box) > 0.4 || inside(box, o) > 0.8)) continue;
    if (taken.some((t) => inside(box, t) > 0.6)) continue;
    if (label === 'person') {
      if (!out.some((o) => o.kind === 'person' && inside(box, o) > 0.3)) out.push({ ...box, kind: 'person', label, score });
    } else out.push({ ...box, kind: 'object', label, score });
  }
  return out;
}

// Flat graphics: regions of one colour (pixels joined while neighbours stay close), standing out from what is around
// them, not too big (a background) and not too small (a speck of a photo). Parts inside one another (the eyes in an
// emoji, the text on a badge) become one graphic. `taken` (people, objects, text) is left out.
export function findGraphics(rgba: ArrayLike<number>, w: number, h: number, taken: Box[], limit = 12): Spot[] {
  const n = w * h;
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  const dist = (i: number, j: number) => Math.abs(rgba[i * 4] - rgba[j * 4]) + Math.abs(rgba[i * 4 + 1] - rgba[j * 4 + 1]) + Math.abs(rgba[i * 4 + 2] - rgba[j * 4 + 2]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x + 1 < w && dist(i, i + 1) < 36) parent[find(i)] = find(i + 1);
      if (y + 1 < h && dist(i, i + w) < 36) parent[find(i)] = find(i + w);
    }
  }
  const stats = new Map<number, { n: number; x0: number; y0: number; x1: number; y1: number; r: number; g: number; b: number; q: number; ring: number; ringN: number }>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const x = i % w;
    const y = (i - x) / w;
    let s = stats.get(r);
    if (!s) stats.set(r, (s = { n: 0, x0: x, y0: y, x1: x, y1: y, r: 0, g: 0, b: 0, q: 0, ring: 0, ringN: 0 }));
    s.n++;
    [s.x0, s.x1, s.y0, s.y1] = [Math.min(s.x0, x), Math.max(s.x1, x), Math.min(s.y0, y), Math.max(s.y1, y)];
    s.r += rgba[i * 4];
    s.g += rgba[i * 4 + 1];
    s.b += rgba[i * 4 + 2];
    s.q += rgba[i * 4] ** 2 + rgba[i * 4 + 1] ** 2 + rgba[i * 4 + 2] ** 2;
  }
  // Contrast with the outside: how far the pixels just across the region's edge are from the region's colour.
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i + w < n ? i + w : -1]) {
      if (j < 0 || find(j) === r) continue;
      const s = stats.get(r)!;
      s.ring += Math.abs(rgba[j * 4] - s.r / s.n) + Math.abs(rgba[j * 4 + 1] - s.g / s.n) + Math.abs(rgba[j * 4 + 2] - s.b / s.n);
      s.ringN++;
    }
  }
  const cands: (Box & { n: number })[] = [];
  for (const s of stats.values()) {
    const bw = s.x1 - s.x0 + 1;
    const bh = s.y1 - s.y0 + 1;
    const touches = +(s.x0 === 0) + +(s.y0 === 0) + +(s.x1 === w - 1) + +(s.y1 === h - 1);
    if (s.n < n * 0.003 || bw * bh > n * 0.25 || touches > 1 || s.n / (bw * bh) < 0.12 || Math.min(bw, bh) < 3) continue;
    if (!s.ringN || s.ring / s.ringN < 80) continue; // blends into its surroundings: part of a photo, not a sticker
    // A drawn graphic is one flat colour; sky, sand or a sofa in a photo drift and carry grain, even when they join up.
    const spread = Math.sqrt(Math.max(0, s.q / s.n - ((s.r / s.n) ** 2 + (s.g / s.n) ** 2 + (s.b / s.n) ** 2)) / 3);
    if (spread > 9) continue;
    const box = toBox(s, w, h);
    if (taken.some((t) => inside(box, t) > 0.5)) continue;
    cands.push({ ...box, n: s.n });
  }
  // Join parts that overlap or touch (a little slack), biggest first.
  cands.sort((a, b) => b.w * b.h - a.w * a.h);
  const pad = 1.5 / Math.min(w, h);
  const grown = (b: Box): Box => ({ ...b, w: b.w + pad * 2, h: b.h + pad * 2 });
  const groups: (Box & { n: number })[] = [];
  for (const c of cands) {
    const g = groups.find((x) => inside(c, grown(x)) > 0.5); // the eyes in a face, the words on a badge; neighbours stay apart
    if (g) Object.assign(g, union(g, c), { n: g.n + c.n });
    else groups.push({ ...c });
  }
  return groups
    .filter((g) => g.w * g.h <= 0.3)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map(({ n: _, ...b }) => ({ ...b, kind: 'graphic' as const, score: 0.5 }));
}

// Overlay scale so a picture of aspect `a` (w / h) placed in a frame of aspect `frame` covers the box: 1 = fits the frame.
export function scaleForBox(a: number, frame: number, box: Box) {
  const fit = a > frame ? [1, frame / a] : [a / frame, 1]; // the picture's size at scale 1, frame fractions
  return Math.max(box.w / fit[0], box.h / fit[1]);
}
