// Thumbnails: reading a reference picture's layout on the device, and the assets a layout needs.
import { createWorker, PSM, type Worker } from 'tesseract.js';
import { findText, nearestAspect, personBox, type Box, type Layout, type TextSpot } from './layout.ts';
import { findGraphics, inside, mergeDetections, peopleBoxes, splitByFaces, type Spot } from './objects.ts';
import { detectFaces, detectObjects, thaiLabel } from './detect';
import { loadSegmenter, personMask } from './segment';
import { importMedia } from './media';
import { placeholderFile } from './screens/TemplateSheet';
import type { Aspect, MediaAsset } from './schema';

// Text reading (Thai and English) ships with the app in public/ocr (scripts/ocr.mjs), so it works offline.
let reader: Promise<Worker> | null = null;
const own = (path: string) => new URL(path, document.baseURI).href;
function ocr() {
  reader ??= createWorker(['tha', 'eng'], 1, { workerPath: own('ocr/worker.min.js'), corePath: own('ocr/tesseract-core-simd-lstm.wasm.js'), langPath: own('ocr'), workerBlobURL: false, gzip: false })
    .then(async (w) => {
      await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
      return w;
    })
    .catch((e) => {
      reader = null;
      throw e;
    });
  return reader;
}

const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const far = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

// One spot, turned level and redrawn as dark letters on white (pixels nearer the letters' colour than the outline's or
// the label's, and than what is outside the spot), then read. Lines read with little confidence or under two letters
// (a collar, a stripe) are dropped; Thai comes back with spaces between letters, and those go too.
async function read(w: Worker, img: ImageBitmap, s: TextSpot) {
  const [pw, ph] = [s.w * img.width * 1.15, s.h * img.height * 1.3];
  const k = Math.min(4, Math.max(0.25, 72 / ph)); // letters about 45 px tall: measured best for Thai display fonts
  const ctx = new OffscreenCanvas(Math.max(8, Math.round(pw * k)), Math.max(8, Math.round(ph * k))).getContext('2d', { willReadFrequently: true })!;
  const { width: cw, height: ch } = ctx.canvas;
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate((-s.angle * Math.PI) / 180);
  ctx.scale(k, k);
  ctx.drawImage(img, -s.cx * img.width, -s.cy * img.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const source = ctx.getImageData(0, 0, cw, ch);
  const edge = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < cw * ch; i++) {
    const x = i % cw;
    const y = (i - x) / cw;
    if ((x > 1 && y > 1 && x < cw - 2 && y < ch - 2) || source.data[i * 4 + 3] < 128) continue; // past the picture's edge
    for (let c = 0; c < 3; c++) edge[c] += source.data[i * 4 + c];
    n++;
  }
  const outside = edge.map((v) => v / Math.max(1, n));
  const around = s.background ? rgbOf(s.background) : outside;
  const fill = rgbOf(s.fill);
  const other = s.stroke ? rgbOf(s.stroke) : around;
  const letter = (c: number[]) => far(c, fill) < Math.min(far(c, other), far(c, outside)) && far(c, fill) < 160;
  const data = new ImageData(cw, ch);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = source.data[i + 3] > 127 && letter([source.data[i], source.data[i + 1], source.data[i + 2]]) ? 0 : 255;
    data.data.set([v, v, v, 255], i);
  }
  ctx.putImageData(data, 0, 0);
  const { data: out } = await w.recognize(ctx.canvas, {}, { text: true, blocks: true });
  const lines = (out.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines)).filter((l) => l.confidence >= 55 && (l.text.match(/[\p{L}\p{N}]/gu)?.length ?? 0) >= 2);
  if (!lines.length) return null;
  // The read lines' own box, back in the picture: a tighter place and size than the block (which may take in a collar).
  const [x0, y0, x1, y1] = [Math.min(...lines.map((l) => l.bbox.x0)), Math.min(...lines.map((l) => l.bbox.y0)), Math.max(...lines.map((l) => l.bbox.x1)), Math.max(...lines.map((l) => l.bbox.y1))];
  const [dx, dy] = [((x0 + x1) / 2 - cw / 2) / k, ((y0 + y1) / 2 - ch / 2) / k];
  const a = (s.angle * Math.PI) / 180;
  return {
    ...s,
    text: lines.map((l) => l.text.replace(/(?<=[\u0E00-\u0E7F])[ \t]+(?=[\u0E00-\u0E7F])/g, '').trim()).join('\n'),
    cx: s.cx + (dx * Math.cos(a) - dy * Math.sin(a)) / img.width,
    cy: s.cy + (dx * Math.sin(a) + dy * Math.cos(a)) / img.height,
    w: (x1 - x0) / k / img.width,
    h: (y1 - y0) / k / img.height,
  };
}

const pixels = (bmp: ImageBitmap, W: number) => {
  const H = Math.max(2, Math.round((W * bmp.height) / bmp.width));
  const ctx = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, W, H);
  return { ctx, W, H, rgba: ctx.getImageData(0, 0, W, H).data };
};
const grow = (b: Box, k: number): Box => ({ ...b, w: b.w * k, h: b.h * k });

