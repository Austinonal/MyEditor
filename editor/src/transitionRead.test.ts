import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTransition, type Pic } from './transitionRead.ts';

const W = 48;
const H = 64;
// Two pictures with structure everywhere (so every pixel tells them apart).
const picture = (seed: number) => {
  const a = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a[y * W + x] = 0.5 + 0.35 * Math.sin((x + seed * 7) * 0.31 + seed) * Math.cos((y - seed * 3) * 0.23);
  return a;
};
const A = picture(1);
const B = picture(4);
const make = (f: (x: number, y: number, q: number) => number, frames = 16): Pic[] => {
  const out: Pic[] = [];
  for (let k = 0; k < 4; k++) out.push({ t: k / 30, w: W, h: H, luma: A });
  for (let k = 1; k < frames; k++) {
    const q = k / frames;
    const l = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) l[y * W + x] = f(x, y, q);
    out.push({ t: (3 + k) / 30, w: W, h: H, luma: l });
  }
  for (let k = 0; k < 4; k++) out.push({ t: (3 + frames + k) / 30, w: W, h: H, luma: B });
  return out;
};
const at = (img: Float32Array, x: number, y: number) => img[y * W + x];

const cases: [string, (x: number, y: number, q: number) => number][] = [
  ['dissolve', (x, y, q) => at(A, x, y) * (1 - q) + at(B, x, y) * q],
  ['fade-black', (x, y, q) => (q < 0.5 ? at(A, x, y) * (1 - 2 * q) : at(B, x, y) * (2 * q - 1))],
  ['fade-white', (x, y, q) => (q < 0.5 ? at(A, x, y) + (1 - at(A, x, y)) * 2 * q : 1 - (1 - at(B, x, y)) * (2 * q - 1))],
  ['wipe', (x, y, q) => (x < q * W ? at(B, x, y) : at(A, x, y))],
  ['circle', (x, y, q) => (Math.hypot(x - (W - 1) / 2, y - (H - 1) / 2) < q * Math.hypot(W, H) / 2 ? at(B, x, y) : at(A, x, y))],
  ['slide-left', (x, y, q) => { const d = Math.round(q * W); return x < W - d ? at(A, x + d, y) : at(B, x - (W - d), y); }],
  ['slide-up', (x, y, q) => { const d = Math.round(q * H); return y < H - d ? at(A, x, y + d) : at(B, x, y - (H - d)); }],
];

for (const [want, f] of cases) {
  test(`reads a ${want}`, () => {
    const r = classifyTransition(make(f));
    assert.equal(r.presetId, want);
    assert.ok(r.to > r.from, JSON.stringify(r));
  });
}

test('a plain cut is no transition', () => {
  const pics: Pic[] = [...Array.from({ length: 8 }, (_, k) => ({ t: k / 30, w: W, h: H, luma: A })), ...Array.from({ length: 8 }, (_, k) => ({ t: (8 + k) / 30, w: W, h: H, luma: B }))];
  assert.equal(classifyTransition(pics).presetId, null);
});

test('a short white flash reads as a flash', () => {
  const r = classifyTransition(make((x, y, q) => (q < 0.5 ? at(A, x, y) + (1 - at(A, x, y)) * 2 * q : 1 - (1 - at(B, x, y)) * (2 * q - 1)), 6));
  assert.equal(r.presetId, 'flash');
});
