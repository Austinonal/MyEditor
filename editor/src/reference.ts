import { CanvasSink, type InputVideoTrack } from 'mediabunny';
import { AW, buildTemplate, estimateMotion, features, type Frame, type Motion, type Slot } from './analyze.ts';
import { ImportError, openInput } from './media';
import { classifyTransition, type Pic } from './transitionRead.ts';
import { readTextIn } from './thumbnail';
import type { TextSpot } from './layout.ts';

const MAX_SECONDS = 180; // templates are short; this keeps analysis quick on a phone

// Decodes the reference edit at a tiny size and reads its cuts and animations. Nothing leaves the device.
export async function analyzeReference(file: File, onProgress: (fraction: number) => void, signal: AbortSignal): Promise<Slot[]> {
  const input = openInput(file);
  try {
    if (!(await input.canRead())) throw new ImportError('unsupported-format');
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new ImportError('no-video');
    if (!(await track.canDecode())) throw new ImportError('unsupported-codec');
    const end = Math.min(MAX_SECONDS, await input.computeDuration());
    const w = AW;
    const h = Math.max(8, Math.round((AW * (await track.getDisplayHeight())) / (await track.getDisplayWidth())));
    const sink = new CanvasSink(track, { width: w, height: h, fit: 'fill', poolSize: 1 });
    const frames: Frame[] = [];
    for await (const { canvas, timestamp } of sink.canvases(0, end)) {
      signal.throwIfAborted();
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
      frames.push(features(ctx.getImageData(0, 0, w, h).data, w, h, timestamp));
      onProgress(0.6 * Math.min(1, timestamp / end));
    }
    const motions: Motion[] = [];
    for (let i = 1; i < frames.length; i++) {
      motions.push(estimateMotion(frames[i - 1], frames[i]));
      if (i % 30 === 0) {
        signal.throwIfAborted();
        onProgress(0.6 + (0.15 * i) / frames.length);
        await new Promise((r) => setTimeout(r));
      }
    }
    const slots = buildTemplate(frames, motions, end);
    await readJoins(track, slots, end, signal);
    onProgress(0.85);
    await readTexts(track, slots, end, signal, (k) => onProgress(0.85 + 0.15 * k));
    return slots;
  } finally {
    input.dispose();
  }
}

const lumaOf = (canvas: HTMLCanvasElement | OffscreenCanvas): Float32Array => {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  return Float32Array.from({ length: d.length / 4 }, (_, i) => (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255);
};

// Every join between slots is looked at closely (small pictures, every frame around it) and named: a dissolve, a fade
// through black or white, a flash, a wipe, a circle, a slide, or a plain cut. A named transition replaces the In / Out
// guesses next to it, which were the transition's own frames read as effects.
async function readJoins(track: InputVideoTrack, slots: Slot[], end: number, signal: AbortSignal) {
  const w = 48;
  const h = Math.max(8, Math.round((w * (await track.getDisplayHeight())) / (await track.getDisplayWidth())));
  const sink = new CanvasSink(track, { width: w, height: h, fit: 'fill', poolSize: 1 });
  for (let i = 1; i < slots.length; i++) {
    signal.throwIfAborted();
    const s = slots[i];
    const lo = Math.max(slots[i - 1].start + slots[i - 1].seconds * 0.25, (s.change?.from ?? s.start) - 0.35);
    const hi = Math.min(s.start + s.seconds * 0.75, (s.change?.to ?? s.start) + 0.35, end);
    const pics: Pic[] = [];
    for await (const { canvas, timestamp } of sink.canvases(lo, hi)) pics.push({ t: timestamp, w, h, luma: lumaOf(canvas) });
    const r = classifyTransition(pics);
    if (!r.presetId) continue;
    // The join goes in the middle of the transition, so both slots keep their share of it.
    const mid = (r.from + r.to) / 2;
    const prev = slots[i - 1];
    if (Math.abs(mid - s.start) > 0.04 && mid > prev.start + 0.1 && mid < s.start + s.seconds - 0.1) {
      const stop = s.start + s.seconds;
      prev.seconds = mid - prev.start;
      s.start = mid;
      s.seconds = stop - mid;
    }
    s.transition = { presetId: r.presetId, seconds: Math.max(0.1, Math.min(1.5, r.to - r.from + 1 / 30)) };
    s.in = null;
    slots[i - 1].out = null;
    if (r.presetId === 'dissolve') s.dissolve = s.transition.seconds;
  }
}

// Words on screen: two looks per slot (a third and two thirds in), read like a thumbnail's text. The same words in
// slots next to each other stay one caption (applyTemplate joins them).
async function readTexts(track: InputVideoTrack, slots: Slot[], end: number, signal: AbortSignal, onProgress: (k: number) => void) {
  const w = 480;
  const h = Math.max(8, Math.round((w * (await track.getDisplayHeight())) / (await track.getDisplayWidth())));
  const sink = new CanvasSink(track, { width: w, height: h, fit: 'fill', poolSize: 1 });
  const key = (t: TextSpot) => (t.text ?? '').replace(/\s+/g, '');
  try {
    for (let i = 0; i < slots.length; i++) {
      signal.throwIfAborted();
      const s = slots[i];
      const seen = new Map<string, TextSpot>();
      for (const k of [0.35, 0.65]) {
        const c = await sink.getCanvas(Math.min(end - 0.01, s.start + s.seconds * k));
        if (!c) continue;
        const bmp = await createImageBitmap(c.canvas);
        try {
          for (const t of await readTextIn(bmp)) if (key(t) && !seen.has(key(t))) seen.set(key(t), t);
        } finally {
          bmp.close();
        }
      }
      if (seen.size) s.texts = [...seen.values()];
      onProgress((i + 1) / slots.length);
    }
  } catch (e) {
    if (signal.aborted) throw e;
    console.warn('reading words on screen failed; the template keeps its cuts and effects:', e);
  }
}
