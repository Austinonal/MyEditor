// Text templates: one tap sets the look, the place and the animations (ids come from anim.ts).
import type { TextStyle } from './schema.ts';

export interface TextTemplate {
  id: string;
  name: string;
  text: string;
  style: TextStyle;
  x?: number;
  y: number;
  scale?: number;
  animIn?: string;
  animOut?: string;
  animLoop?: string; // exclusive with animIn / animOut
  animMs?: number;
  seconds?: number;
}

const base: TextStyle = { fontId: 'kanit', size: 64, colour: '#ffffffff', align: 'center', stroke: null, shadow: null, background: null };

export const TEXT_TEMPLATES: TextTemplate[] = [
  { id: 'headline', name: 'หัวข้อใหญ่', text: 'หัวข้อใหญ่', style: { ...base, size: 132, stroke: { colour: '#000000ff', width: 12 }, shadow: { colour: '#00000099', blur: 0, dx: 6, dy: 6 } }, y: 0.3, animIn: 'in:t-pop', animOut: 'out:t-fade' },
  { id: 'lower-third', name: 'ชื่อคนพูด', text: 'ชื่อ นามสกุล', style: { ...base, size: 52, align: 'left', background: { colour: '#007affe6', radius: 10 } }, x: 0.32, y: 0.84, animIn: 'in:t-slide', animOut: 'out:t-fade' },
  { id: 'price', name: 'ป้ายราคา', text: '฿199', style: { ...base, size: 120, colour: '#111111ff', background: { colour: '#ffd84dff', radius: 28 } }, y: 0.5, animLoop: 'combo:t-beat' },
  { id: 'neon', name: 'นีออนวิบวับ', text: 'NEON', style: { ...base, size: 120, colour: '#ffe0f0ff', shadow: { colour: '#ff2d95ff', blur: 32, dx: 0, dy: 0 } }, y: 0.5, animLoop: 'combo:t-flicker' },
  { id: 'quote', name: 'คำคมพิมพ์ดีด', text: '“พิมพ์ข้อความของคุณที่นี่”', style: { ...base, fontId: 'sarabun', size: 60, shadow: { colour: '#000000cc', blur: 12, dx: 0, dy: 4 } }, y: 0.5, animIn: 'in:t-typewriter', animMs: 1500, seconds: 4 },
  { id: 'sale', name: 'ลดราคา', text: 'SALE 50%', style: { ...base, fontId: 'prompt', size: 110, colour: '#ffffffff', stroke: { colour: '#ff3b30ff', width: 14 } }, y: 0.25, animLoop: 'combo:t-jelly' },
  { id: 'big-number', name: 'เลขใหญ่', text: '3', style: { ...base, fontId: 'mitr', size: 240, stroke: { colour: '#000000ff', width: 14 } }, y: 0.5, animIn: 'in:t-zoom', animOut: 'out:t-fade', seconds: 1 },
  { id: 'caption-pop', name: 'ซับเด้ง', text: 'ซับเด้งทีละตัว', style: { ...base, size: 72, colour: '#ffd84dff', stroke: { colour: '#000000ff', width: 8 } }, y: 0.78, animIn: 'in:t-pop' },
  { id: 'label', name: 'ป้ายชมพู', text: 'มาใหม่', style: { ...base, size: 68, background: { colour: '#ff4f8bff', radius: 30 } }, y: 0.2, animIn: 'in:t-drop', animLoop: undefined },
  { id: 'glitch', name: 'กลิตช์', text: 'GLITCH', style: { ...base, fontId: 'noto', size: 120, colour: '#00e5ffff', shadow: { colour: '#ff2d95ff', blur: 0, dx: 8, dy: 0 } }, y: 0.5, animLoop: 'combo:t-glitch-loop' },
];
