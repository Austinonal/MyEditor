// Speech bubbles and caption shapes behind text, as outlines (lists of points) around a w x h text box. Pure, so it is
// unit-tested; text.ts draws them. Coordinates are in the box's own pixels, (0, 0) at its top left; tails and spikes
// reach outside it, so callers leave `BUBBLE_PAD` around the box.

export type BubbleShape = 'speech' | 'thought' | 'shout' | 'capsule' | 'ribbon' | 'box';
export interface Bubble {
  shape: BubbleShape;
  fill: string; // #rrggbbaa
  border: string | null;
}

export const BUBBLES: [BubbleShape, string][] = [
  ['speech', 'คำพูด'],
  ['thought', 'ความคิด'],
  ['shout', 'ตะโกน'],
  ['capsule', 'แคปซูล'],
  ['ribbon', 'ริบบิ้น'],
  ['box', 'กล่องคำบรรยาย'],
];

export const BUBBLE_PAD = 0.45; // of the text height, room for tails and spikes

type Pt = [number, number];
export interface Outline {
  main: Pt[]; // closed outline
  dots: { x: number; y: number; r: number }[]; // thought-bubble trail
}

const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 48): Pt[] => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * 2 * Math.PI), cy + ry * Math.sin((i / n) * 2 * Math.PI)] as Pt);

function rounded(x: number, y: number, w: number, h: number, r: number, n = 6): Pt[] {
  r = Math.min(r, w / 2, h / 2);
  const corner = (cx: number, cy: number, a0: number) => Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos(a0 + (i / n) * (Math.PI / 2)), cy + r * Math.sin(a0 + (i / n) * (Math.PI / 2))] as Pt);
  return [...corner(x + w - r, y + r, -Math.PI / 2), ...corner(x + w - r, y + h - r, 0), ...corner(x + r, y + h - r, Math.PI / 2), ...corner(x + r, y + r, Math.PI)];
}

export function bubbleOutline(shape: BubbleShape, w: number, h: number): Outline {
  const m = h * 0.35; // margin around the text inside the shape
  switch (shape) {
    case 'speech': {
      const box = rounded(-m, -m, w + 2 * m, h + 2 * m, h * 0.5);
      // a tail from the bottom edge, a quarter in from the left, pointing down-left
      const bottom = h + m;
      const at = box.findIndex(([x, y]) => y >= bottom - 0.01 && x < w * 0.35);
      const tail: Pt[] = [[w * 0.3, bottom], [w * 0.12, bottom + h * 0.45], [w * 0.18, bottom]];
      return { main: [...box.slice(0, at), ...tail, ...box.slice(at)], dots: [] };
    }
    case 'thought':
      return { main: ellipse(w / 2, h / 2, w / 2 + m * 1.4, h / 2 + m * 1.2), dots: [{ x: w * 0.15, y: h + m * 1.6, r: h * 0.14 }, { x: w * 0.05, y: h + m * 2.3, r: h * 0.08 }] };
    case 'shout': {
      const n = 22;
      const [rx, ry] = [w / 2 + m * 1.8, h / 2 + m * 1.8];
      return { main: Array.from({ length: n * 2 }, (_, i) => { const a = (i / (n * 2)) * 2 * Math.PI; const k = i % 2 ? 0.78 : 1.05; return [w / 2 + rx * k * Math.cos(a), h / 2 + ry * k * Math.sin(a)] as Pt; }), dots: [] };
    }
    case 'capsule':
      return { main: rounded(-m * 1.5, -m, w + 3 * m, h + 2 * m, h), dots: [] };
    case 'ribbon': {
      const [x0, x1, y0, y1, notch] = [-m * 2.5, w + m * 2.5, -m * 0.6, h + m * 0.6, m * 1.3];
      return { main: [[x0, y0], [x1, y0], [x1 - notch, h / 2], [x1, y1], [x0, y1], [x0 + notch, h / 2]], dots: [] };
    }
    case 'box':
      return { main: [[-m, -m], [w + m, -m], [w + m, h + m], [-m, h + m]], dots: [] };
  }
}

// Gradient fills for letters: colour stops, top to bottom unless `across` (left to right over the whole block).
export interface Gradient {
  colours: string[];
  across: boolean;
}
export const GRADIENTS: [string, Gradient][] = [
  ['พระอาทิตย์ตก', { colours: ['#ffe259', '#ffa751', '#ff4f8b'], across: false }],
  ['ทอง', { colours: ['#fff3b0', '#e6b422', '#a8770d'], across: false }],
  ['ทะเล', { colours: ['#a1ffce', '#32ade6', '#2c3e9e'], across: false }],
  ['ไฟ', { colours: ['#fff200', '#ff7a00', '#e01e1e'], across: false }],
  ['ลูกกวาด', { colours: ['#ff9de2', '#b388ff'], across: true }],
  ['สีรุ้ง', { colours: ['#ff3b30', '#ff9500', '#ffd84d', '#34c759', '#32ade6', '#af52de'], across: true }],
];
