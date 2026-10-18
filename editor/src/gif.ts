// A small animated GIF writer for export: one fixed 256-colour palette (3 bits red, 3 green, 2 blue) with ordered
// dithering, so frames can be written one at a time as they render. shortcut: fixed palette bands on soft gradients;
// build a palette per frame (median cut) if people need nicer GIFs.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function gifHeader(width: number, height: number): Uint8Array<ArrayBuffer> {
  const out = [...'GIF89a'].map((c) => c.charCodeAt(0));
  out.push(width & 255, width >> 8, height & 255, height >> 8, 0xf7, 0, 0); // global table of 2^(7+1) colours
  for (let i = 0; i < 256; i++) out.push(Math.round(((i >> 5) * 255) / 7), Math.round((((i >> 2) & 7) * 255) / 7), Math.round(((i & 3) * 255) / 3));
  out.push(0x21, 0xff, 11, ...[...'NETSCAPE2.0'].map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0); // loop forever
  return Uint8Array.from(out);
}

export const GIF_END = Uint8Array.of(0x3b);

// Palette index per pixel, dithered so gradients do not band as hard.
export function quantize(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const d = BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5;
      const r = Math.min(7, Math.max(0, Math.round((rgba[i * 4] * 7) / 255 + d)));
      const g = Math.min(7, Math.max(0, Math.round((rgba[i * 4 + 1] * 7) / 255 + d)));
      const b = Math.min(3, Math.max(0, Math.round((rgba[i * 4 + 2] * 3) / 255 + d)));
      out[i] = (r << 5) | (g << 2) | b;
    }
  }
  return out;
}

// LZW with 8-bit pixels, codes packed little-end first, in sub-blocks of at most 255 bytes.
export function lzw(indices: Uint8Array): Uint8Array<ArrayBuffer> {
  const CLEAR = 256;
  const END = 257;
  const bytes: number[] = [];
  let bits = 0;
  let acc = 0;
  let size = 9;
  const put = (code: number) => {
    acc |= code << bits;
    bits += size;
    while (bits >= 8) {
      bytes.push(acc & 255);
      acc >>= 8;
      bits -= 8;
    }
  };
  let dict = new Map<number, number>();
  let next = 258;
  put(CLEAR);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const hit = dict.get(key);
    if (hit !== undefined) {
      prefix = hit;
      continue;
    }
    put(prefix);
    if (next === 4096) {
      put(CLEAR);
      dict = new Map();
      next = 258;
      size = 9;
    } else {
      dict.set(key, next++);
      if (next > 1 << size && size < 12) size++;
    }
    prefix = k;
  }
  put(prefix);
  put(END);
  if (bits) bytes.push(acc & 255);
  const out = [8];
  for (let i = 0; i < bytes.length; i += 255) out.push(Math.min(255, bytes.length - i), ...bytes.slice(i, i + 255));
  out.push(0);
  return Uint8Array.from(out);
}

export function gifFrame(rgba: Uint8ClampedArray, width: number, height: number, delayCs: number): Uint8Array<ArrayBuffer> {
  const data = lzw(quantize(rgba, width, height));
  const head = [0x21, 0xf9, 4, 0, delayCs & 255, delayCs >> 8, 0, 0, 0x2c, 0, 0, 0, 0, width & 255, width >> 8, height & 255, height >> 8, 0];
  const out = new Uint8Array(head.length + data.length);
  out.set(head);
  out.set(data, head.length);
  return out;
}
