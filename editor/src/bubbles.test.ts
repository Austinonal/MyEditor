import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUBBLES, BUBBLE_PAD, GRADIENTS, bubbleOutline } from './bubbles.ts';

test('every bubble surrounds the text box and stays inside the room left for it', () => {
  const [w, h] = [300, 60];
  for (const [shape] of BUBBLES) {
    const o = bubbleOutline(shape, w, h);
    const xs = [...o.main.map((p) => p[0]), ...o.dots.flatMap((d) => [d.x - d.r, d.x + d.r])];
    const ys = [...o.main.map((p) => p[1]), ...o.dots.flatMap((d) => [d.y - d.r, d.y + d.r])];
    assert.ok(Math.min(...xs) < 0 && Math.max(...xs) > w && Math.min(...ys) < 0 && Math.max(...ys) > h, `${shape} covers the text`);
    const room = h * BUBBLE_PAD + h; // what text.ts leaves (pad plus the text's own margin), generously
    assert.ok(Math.min(...xs) > -room * 1.6 && Math.max(...xs) < w + room * 1.6 && Math.max(...ys) < h + room, `${shape} fits its room`);
    assert.ok(o.main.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
  }
});

test('a speech bubble has a tail below it; a thought bubble has a trail of dots', () => {
  const s = bubbleOutline('speech', 300, 60);
  const lowest = Math.max(...s.main.map((p) => p[1]));
  assert.ok(lowest > 60 + 60 * 0.35 + 10, 'tail reaches below the box');
  assert.equal(bubbleOutline('thought', 300, 60).dots.length, 2);
});

test('gradients have at least two colours', () => {
  for (const [, g] of GRADIENTS) assert.ok(g.colours.length >= 2 && g.colours.every((c) => /^#[0-9a-f]{6}$/i.test(c)));
});
