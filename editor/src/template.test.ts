import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEC, applyTemplate, assertValid, newProject } from './timeline.ts';
import type { MediaAsset, TextClip } from './schema.ts';

const video: MediaAsset = { id: 'v', kind: 'video', name: 'v.mp4', file: 'media/p/v', bytes: 1, duration: 20 * SEC, width: 1080, height: 1920, rotation: 0, hasAudio: true };
const hole: MediaAsset = { id: 'h', kind: 'photo', name: 'ช่องว่าง.png', file: 'media/p/h', bytes: 1, duration: 0, width: 360, height: 640, rotation: 0, hasAudio: false, placeholder: true };
const spot = (text: string, cy: number) => ({ cx: 0.5, cy, w: 0.6, h: 0.08, fill: '#ffffff', stroke: '#000000', background: null, angle: 0, text });

test('template: read transitions become real transitions, and on-screen words become text layers', () => {
  const p = newProject('p', 't', video, '2026-01-01T00:00:00Z');
  applyTemplate(p, [
    { seconds: 1.5, in: null, out: null, combo: null, texts: [spot('BIG SALE', 0.15)] },
    { seconds: 1.5, in: null, out: null, combo: null, transition: { presetId: 'wipe', seconds: 0.4 }, texts: [spot('BIG SALE', 0.15), spot('รีวิว', 0.85)] },
    { seconds: 2, in: null, out: null, combo: null, transition: { presetId: 'fade-black', seconds: 0.6 } },
    { seconds: 2, in: null, out: null, combo: null, transition: { presetId: 'no-such-thing', seconds: 0.5 } },
  ], hole);
  assertValid(p);
  assert.deepEqual(p.transitions.map((t) => t.presetId), ['wipe', 'fade-black']);
  const texts = p.tracks.flatMap((t) => t.clips).filter((c): c is TextClip => c.kind === 'text');
  assert.equal(texts.length, 2, 'the same words over two slots are one layer');
  const sale = texts.find((t) => t.text === 'BIG SALE')!;
  assert.equal(sale.start, 0);
  assert.equal(sale.duration, 3 * SEC);
  const review = texts.find((t) => t.text === 'รีวิว')!;
  assert.equal(review.start, 1.5 * SEC);
  assert.equal(review.duration, 1.5 * SEC);
  assert.ok(Math.abs(review.transform.y - 0.85) < 1e-9);
});
