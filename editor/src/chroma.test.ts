import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromaKey, DEFAULT_CHROMA } from './chroma.ts';
import { DEFAULT_MASK, maskAlpha } from './mask.ts';
import { denoise } from './denoise.ts';

const px = (...rgb: number[]) => new Uint8ClampedArray([...rgb, 255]);

test('chroma key: the screen goes transparent, other colours stay', () => {
  const green = px(0, 255, 0);
  const darkGreen = px(10, 140, 20); // a shadow on the screen
  const skin = px(220, 170, 140);
  const red = px(220, 20, 20);
  for (const p of [green, darkGreen, skin, red]) chromaKey(p, DEFAULT_CHROMA);
  assert.equal(green[3], 0);
  assert.equal(darkGreen[3], 0);
  assert.equal(skin[3], 255);
  assert.equal(red[3], 255);
});

test('chroma key: smoothness gives a soft edge, similarity widens the key', () => {
  const edge = px(60, 200, 60);
  chromaKey(edge, { colour: '#00ff00', similarity: 0.1, smoothness: 0.4 });
  assert.ok(edge[3] > 0 && edge[3] < 255, `edge alpha ${edge[3]}`);
  const wide = px(120, 200, 120);
  const narrow = px(120, 200, 120);
  chromaKey(wide, { colour: '#00ff00', similarity: 0.9, smoothness: 0.05 });
  chromaKey(narrow, { colour: '#00ff00', similarity: 0.05, smoothness: 0.05 });
  assert.ok(wide[3] < narrow[3]);
});

test('chroma key: a blue screen works with its own key colour', () => {
  const blue = px(10, 30, 240);
  chromaKey(blue, { colour: '#0047ff', similarity: 0.4, smoothness: 0.1 });
  assert.equal(blue[3], 0);
});

const at = (a: Uint8ClampedArray, w: number, x: number, y: number) => a[y * w + x];

test('mask: a circle shows its centre and hides the corners; invert flips it', () => {
  const m = maskAlpha(100, 100, { ...DEFAULT_MASK, feather: 0 });
  assert.equal(at(m, 100, 50, 50), 255);
  assert.equal(at(m, 100, 1, 1), 0);
  const inv = maskAlpha(100, 100, { ...DEFAULT_MASK, feather: 0, invert: true });
  assert.equal(at(inv, 100, 50, 50), 0);
  assert.equal(at(inv, 100, 1, 1), 255);
});

test('mask: feather makes a soft ramp at the edge, and the centre can move', () => {
  const hard = maskAlpha(100, 100, { ...DEFAULT_MASK, feather: 0 });
  const soft = maskAlpha(100, 100, { ...DEFAULT_MASK, feather: 0.8 });
  const count = (a: Uint8ClampedArray) => a.filter((v) => v > 10 && v < 245).length;
  assert.ok(count(soft) > count(hard) * 5);
  const moved = maskAlpha(100, 100, { ...DEFAULT_MASK, feather: 0, x: 0.2 });
  assert.equal(at(moved, 100, 20, 50), 255);
  assert.equal(at(moved, 100, 80, 50), 0);
});

test('mask: every shape shows its centre and not a far corner', () => {
  for (const shape of ['circle', 'rect', 'heart', 'star'] as const) {
    const m = maskAlpha(120, 120, { ...DEFAULT_MASK, shape, size: 0.8, feather: 0 });
    assert.equal(at(m, 120, 60, 62), 255, shape);
    assert.equal(at(m, 120, 0, 0), 0, shape);
  }
  const line = maskAlpha(100, 100, { ...DEFAULT_MASK, shape: 'line', feather: 0 });
  assert.equal(at(line, 100, 10, 50), 255);
  assert.equal(at(line, 100, 90, 50), 0);
});

test('denoise: steady noise drops a lot, the tone stays', () => {
  const rate = 16000;
  const n = rate * 3;
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const clean = new Float32Array(n);
  const noisy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const burst = t > 0.7 && t < 2.4 ? 0.5 * Math.sin(2 * Math.PI * 300 * t) * Math.sin(Math.PI * ((t - 0.7) / 1.7)) : 0; // a tone that comes and goes, like speech
    clean[i] = burst;
    noisy[i] = burst + 0.08 * rnd();
  }
  const out = denoise(noisy, 0.8);
  const rms = (a: Float32Array, b: Float32Array, from: number, to: number) => {
    let s = 0;
    for (let i = from; i < to; i++) s += (a[i] - b[i]) ** 2;
    return Math.sqrt(s / (to - from));
  };
  const zero = new Float32Array(n);
  const before = rms(noisy, clean, 2000, n - 2000);
  const after = rms(out, clean, 2000, n - 2000);
  assert.ok(after < before * 0.6, `error ${before.toFixed(4)} -> ${after.toFixed(4)}`);
  const toneKept = rms(out, zero, rate, 2 * rate) / rms(clean, zero, rate, 2 * rate);
  assert.ok(toneKept > 0.8 && toneKept < 1.15, `tone level kept ${toneKept.toFixed(2)}`);
  assert.equal(out.length, noisy.length);
  assert.deepEqual(denoise(noisy, 0), noisy);
});

