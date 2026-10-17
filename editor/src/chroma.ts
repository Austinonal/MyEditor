// Chroma key (green screen): pixels near the key colour turn transparent. Pure on RGBA bytes, so it is unit-tested;
// render.ts runs it on the clip's picture. The distance is measured on the colour plane (Cb, Cr) so shadows on the screen
// (darker green) still count as screen.

export interface Chroma {
  colour: string; // #rrggbb
  similarity: number; // 0..1, how far from the key colour still goes fully transparent
  smoothness: number; // 0..1, the soft edge beyond that
}

export const DEFAULT_CHROMA: Chroma = { colour: '#00ff00', similarity: 0.4, smoothness: 0.15 };
export const KEY_COLOURS = ['#00ff00', '#00b140', '#0047ff', '#ffffff', '#000000'];

const MAX_DIST = 181; // the longest distance on the Cb/Cr plane (both go -128..128)

const cb = (r: number, g: number, b: number) => -0.168736 * r - 0.331264 * g + 0.5 * b;
const cr = (r: number, g: number, b: number) => 0.5 * r - 0.418688 * g - 0.081312 * b;

export function parseHex(c: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})/i.exec(c);
  const n = m ? parseInt(m[1], 16) : 0x00ff00;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const smooth = (x: number) => x * x * (3 - 2 * x);

// Edits `data` in place: alpha falls to 0 on the key colour, and edge pixels lose the key's tint (spill).
export function chromaKey(data: Uint8ClampedArray, c: Chroma): void {
  const [kr, kg, kb] = parseHex(c.colour);
  const kcb = cb(kr, kg, kb);
  const kcr = cr(kr, kg, kb);
  const lo = Math.min(1, Math.max(0, c.similarity)) * MAX_DIST;
  const hi = lo + Math.max(0.001, Math.min(1, c.smoothness)) * MAX_DIST;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const d = Math.hypot(cb(r, g, b) - kcb, cr(r, g, b) - kcr);
    if (d >= hi) continue;
    const a = d <= lo ? 0 : smooth((d - lo) / (hi - lo));
    data[i + 3] = Math.round(data[i + 3] * a);
    if (a > 0) {
      // spill: pull the edge pixel towards grey in proportion to how much of it was key
      const grey = 0.299 * r + 0.587 * g + 0.114 * b;
      const k = (1 - a) * 0.6;
      data[i] = r + (grey - r) * k;
      data[i + 1] = g + (grey - g) * k;
      data[i + 2] = b + (grey - b) * k;
    }
  }
}
