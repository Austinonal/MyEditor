// Masks: show a clip only inside (or outside) a shape, with a soft edge. Pure, so it is unit-tested; render.ts scales the
// small alpha picture this makes up to the clip.

export type MaskShape = 'circle' | 'rect' | 'heart' | 'star' | 'line' | 'band';

export interface Mask {
  shape: MaskShape;
  size: number; // 0.1..1.5, fraction of the clip's shorter side (rect and band: of the width and height)
  x: number; // centre, 0..1 across the clip
  y: number;
  feather: number; // 0..1 soft edge
  invert: boolean;
}

export const DEFAULT_MASK: Mask = { shape: 'circle', size: 0.7, x: 0.5, y: 0.5, feather: 0.15, invert: false };

export const MASK_SHAPES: [MaskShape, string][] = [
  ['circle', 'วงกลม'],
  ['rect', 'สี่เหลี่ยม'],
  ['heart', 'หัวใจ'],
  ['star', 'ดาว'],
  ['line', 'เส้นแบ่ง'],
  ['band', 'แถบ'],
];

// Signed distance in "radii": negative inside the shape, positive outside. dx, dy are in pixels from the centre.
function distance(shape: MaskShape, dx: number, dy: number, R: number, w: number, h: number, size: number): number {
  switch (shape) {
    case 'circle':
      return (Math.hypot(dx, dy) - R) / R;
    case 'rect':
      return Math.max(Math.abs(dx) / ((size * w) / 2), Math.abs(dy) / ((size * h) / 2)) - 1;
    case 'band':
      return Math.abs(dy) / ((size * h) / 2) - 1;
    case 'line':
      return dx / R;
    case 'star': {
      const a = Math.atan2(dy, dx) + Math.PI / 2;
      return (Math.hypot(dx, dy) - R * (0.62 + 0.38 * Math.cos(5 * a))) / R;
    }
    case 'heart': {
      const x = (dx / R) * 1.15;
      const y = (-dy / R) * 1.15 + 0.15;
      const f = (x * x + y * y - 1) ** 3 - x * x * y ** 3;
      return Math.sign(f) * Math.cbrt(Math.abs(f)) * 0.5;
    }
  }
}

// One alpha byte per pixel, 255 where the clip shows.
export function maskAlpha(w: number, h: number, m: Mask): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h);
  const R = (Math.max(0.05, m.size) * Math.min(w, h)) / 2;
  const soft = Math.max(1.2 / R, m.feather * 0.6); // never sharper than one pixel
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const d = distance(m.shape, i + 0.5 - m.x * w, j + 0.5 - m.y * h, R, w, h, m.size);
      let a = 0.5 - d / (2 * soft);
      a = a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a);
      out[j * w + i] = Math.round((m.invert ? 1 - a : a) * 255);
    }
  }
  return out;
}