import { TEXT_TEMPLATES } from './textTemplates.ts';
import { getPreset } from './anim.ts';
import { SEC, addTextFromTemplate, applyTextTemplate, assertValid, newProject, setCanvas, setChroma, setDenoise, setKeepPitch, setMask, pitchFix, updateText, addText, findClip } from './timeline.ts';
import type { MediaAsset, MediaClip, TextClip } from './schema.ts';

const video: MediaAsset = { id: 'a1', kind: 'video', name: 'c.mp4', file: 'media/p1/a1', bytes: 1, duration: 10 * SEC, width: 1080, height: 1920, rotation: 0, hasAudio: true };
const photo: MediaAsset = { ...video, id: 'bg', kind: 'photo', name: 'bg.jpg', file: 'media/p1/bg', duration: 0 };
const proj = () => newProject('p1', 't', video, '2026-01-01T00:00:00Z');

test('text templates: ids are unique and every animation exists', () => {
  assert.equal(new Set(TEXT_TEMPLATES.map((t) => t.id)).size, TEXT_TEMPLATES.length);
  for (const t of TEXT_TEMPLATES) {
    for (const a of [t.animIn, t.animOut, t.animLoop]) if (a) assert.ok(getPreset(a), `${t.id}: ${a}`);
    assert.ok(!(t.animLoop && (t.animIn || t.animOut)), `${t.id} mixes a loop with in/out`);
  }
});

test('text templates: adding one gives a valid project with the look, place and animation', () => {
  for (const t of TEXT_TEMPLATES) {
    const p = proj();
    const id = addTextFromTemplate(p, 0, t);
    assertValid(p);
    const c = findClip(p, id) as TextClip;
    assert.equal(c.text, t.text);
    assert.equal(c.style.fontId, t.style.fontId);
    assert.equal(c.transform.y, t.y);
    assert.equal(!!(c.animIn || c.animOut || c.animLoop), !!(t.animIn || t.animOut || t.animLoop));
  }
});

test('text templates: applying to existing text keeps what was typed', () => {
  const p = proj();
  const id = addText(p, 0, 'สวัสดี');
  applyTextTemplate(p, id, TEXT_TEMPLATES[0]);
  assert.equal((findClip(p, id) as TextClip).text, 'สวัสดี');
  updateText(p, id, { text: '' });
  applyTextTemplate(p, id, TEXT_TEMPLATES[0]);
  assert.equal((findClip(p, id) as TextClip).text, TEXT_TEMPLATES[0].text);
});

test('setters clamp and validate: chroma, mask, noise, pitch', () => {
  const p = proj();
  const c = p.tracks[0].clips[0] as MediaClip;
  setChroma(p, c.id, { colour: 'nope', similarity: 5, smoothness: -1 });
  assert.deepEqual(c.chroma, { colour: '#00ff00', similarity: 1, smoothness: 0 });
  setMask(p, c.id, { shape: 'heart', size: 9, x: -2, y: 0.5, feather: 2, invert: true });
  assert.deepEqual(c.mask, { shape: 'heart', size: 1.5, x: 0, y: 0.5, feather: 1, invert: true });
  assert.throws(() => setMask(p, c.id, { ...c.mask!, shape: 'blob' as never }));
  setDenoise(p, c.id, 3);
  assert.equal(c.denoise, 1);
  setKeepPitch(p, c.id, true);
  assertValid(p);
  setChroma(p, c.id, null);
  setMask(p, c.id, null);
  assert.equal(c.chroma, null);
  assert.equal(c.mask, null);
});

test('canvas picture: needs a photo, is checked by assertValid', () => {
  const p = proj();
  assert.throws(() => setCanvas(p, { kind: 'image', image: 'a1' }, video));
  setCanvas(p, { kind: 'image', image: 'bg' }, photo);
  assert.deepEqual(p.canvas, { kind: 'image', image: 'bg' });
  assertValid(p);
  setCanvas(p, { kind: 'blur', level: 2 });
  assert.equal(p.canvas.kind, 'blur');
});

test('pitch fix: only for kept pitch at a constant speed between 0.5x and 2x', () => {
  assert.equal(pitchFix({ speed: 2, keepPitch: true }), 0.5);
  assert.equal(pitchFix({ speed: 0.5, keepPitch: true }), 2);
  assert.equal(pitchFix({ speed: 2 }), null);
  assert.equal(pitchFix({ speed: 1, keepPitch: true }), null);
  assert.equal(pitchFix({ speed: 4, keepPitch: true }), null);
  assert.equal(pitchFix({ speed: 2, keepPitch: true, curve: [[0, 1]] }), null);
});

import { removeFillers, stripFillers } from './captions.ts';

test('fillers: Thai and English fillers go, words that contain the letters stay', () => {
  assert.equal(stripFillers('เอ่อ วันนี้ อืม ไปอ่านหนังสือ'), 'วันนี้ ไปอ่านหนังสือ');
  assert.equal(stripFillers('So um, I think uh it works'), 'So , I think it works'.replace(' ,', ','));
  assert.equal(stripFillers('umbrella is here'), 'umbrella is here');
  assert.deepEqual(
    removeFillers([{ start: 0, duration: 1, text: 'เอ่อ อืม' }, { start: 1, duration: 1, text: 'ครับ เอ่อ ผม' }]),
    [{ start: 1, duration: 1, text: 'ครับ ผม' }],
  );
});
