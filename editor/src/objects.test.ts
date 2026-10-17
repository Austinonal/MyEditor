import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findGraphics, iou, mergeDetections, peopleBoxes, scaleForBox, splitByFaces } from './objects.ts';

const W = 160;
const H = 90;
function canvas() {
  const px = new Uint8ClampedArray(W * H * 4);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  // a photo-like background: a soft gradient with grain, no flat areas
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px.set([60 + x * 0.6 + rnd() * 40, 90 + y * 0.8 + rnd() * 40, 120 + rnd() * 40, 255], (y * W + x) * 4);
  const fill = (test: (x: number, y: number) => boolean, c: number[]) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (test(x, y)) px.set([...c, 255], (y * W + x) * 4);
  };
  return { px, fill };
}

test('graphics: a sticker, an arrow, an emoji and a badge are all found; grain is not', () => {
  const { px, fill } = canvas();
  fill((x, y) => (x - 25) ** 2 + (y - 25) ** 2 < 14 ** 2, [255, 214, 0]); // emoji face
  fill((x, y) => (x - 20) ** 2 + (y - 21) ** 2 < 2.5 ** 2 || (x - 30) ** 2 + (y - 21) ** 2 < 2.5 ** 2, [20, 20, 20]); // its eyes
  fill((x, y) => x >= 60 && x < 90 && y >= 40 && y < 50, [230, 30, 30]); // arrow shaft
  fill((x, y) => x >= 90 && x < 104 && Math.abs(y - 45) <= (104 - x) * 0.8, [230, 30, 30]); // arrow head
  fill((x, y) => x >= 115 && x < 150 && y >= 10 && y < 26, [20, 90, 230]); // badge
  fill((x, y) => (x - 130) ** 2 + (y - 65) ** 2 < 12 ** 2 && (x - 130) ** 2 + (y - 65) ** 2 > 9 ** 2, [255, 255, 255]); // highlight ring
  const g = findGraphics(px, W, H, []);
  const near = (cx: number, cy: number) => g.some((b) => Math.abs(b.cx - cx / W) < 0.05 && Math.abs(b.cy - cy / H) < 0.08);
  assert.ok(near(25, 25), 'emoji');
  assert.ok(near(82, 45), 'arrow');
  assert.ok(near(132, 18), 'badge');
  assert.ok(near(130, 65), 'ring');
  assert.equal(g.length, 4, JSON.stringify(g.map((b) => [b.cx.toFixed(2), b.cy.toFixed(2)])));
});

test('graphics: anything inside taken boxes (text, people) is left out', () => {
  const { px, fill } = canvas();
  fill((x, y) => x >= 115 && x < 150 && y >= 10 && y < 26, [20, 90, 230]);
  assert.equal(findGraphics(px, W, H, [{ cx: 132 / W, cy: 18 / H, w: 0.3, h: 0.3 }]).length, 0);
});

test('people: two separate figures give two boxes; a cut-off hand joins its figure', () => {
  const a = new Uint8Array(W * H);
  const fill = (x0: number, y0: number, x1: number, y1: number) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) a[y * W + x] = 255; };
  fill(10, 20, 40, 90);
  fill(41, 50, 44, 56); // a hand just off the first figure, cut away
  fill(100, 10, 140, 90);
  const p = peopleBoxes(a, W, H);
  assert.equal(p.length, 2);
  assert.ok(p.some((b) => Math.abs(b.cx - 120 / W) < 0.02));
});

test('people: faces split a figure made of two people standing close', () => {
  const one = [{ cx: 0.5, cy: 0.5, w: 0.6, h: 0.9 }];
  const faces = [{ cx: 0.35, cy: 0.2, w: 0.1, h: 0.15 }, { cx: 0.65, cy: 0.22, w: 0.1, h: 0.15 }];
  const s = splitByFaces(one, faces);
  assert.equal(s.length, 2);
  assert.ok(Math.abs(s[0].cx - 0.35) < 0.03 && Math.abs(s[1].cx - 0.65) < 0.03);
  assert.equal(splitByFaces(one, faces.slice(0, 1)).length, 1);
});

