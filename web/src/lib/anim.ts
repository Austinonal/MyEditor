// CapCut-style animations: In, Out, Combo (loops for the whole clip) plus transitions and filters.
// Pure: given a clip config and the time inside the clip, return how to draw it.
export interface Xf { a: number; s: number; tx: number; ty: number; rot: number } // tx/ty are fractions of the canvas
export interface AnimCfg { in?: string; out?: string; combo?: string; inMs?: number; outMs?: number }

export const IN = [['none', 'ไม่มี'], ['fade', 'เฟดเข้า'], ['zoomIn', 'ซูมเข้า'], ['zoomOut', 'ซูมออกเข้า'], ['slideLeft', 'สไลด์จากขวา'], ['slideRight', 'สไลด์จากซ้าย'], ['slideUp', 'สไลด์ขึ้น'], ['pop', 'เด้ง'], ['spin', 'หมุนเข้า']] as const
export const OUT = [['none', 'ไม่มี'], ['fade', 'เฟดออก'], ['zoomOut', 'ซูมออก'], ['zoomIn', 'ซูมพุ่ง'], ['slideLeft', 'สไลด์ไปซ้าย'], ['slideRight', 'สไลด์ไปขวา'], ['slideDown', 'สไลด์ลง'], ['shrink', 'หดหาย'], ['spin', 'หมุนออก']] as const
export const COMBO = [['none', 'ไม่มี'], ['pulse', 'ชีพจร'], ['shake', 'สั่น'], ['sway', 'โยก'], ['kenburns', 'ซูมช้า'], ['heartbeat', 'หัวใจเต้น']] as const
export const TRANS = [['none', 'ตัดตรง'], ['fade', 'เฟด'], ['fadeBlack', 'เฟดดำ'], ['flash', 'แฟลชขาว'], ['slideLeft', 'สไลด์ซ้าย'], ['slideUp', 'สไลด์ขึ้น'], ['zoom', 'ซูมทะลุ'], ['wipe', 'รูดเปิด']] as const
export const FILTERS = [['none', 'ปกติ', ''], ['vivid', 'สดใส', 'saturate(1.5) contrast(1.1)'], ['warm', 'อุ่น', 'sepia(0.35) saturate(1.2) hue-rotate(-10deg)'], ['cool', 'เย็น', 'hue-rotate(15deg) saturate(1.1) brightness(1.05)'],
  ['bw', 'ขาวดำ', 'grayscale(1) contrast(1.1)'], ['vintage', 'ฟิล์มเก่า', 'sepia(0.6) contrast(0.9) brightness(1.05)'], ['fade', 'ซีด', 'contrast(0.8) brightness(1.1) saturate(0.8)'], ['dark', 'มืด', 'brightness(0.75) contrast(1.15)'], ['blur', 'เบลอ', 'blur(3px)']] as const

export const DEFAULT_MS = 500
const clamp = (v: number, a = 0, b = 1) => Math.min(Math.max(v, a), b)
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)
const easeIn = (p: number) => p * p * p
const backOut = (p: number) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2) }
const ID: Xf = { a: 1, s: 1, tx: 0, ty: 0, rot: 0 }
const mul = (a: Xf, b: Xf): Xf => ({ a: a.a * b.a, s: a.s * b.s, tx: a.tx + b.tx, ty: a.ty + b.ty, rot: a.rot + b.rot })