// Everything the reference shows, from small copies: every person (the cutout mask, split by faces when two stand
// close), everyday objects (the detector), flat graphics (stickers, arrows, emoji, badges), and the text, read and
// coloured. Text candidates are read; one that reads as nothing is a busy patch and is dropped, so text over a person
// still counts. A detector that fails to load only means fewer kinds of spots.
export async function analyzeThumbnail(file: File, onStatus: (s: string) => void = () => {}): Promise<Layout> {
  onStatus('กำลังหาคนในรูป…');
  await loadSegmenter();
  const bmp = await createImageBitmap(file);
  const aspect = nearestAspect(bmp.width, bmp.height);
  const { ctx, W, H } = pixels(bmp, 320);
  const mask = personMask(ctx.canvas, W, H, `reference|${crypto.randomUUID()}`);
  let alpha: Uint8Array | null = null;
  if (mask) {
    const m = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true })!;
    m.drawImage(mask, 0, 0, W, H);
    const d = m.getImageData(0, 0, W, H).data;
    alpha = Uint8Array.from({ length: W * H }, (_, i) => d[i * 4 + 3]);
  }
  const big = pixels(bmp, 640); // the detectors see more at this size; small text needs it too
  onStatus('กำลังหาสิ่งของและใบหน้าในรูป…');
  const [faces, found] = await Promise.all([
    detectFaces(big.ctx.canvas, big.W, big.H).catch((e) => (console.warn('face detector unavailable:', e), [] as Box[])),
    detectObjects(big.ctx.canvas, big.W, big.H).catch((e) => (console.warn('object detector unavailable:', e), [])),
  ]);
  const onPerson = alpha && alpha.map((a) => (a > 64 ? 1 : 0));
  const small = pixels(bmp, 480);
  let texts: TextSpot[];
  try {
    onStatus('กำลังอ่านข้อความในรูป…');
    const w = await ocr();
    texts = [];
    for (const s of findText(small.rgba, small.W, small.H, null, 24)) {
      const r = await read(w, bmp, s);
      if (r) texts.push(s.background ? { ...s, text: r.text } : r); // a label keeps its box: its font size comes from that
      if (texts.length === 12) break;
    }
  } catch (e) {
    console.warn('text reader unavailable, keeping text off the person:', e);
    const m = onPerson && Uint8Array.from({ length: small.W * small.H }, (_, i) => onPerson[Math.floor(((Math.floor(i / small.W) + 0.5) * H) / small.H) * W + Math.floor((((i % small.W) + 0.5) * W) / small.W)]);
    texts = findText(small.rgba, small.W, small.H, m, 12);
  }
  onStatus('กำลังจัดช่องตามรูปต้นแบบ…');
  const people = splitByFaces(alpha ? peopleBoxes(alpha, W, H) : [], faces);
  const spots: Spot[] = mergeDetections(people, found, texts.map((t) => grow(t, 1.2)));
  const g = pixels(bmp, 200);
  // A flat area holding a person or an object is the photo they are in, not a sticker: their own slot covers it.
  const graphics = findGraphics(g.rgba, g.W, g.H, [...spots, ...texts.map((t) => grow(t, 1.3))]).filter((x) => !spots.some((s) => inside(s, x) > 0.8));
  bmp.close();
  const persons = spots.filter((x) => x.kind === 'person').sort((a, b) => b.w * b.h - a.w * a.h);
  return { aspect, person: persons[0] ?? (alpha && personBox(alpha, W, H)), texts, spots: [...spots, ...graphics] };
}

const ASPECTS: [Aspect, number][] = [['9:16', 9 / 16], ['3:4', 3 / 4], ['4:5', 4 / 5], ['1:1', 1], ['4:3', 4 / 3], ['16:9', 16 / 9], ['2:1', 2]];
const nearest = (r: number) => ASPECTS.reduce((b, a) => (Math.abs(Math.log(r / a[1])) < Math.abs(Math.log(r / b[1])) ? a : b))[0];

// The reference kept with the project (for its colours later), an empty portrait slot for its main person (older
// layouts), and one empty slot per spot shaped like the spot, named after what it was ("ช่องรูป: แก้ว").
export async function layoutAssets(projectId: string, reference: File, layout: Layout): Promise<{ reference: MediaAsset; slot: MediaAsset | null; spotSlots: MediaAsset[] }> {
  const frame = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '4:5': 4 / 5, '2:1': 2 }[layout.aspect];
  const spotSlots: MediaAsset[] = [];
  for (const s of layout.spots ?? []) {
    const shape: Aspect = s.kind === 'person' ? '3:4' : nearest((s.w * frame) / Math.max(0.01, s.h));
    const name = s.kind === 'person' ? 'ช่องคน' : s.kind === 'graphic' ? 'ช่องสติกเกอร์' : `ช่องรูป: ${thaiLabel(s.label, s.score)}`;
    const file = new File([await placeholderFile(shape)], `${name}.png`, { type: 'image/png' });
    spotSlots.push({ ...(await importMedia(projectId, file)), placeholder: true });
  }
  return {
    reference: await importMedia(projectId, reference),
    slot: layout.person && !layout.spots?.length ? { ...(await importMedia(projectId, await placeholderFile('3:4'))), placeholder: true } : null,
    spotSlots,
  };
}
