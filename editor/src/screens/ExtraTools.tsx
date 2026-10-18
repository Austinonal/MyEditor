import { useEffect, useRef, useState } from 'react';
import { BottomSheet, Button, Slider, Swatches, Switch } from '../ui';
import { floodFill } from '../paint.ts';
import { edit } from '../store';
import { setChroma, setMask } from '../timeline.ts';
import { DEFAULT_CHROMA, KEY_COLOURS } from '../chroma.ts';
import { DEFAULT_MASK, MASK_SHAPES } from '../mask.ts';
import type { MediaClip } from '../schema';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

// ---- chroma key (green screen) ----

export function ChromaSheet({ open, onClose, clip }: { open: boolean; onClose: () => void; clip: MediaClip }) {
  const c = clip.chroma;
  const set = (patch: Partial<typeof DEFAULT_CHROMA>, key: string) => edit((d) => setChroma(d, clip.id, { ...(clip.chroma ?? DEFAULT_CHROMA), ...patch }), `chroma-${key}-${clip.id}`);
  return (
    <BottomSheet open={open} title="ชโครมาคีย์ (ลบฉากสีเดียว)" onClose={onClose} modal={false}>
      <div className="flex flex-col gap-3">
        <Switch label="เปิดชโครมาคีย์" hint="สีที่เลือกจะโปร่งใส เห็นภาพข้างหลังแทน เหมาะกับฉากกรีนสกรีน" on={!!c} onChange={(on) => edit((d) => setChroma(d, clip.id, on ? DEFAULT_CHROMA : null))} />
        {c && (
          <>
            <Swatches label="สีที่จะลบ" colours={KEY_COLOURS} value={c.colour} onChange={(v) => set({ colour: v }, 'colour')} />
            <Slider label="ลบสีใกล้เคียง" value={Math.round(c.similarity * 100)} min={0} max={100} step={1} format={(v) => `${v}%`} onChange={(v) => set({ similarity: v / 100 }, 'sim')} />
            <Slider label="ขอบนุ่ม" value={Math.round(c.smoothness * 100)} min={0} max={50} step={1} format={(v) => `${v}%`} onChange={(v) => set({ smoothness: v / 100 }, 'smooth')} />
            <p className="text-xs text-muted">ให้คลิปนี้เป็นภาพซ้อน (ภาพซ้อน) วางทับวิดีโอหลัก จะเห็นวิดีโอหลักทะลุตรงที่สีถูกลบ · ถ้ายังเหลือขอบสี เพิ่ม “ลบสีใกล้เคียง”</p>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

// ---- mask: show the clip only inside or outside a shape ----

export function MaskSheet({ open, onClose, clip }: { open: boolean; onClose: () => void; clip: MediaClip }) {
  const m = clip.mask;
  const set = (patch: Partial<typeof DEFAULT_MASK>, key: string) => edit((d) => setMask(d, clip.id, { ...(clip.mask ?? DEFAULT_MASK), ...patch }), `mask-${key}-${clip.id}`);
  return (
    <BottomSheet open={open} title="มาสก์" onClose={onClose} modal={false}>
      <div className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="รูปทรงมาสก์" className="grid grid-cols-4 gap-2">
          <button role="radio" aria-checked={!m} onClick={() => edit((d) => setMask(d, clip.id, null))} className={`h-11 rounded-md text-sm ${!m ? 'bg-accent text-on-accent' : 'bg-raised'} ${focus}`}>
            ไม่มี
          </button>
          {MASK_SHAPES.map(([id, name]) => (
            <button key={id} role="radio" aria-checked={m?.shape === id} onClick={() => set({ shape: id }, 'shape')} className={`h-11 rounded-md text-sm ${m?.shape === id ? 'bg-accent text-on-accent' : 'bg-raised'} ${focus}`}>
              {name}
            </button>
          ))}
        </div>
        {m && (
          <>
            <Slider label="ขนาด" value={Math.round(m.size * 100)} min={10} max={150} step={1} format={(v) => `${v}%`} onChange={(v) => set({ size: v / 100 }, 'size')} />
            <Slider label="ความนุ่มของขอบ" value={Math.round(m.feather * 100)} min={0} max={100} step={1} format={(v) => `${v}%`} onChange={(v) => set({ feather: v / 100 }, 'feather')} />
            <Slider label="ตำแหน่งซ้าย-ขวา" value={Math.round(m.x * 100)} min={0} max={100} step={1} format={(v) => `${v}%`} onChange={(v) => set({ x: v / 100 }, 'x')} />
            <Slider label="ตำแหน่งบน-ล่าง" value={Math.round(m.y * 100)} min={0} max={100} step={1} format={(v) => `${v}%`} onChange={(v) => set({ y: v / 100 }, 'y')} />
            <Switch label="กลับด้าน" hint="โชว์ด้านนอกรูปทรง ซ่อนด้านใน" on={m.invert} onChange={(on) => set({ invert: on }, 'invert')} />
            <Button variant="ghost" size="md" onClick={() => edit((d) => setMask(d, clip.id, null))}>
              เอามาสก์ออก
            </Button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

// ---- drawing page: paint a sticker on a transparent canvas, saved as a PNG overlay ----

const INKS = ['#ffffff', '#000000', '#ff3b30', '#ffcc00', '#34c759', '#007aff', '#af52de', '#ff2d92'];
const PAD = 512;
type Tool = 'brush' | 'eraser' | 'fill';

export function DrawSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (file: File) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const history = useRef<ImageData[]>([]);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<Tool>('brush');
  const [ink, setInk] = useState(INKS[2]);
  const [size, setSize] = useState(12);
  const [steps, setSteps] = useState(0);
  const ctx = () => canvas.current!.getContext('2d', { willReadFrequently: true })!;

  useEffect(() => {
    if (!open) return;
    history.current = [];
    setSteps(0);
    canvas.current?.getContext('2d')?.clearRect(0, 0, PAD, PAD);
  }, [open]);

  function snapshot() {
    history.current.push(ctx().getImageData(0, 0, PAD, PAD));
    if (history.current.length > 20) history.current.shift();
    setSteps(history.current.length);
  }
  function undo() {
    const prev = history.current.pop();
    if (prev) ctx().putImageData(prev, 0, 0);
    setSteps(history.current.length);
  }
  function point(e: React.PointerEvent) {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * PAD, y: ((e.clientY - r.top) / r.height) * PAD };
  }
  function stroke(to: { x: number; y: number }) {
    const c = ctx();
    const from = last.current ?? to;
    c.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    c.strokeStyle = ink;
    c.lineWidth = size;
    c.lineCap = c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.lineTo(to.x, to.y);
    c.stroke();
    last.current = to;
  }
  function down(e: React.PointerEvent) {
    snapshot();
    const at = point(e);
    if (tool === 'fill') {
      const img = ctx().getImageData(0, 0, PAD, PAD);
      const hex = parseInt(ink.slice(1), 16);
      floodFill(img.data, PAD, PAD, at.x, at.y, [hex >> 16, (hex >> 8) & 255, hex & 255, 255]);
      ctx().putImageData(img, 0, 0);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = null;
    stroke(at);
  }
  function save() {
    canvas.current!.toBlob((blob) => blob && onSave(new File([blob], 'ภาพวาด.png', { type: 'image/png' })), 'image/png');
  }

  const tools: [Tool, string][] = [['brush', 'แปรง'], ['eraser', 'ยางลบ'], ['fill', 'ถังสี']];
  return (
    <BottomSheet open={open} title="วาดสติกเกอร์" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <canvas
          ref={canvas}
          width={PAD}
          height={PAD}
          aria-label="พื้นที่วาด"
          onPointerDown={down}
          onPointerMove={(e) => last.current && tool !== 'fill' && stroke(point(e))}
          onPointerUp={() => (last.current = null)}
          onPointerCancel={() => (last.current = null)}
          className="mx-auto aspect-square w-full max-w-[min(100%,40vh)] touch-none rounded-md border border-border"
          style={{ background: 'repeating-conic-gradient(#8884 0 25%, transparent 0 50%) 0 0 / 24px 24px' }}
        />
        <div role="radiogroup" aria-label="เครื่องมือวาด" className="grid grid-cols-3 gap-2">
          {tools.map(([id, name]) => (
            <button key={id} role="radio" aria-checked={tool === id} onClick={() => setTool(id)} className={`h-11 rounded-md text-sm ${tool === id ? 'bg-accent text-on-accent' : 'bg-raised'} ${focus}`}>
              {name}
            </button>
          ))}
        </div>
        <Swatches label="สีแปรง" colours={INKS} value={ink} onChange={setInk} />
        <Slider label="ขนาดแปรง" value={size} min={2} max={60} step={1} format={(v) => `${v}`} onChange={setSize} />
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" size="md" disabled={!steps} onClick={undo}>
            ย้อนกลับ
          </Button>
          <Button variant="ghost" size="md" onClick={() => (snapshot(), ctx().clearRect(0, 0, PAD, PAD))}>
            ล้าง
          </Button>
          <Button size="md" onClick={save}>
            ใช้ภาพนี้
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
