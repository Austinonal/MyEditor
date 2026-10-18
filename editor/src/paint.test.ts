import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STICKER_GROUPS, floodFill } from './paint.ts';

const W = 20;
const H = 10;
const blank = () => new Uint8ClampedArray(W * H * 4); // transparent
const px = (d: Uint8ClampedArray, x: number, y: number) => [...d.slice((y * W + x) * 4, (y * W + x) * 4 + 4)];

test('fill stops at a line and fills only its side', () => {
  const d = blank();
  for (let y = 0; y < H; y++) d.set([0, 0, 0, 255], (y * W + 10) * 4); // a black wall at x = 10
  const n = floodFill(d, W, H, 2, 2, [255, 0, 0, 255]);
  assert.equal(n, 10 * H);
  assert.deepEqual(px(d, 0, 0), [255, 0, 0, 255]);
  assert.deepEqual(px(d, 10, 5), [0, 0, 0, 255]);
  assert.deepEqual(px(d, 15, 5), [0, 0, 0, 0]);
});

test('filling with the same colour or outside the picture changes nothing', () => {
  const d = blank();
  assert.equal(floodFill(d, W, H, 3, 3, [0, 0, 0, 0]), 0);
  assert.equal(floodFill(d, W, H, -1, 3, [255, 0, 0, 255]), 0);
});

test('tolerance lets soft edges join the fill', () => {
  const d = blank();
  d.set([10, 0, 0, 10], (5 * W + 5) * 4); // nearly transparent speck
  assert.equal(floodFill(d, W, H, 0, 0, [0, 255, 0, 255], 32), W * H);
});

test('sticker groups have no repeats inside a group', () => {
  for (const [, list] of STICKER_GROUPS) assert.equal(new Set(list).size, list.length);
});
