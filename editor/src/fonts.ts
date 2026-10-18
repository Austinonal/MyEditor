import { createStore, del, entries, set as put } from 'idb-keyval';
import { googleFaces } from './googleFonts.ts';
import kanitThai from '@fontsource/kanit/files/kanit-thai-600-normal.woff2?url';
import kanitLatin from '@fontsource/kanit/files/kanit-latin-600-normal.woff2?url';
import promptThai from '@fontsource/prompt/files/prompt-thai-600-normal.woff2?url';
import promptLatin from '@fontsource/prompt/files/prompt-latin-600-normal.woff2?url';
import sarabunThai from '@fontsource/sarabun/files/sarabun-thai-600-normal.woff2?url';
import sarabunLatin from '@fontsource/sarabun/files/sarabun-latin-600-normal.woff2?url';
import mitrThai from '@fontsource/mitr/files/mitr-thai-400-normal.woff2?url';
import mitrLatin from '@fontsource/mitr/files/mitr-latin-400-normal.woff2?url';
import notoThai from '@fontsource/noto-sans-thai/files/noto-sans-thai-thai-700-normal.woff2?url';
import notoLatin from '@fontsource/noto-sans-thai/files/noto-sans-thai-latin-700-normal.woff2?url';
import itimThai from '@fontsource/itim/files/itim-thai-400-normal.woff2?url';
import itimLatin from '@fontsource/itim/files/itim-latin-400-normal.woff2?url';
import srirachaThai from '@fontsource/sriracha/files/sriracha-thai-400-normal.woff2?url';
import srirachaLatin from '@fontsource/sriracha/files/sriracha-latin-400-normal.woff2?url';

// All fonts are SIL Open Font License, bundled with the app so text looks the same offline and in the export.
export const FONTS = [
  { id: 'kanit', name: 'Kanit', weight: '600', thai: kanitThai, latin: kanitLatin },
  { id: 'prompt', name: 'Prompt', weight: '600', thai: promptThai, latin: promptLatin },
  { id: 'sarabun', name: 'Sarabun', weight: '600', thai: sarabunThai, latin: sarabunLatin },
  { id: 'mitr', name: 'Mitr', weight: '400', thai: mitrThai, latin: mitrLatin },
  { id: 'noto', name: 'Noto Sans Thai', weight: '700', thai: notoThai, latin: notoLatin },
  { id: 'itim', name: 'Itim', weight: '400', thai: itimThai, latin: itimLatin },
  { id: 'sriracha', name: 'Sriracha', weight: '400', thai: srirachaThai, latin: srirachaLatin },
] as const;

const THAI = 'U+0E01-0E5B, U+200C-200D, U+25CC';
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2212, U+FEFF, U+FFFD';

export const isCustomFont = (id: string) => id.startsWith('custom-');
export const family = (id: string) => `ed-${isCustomFont(id) || FONTS.some((f) => f.id === id) ? id : 'kanit'}`;
// A font file the user brought is drawn at its own weight; one that is missing falls back to sans-serif.
export const fontCss = (id: string, px: number) => `${isCustomFont(id) ? '400' : (FONTS.find((f) => f.id === id)?.weight ?? '600')} ${px}px ${family(id)}, sans-serif`;

// ---- fonts the user imports (.ttf .otf .woff .woff2), kept on this device in IndexedDB ----

export interface CustomFont { id: string; name: string }
interface Stored extends CustomFont {
  data: ArrayBuffer;
  range?: string; // Google Fonts come split by script: the first file's unicode-range, the others in `more`
  more?: { data: ArrayBuffer; range?: string }[];
}
const facesOf = (f: Stored) => [{ data: f.data, range: f.range }, ...(f.more ?? [])].map((x) => new FontFace(family(f.id), x.data, x.range ? { unicodeRange: x.range } : {}));
const store = () => createStore('editor-fonts', 'fonts');
export const MAX_FONT_BYTES = 12 * 1024 * 1024;
export const isFontFile = (name: string) => /\.(ttf|otf|woff2?)$/i.test(name);
const fontSet = () => (globalThis as unknown as { document?: Document }).document?.fonts ?? (globalThis as unknown as { fonts: FontFaceSet }).fonts;