/** p goes 0 -> 1 across the animation; returns the pose at that point. */
function poseIn(id: string, p: number): Xf {
  const e = easeOut(p)
  switch (id) {
    case 'fade': return { ...ID, a: e }
    case 'zoomIn': return { ...ID, a: e, s: 1.4 - 0.4 * e }
    case 'zoomOut': return { ...ID, a: e, s: 0.6 + 0.4 * e }
    case 'slideLeft': return { ...ID, tx: 1 - e }
    case 'slideRight': return { ...ID, tx: -(1 - e) }
    case 'slideUp': return { ...ID, ty: 1 - e }
    case 'pop': return { ...ID, a: clamp(p * 4), s: Math.max(backOut(p), 0.001) }
    case 'spin': return { ...ID, a: e, s: 0.5 + 0.5 * e, rot: (-Math.PI / 2) * (1 - e) }
    default: return ID
  }
}
function poseOut(id: string, p: number): Xf {
  const e = easeIn(p)
  switch (id) {
    case 'fade': return { ...ID, a: 1 - e }
    case 'zoomOut': return { ...ID, a: 1 - e, s: 1 - 0.4 * e }
    case 'zoomIn': return { ...ID, a: 1 - e, s: 1 + 0.4 * e }
    case 'slideLeft': return { ...ID, tx: -e }
    case 'slideRight': return { ...ID, tx: e }
    case 'slideDown': return { ...ID, ty: e }
    case 'shrink': return { ...ID, s: Math.max(1 - e, 0.001), a: 1 - e * 0.5 }
    case 'spin': return { ...ID, a: 1 - e, s: 1 - 0.5 * e, rot: (Math.PI / 2) * e }
    default: return ID
  }
}
function poseCombo(id: string, tMs: number, durMs: number): Xf {
  const t = tMs / 1000
  switch (id) {
    case 'pulse': return { ...ID, s: 1 + 0.05 * Math.sin(t * Math.PI * 4) }
    case 'shake': return { ...ID, s: 1.06, tx: 0.012 * Math.sin(t * 50), ty: 0.008 * Math.sin(t * 43), rot: 0.012 * Math.sin(t * 37) }
    case 'sway': return { ...ID, s: 1.08, rot: 0.05 * Math.sin(t * Math.PI * 2) }
    case 'kenburns': return { ...ID, s: 1 + 0.15 * clamp(tMs / Math.max(durMs, 1)) }
    case 'heartbeat': { const k = (t * 1.6) % 1; return { ...ID, s: 1 + 0.08 * (k < 0.15 ? Math.sin((k / 0.15) * Math.PI) : k > 0.25 && k < 0.4 ? 0.6 * Math.sin(((k - 0.25) / 0.15) * Math.PI) : 0) } }
    default: return ID
  }
}

export function animTransform(c: AnimCfg | undefined, tMs: number, durMs: number): Xf {
  if (!c) return ID
  let x = ID
  const inMs = Math.min(c.inMs ?? DEFAULT_MS, durMs / 2), outMs = Math.min(c.outMs ?? DEFAULT_MS, durMs / 2)
  if (c.in && c.in !== 'none' && tMs < inMs) x = mul(x, poseIn(c.in, clamp(tMs / inMs)))
  if (c.out && c.out !== 'none' && tMs > durMs - outMs) x = mul(x, poseOut(c.out, clamp((tMs - (durMs - outMs)) / outMs)))
  if (c.combo && c.combo !== 'none') x = mul(x, poseCombo(c.combo, tMs, durMs))
  return x
}

export const filterCss = (id?: string) => FILTERS.find((f) => f[0] === id)?.[2] ?? ''

/** Composite outgoing frame A and incoming frame B into ctx for progress p (0..1). */
export function drawTransition(ctx: CanvasRenderingContext2D, A: CanvasImageSource, B: CanvasImageSource, type: string, p: number) {
  const { width: W, height: H } = ctx.canvas
  ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
  const e = easeOut(p)
  switch (type) {
    case 'fade': ctx.drawImage(A, 0, 0, W, H); ctx.globalAlpha = p; ctx.drawImage(B, 0, 0, W, H); break
    case 'fadeBlack': if (p < 0.5) { ctx.globalAlpha = 1 - p * 2; ctx.drawImage(A, 0, 0, W, H) } else { ctx.globalAlpha = (p - 0.5) * 2; ctx.drawImage(B, 0, 0, W, H) } break
    case 'flash': ctx.drawImage(p < 0.5 ? A : B, 0, 0, W, H); ctx.globalAlpha = 1 - Math.abs(p - 0.5) * 2; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); break
    case 'slideLeft': ctx.drawImage(A, -W * e, 0, W, H); ctx.drawImage(B, W * (1 - e), 0, W, H); break
    case 'slideUp': ctx.drawImage(A, 0, -H * e, W, H); ctx.drawImage(B, 0, H * (1 - e), W, H); break
    case 'zoom': { ctx.drawImage(B, 0, 0, W, H); const s = 1 + 0.8 * e; ctx.globalAlpha = 1 - e; ctx.drawImage(A, (W - W * s) / 2, (H - H * s) / 2, W * s, H * s); break }
    case 'wipe': ctx.drawImage(A, 0, 0, W, H); ctx.beginPath(); ctx.rect(0, 0, W * e, H); ctx.clip(); ctx.drawImage(B, 0, 0, W, H); break
    default: ctx.drawImage(B, 0, 0, W, H)
  }
  ctx.restore()
}