test('detections: objects added, duplicates of people and text dropped, a missed person added', () => {
  const people = [{ cx: 0.3, cy: 0.5, w: 0.3, h: 0.9 }];
  const found = [
    { cx: 0.3, cy: 0.5, w: 0.28, h: 0.85, label: 'person', score: 0.9 }, // same person
    { cx: 0.85, cy: 0.7, w: 0.1, h: 0.4, label: 'person', score: 0.6 }, // missed by the mask
    { cx: 0.6, cy: 0.6, w: 0.15, h: 0.2, label: 'cup', score: 0.7 },
    { cx: 0.6, cy: 0.6, w: 0.14, h: 0.19, label: 'cup', score: 0.4 }, // a second guess at the same cup
    { cx: 0.6, cy: 0.1, w: 0.2, h: 0.08, label: 'book', score: 0.5 }, // that's the title text
  ];
  const m = mergeDetections(people, found, [{ cx: 0.6, cy: 0.1, w: 0.3, h: 0.1 }]);
  assert.deepEqual(m.map((x) => x.kind + (x.label ? ':' + x.label : '')).sort(), ['object:cup', 'person', 'person:person']);
});

test('placeholder scale covers the box', () => {
  const s = scaleForBox(3 / 4, 16 / 9, { cx: 0.5, cy: 0.5, w: 0.2, h: 0.5 });
  // at scale 1 a 3:4 picture in a 16:9 frame is 0.42 wide and full height
  assert.ok(s * 0.421875 >= 0.2 - 1e-9 && s >= 0.5);
  assert.ok(iou({ cx: 0.5, cy: 0.5, w: 1, h: 1 }, { cx: 0.5, cy: 0.5, w: 1, h: 1 }) === 1);
});

import { SEC, applyLayout, newThumbnail, assertValid } from './timeline.ts';
import type { MediaAsset, MediaClip } from './schema.ts';

test('applying a layout with many spots: one slot each, people cut out, stacked objects < people < stickers', () => {
  const photo = (id: string, w: number, h: number): MediaAsset => ({ id, kind: 'photo', name: id, file: `media/p/${id}`, bytes: 1, duration: 0, width: w, height: h, rotation: 0, hasAudio: false, placeholder: true });
  const bg: MediaAsset = { ...photo('bg', 1280, 720), placeholder: false };
  const p = newThumbnail('p', 't', bg, '2026-01-01T00:00:00Z');
  const spots = [
    { kind: 'graphic' as const, cx: 0.9, cy: 0.85, w: 0.08, h: 0.15, score: 0.5 },
    { kind: 'person' as const, cx: 0.2, cy: 0.55, w: 0.25, h: 0.8, score: 1 },
    { kind: 'person' as const, cx: 0.8, cy: 0.4, w: 0.2, h: 0.5, score: 1 },
    { kind: 'object' as const, cx: 0.55, cy: 0.3, w: 0.15, h: 0.2, label: 'cup', score: 0.8 },
  ];
  const slots = [photo('g', 360, 360), photo('a', 270, 360), photo('b', 270, 360), photo('o', 480, 360)];
  applyLayout(p, { aspect: '16:9', person: spots[1], texts: [], spots }, { ...bg, id: 'ref' }, null, slots);
  assertValid(p);
  const overlays = p.tracks.filter((t) => t.kind === 'overlay').flatMap((t) => t.clips as MediaClip[]);
  assert.equal(overlays.length, 4);
  const order = p.tracks.flatMap((t) => t.clips).map((c) => (c as MediaClip).assetId).filter((id) => ['g', 'a', 'b', 'o'].includes(id));
  assert.deepEqual(order, ['o', 'a', 'b', 'g']);
  assert.equal(overlays.filter((c) => c.cutout?.bg === 'clear').length, 2);
  const cup = overlays.find((c) => c.assetId === 'o')!;
  assert.ok(Math.abs(cup.transform.x - 0.55) < 1e-9 && Math.abs(cup.transform.y - 0.3) < 1e-9);
  void SEC;
});