export async function listCustomFonts(): Promise<CustomFont[]> {
  return (await entries<string, Stored>(store())).map(([, f]) => ({ id: f.id, name: f.name }));
}

export async function importFont(file: File): Promise<CustomFont> {
  if (!isFontFile(file.name)) throw new Error('ใช้ไฟล์ฟอนต์ .ttf .otf .woff หรือ .woff2');
  if (file.size > MAX_FONT_BYTES) throw new Error('ไฟล์ฟอนต์ใหญ่เกิน 12 MB');
  const data = await file.arrayBuffer();
  const id = `custom-${crypto.randomUUID().slice(0, 8)}`;
  let face: FontFace;
  try {
    face = await new FontFace(family(id), data).load(); // the browser rejects a file that is not a font
  } catch {
    throw new Error('เปิดไฟล์นี้เป็นฟอนต์ไม่ได้');
  }
  fontSet().add(face);
  const font = { id, name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) };
  await put(id, { ...font, data }, store());
  return font;
}

export const removeCustomFont = (id: string) => del(id, store());

// ---- Google Fonts (list and css parsing in googleFonts.ts) ----

export async function importGoogleFont(name: string): Promise<CustomFont> {
  name = name.trim().replace(/\s+/g, ' ');
  if (!/^[A-Za-z0-9 ]{2,60}$/.test(name)) throw new Error('ชื่อฟอนต์ใช้ได้แค่ตัวอักษรอังกฤษ ตัวเลข และเว้นวรรค');
  // An unknown name (or weight) answers 400 without CORS headers, which fetch reports like a network failure.
  const css = (q: string) =>
    fetch(`https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}${q}&display=swap`).then(
      (r) => (r.ok ? r.text() : null),
      () => null,
    );
  const text = (await css(':wght@700')) ?? (await css('')); // the bold cut when there is one: text in videos is mostly titles
  if (!text && !navigator.onLine) throw new Error('ไม่ได้ต่ออินเทอร์เน็ต ต่อแล้วลองใหม่');
  const found = text ? googleFaces(text) : [];
  if (!found.length) throw new Error(`ไม่พบฟอนต์ “${name}” ใน Google Fonts (ตรวจตัวสะกด หรือเน็ตอาจหลุด)`);
  const id = `custom-${crypto.randomUUID().slice(0, 8)}`;
  const parts = await Promise.all(
    found.map(async (f) => {
      const data = await (await fetch(f.url)).arrayBuffer();
      if (data.byteLength > MAX_FONT_BYTES) throw new Error('ไฟล์ฟอนต์ใหญ่เกิน 12 MB');
      return { data, range: f.range };
    }),
  );
  const stored: Stored = { id, name, ...parts[0], more: parts.slice(1) };
  const faces = facesOf(stored);
  try {
    await Promise.all(faces.map((f) => f.load()));
  } catch {
    throw new Error('เปิดไฟล์ฟอนต์ที่ดาวน์โหลดมาไม่ได้');
  }
  faces.forEach((f) => fontSet().add(f));
  await put(id, stored, store());
  return { id, name };
}

let loading: Promise<void> | null = null;

export function loadFonts(): Promise<void> {
  loading ??= (async () => {
    const set = (globalThis as unknown as { document?: Document }).document?.fonts ?? (globalThis as unknown as { fonts: FontFaceSet }).fonts;
    const faces = FONTS.flatMap((f) => [
      new FontFace(family(f.id), `url(${f.thai})`, { weight: f.weight, unicodeRange: THAI }),
      new FontFace(family(f.id), `url(${f.latin})`, { weight: f.weight, unicodeRange: LATIN }),
    ]);
    await Promise.all(faces.map(async (face) => set.add(await face.load())));
    for (const [, f] of await entries<string, Stored>(store()).catch(() => [] as [string, Stored][])) {
      try {
        for (const face of facesOf(f)) set.add(await face.load());
      } catch {
        // a stored file that no longer opens: text using it falls back to sans-serif
      }
    }
  })();
  return loading;
}
