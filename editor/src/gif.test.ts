import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gifFrame, gifHeader, lzw, quantize } from './gif.ts';

// A plain GIF LZW decoder, to check the encoder against.
function unlzw(block: Uint8Array): number[] {
  const bytes: number[] = [];
  for (let i = 1; block[i]; i += block[i] + 1) bytes.push(...block.slice(i + 1, i + 1 + block[i]));
  let size = 9;
  let pos = 0;
  const read = () => {
    let v = 0;
    for (let b = 0; b < size; b++, pos++) v |= ((bytes[pos >> 3] >> (pos & 7)) & 1) << b;
    return v;
  };
  let dict: number[][] = [];
  const reset = () => {
    dict = Array.from({ length: 258 }, (_, i) => [i]);
    size = 9;
  };
  reset();
  const out: number[] = [];
  let prev: number[] | null = null;
  for (;;) {
    const code = read();
    if (code === 256) {
      reset();
      prev = null;
      continue;
    }
    if (code === 257) break;
    const entry = code < dict.length ? dict[code] : [...prev!, prev![0]];
    out.push(...entry);
    if (prev) dict.push([...prev, entry[0]]);
    if (dict.length === 1 << size && size < 12) size++;
    prev = entry;
  }
  return out;
}

test('LZW round-trips, including long runs that fill the 4096-code table', () => {
  const noise = Uint8Array.from({ length: 30_000 }, (_, i) => (i * 7919) % 251 ^ (i >> 4));
  const runs = new Uint8Array(20_000).fill(9);
  for (const data of [noise, runs, Uint8Array.of(5)]) assert.deepEqual(unlzw(lzw(data)), [...data]);
});

test('palette: pure colours map to their own index, header and frame have the right shape', () => {
  const px = Uint8ClampedArray.from([255, 0, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255]);
  assert.deepEqual([...quantize(px, 4, 1)], [0b11100000, 0b00000011, 255, 0]);
  const h = gifHeader(320, 240);
  assert.equal(new TextDecoder().decode(h.slice(0, 6)), 'GIF89a');
  assert.equal(h.length, 13 + 768 + 19);
  const f = gifFrame(px, 4, 1, 7);
  assert.deepEqual([...f.slice(0, 2)], [0x21, 0xf9]);
  assert.equal(f[4], 7);
  assert.equal(f.at(-1), 0);
});
