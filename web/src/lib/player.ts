import type { Media, Slot } from './types'
import { slotAt, starts, total } from './timeline'

interface Src { media: Media; el: HTMLVideoElement | HTMLImageElement; url: string }

/** Draws the timeline to a canvas. Used for both the preview and the export (same code path). */
export class Player {
  t = 0
  playing = false
  onTick: (tMs: number) => void = () => {}
  onEnd: () => void = () => {}
  private srcs = new Map<string, Src>()
  private raf = 0
  private t0 = 0
  private from = 0
  private active = -1
  private ctx: CanvasRenderingContext2D

  constructor(public canvas: HTMLCanvasElement, public slots: () => Slot[]) {
    this.ctx = canvas.getContext('2d')!
  }

  async load(items: { media: Media; blob: Blob }[]) {
    await Promise.all(items.filter((i) => !this.srcs.has(i.media.id)).map(async ({ media, blob }) => {
      const url = URL.createObjectURL(blob)
      if (media.kind === 'video') {
        const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url
        await new Promise<void>((res) => { v.onloadeddata = () => res(); v.onerror = () => res() })
        this.srcs.set(media.id, { media, el: v, url })
      } else {
        const i = new Image(); i.src = url
        await i.decode().catch(() => {})
        this.srcs.set(media.id, { media, el: i, url })
      }
    }))
  }

  dispose() {
    this.pause()
    this.srcs.forEach((s) => URL.revokeObjectURL(s.url))
    this.srcs.clear()
  }

  async seek(tMs: number) {
    const s = this.slots(); const len = total(s)
    this.t = Math.min(Math.max(tMs, 0), len)
    await this.draw(false)
    this.onTick(this.t)
  }

  play() {
    if (this.playing || !this.slots().length) return
    if (this.t >= total(this.slots()) - 10) this.t = 0
    this.playing = true; this.from = this.t; this.t0 = performance.now(); this.active = -1
    const frame = () => {
      if (!this.playing) return
      this.t = this.from + (performance.now() - this.t0)
      const len = total(this.slots())
      if (this.t >= len) { this.t = len; this.draw(true); this.onTick(this.t); this.pause(); this.onEnd(); return }
      this.draw(true); this.onTick(this.t)
      this.raf = requestAnimationFrame(frame)
    }
    this.raf = requestAnimationFrame(frame)
  }

  pause() {
    this.playing = false; cancelAnimationFrame(this.raf)
    this.srcs.forEach((s) => s.el instanceof HTMLVideoElement && s.el.pause())
  }

  private async draw(playing: boolean) {
    const { ctx, canvas } = this
    const slots = this.slots()
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (!slots.length) return
    const i = slotAt(slots, this.t)
    const slot = slots[i]; const inSlot = this.t - starts(slots)[i]
    const src = slot.mediaId ? this.srcs.get(slot.mediaId) : undefined
    if (!src) return
    if (src.el instanceof HTMLVideoElement) {
      const want = (slot.inMs + inSlot) / 1000
      if (playing) {
        if (this.active !== i) {
          this.srcs.forEach((s) => s !== src && s.el instanceof HTMLVideoElement && s.el.pause())
          src.el.currentTime = want; this.active = i; await src.el.play().catch(() => {})
        }
      } else {
        src.el.pause(); this.active = -1
        if (Math.abs(src.el.currentTime - want) > 0.02) await new Promise<void>((r) => { const h = () => { src.el.removeEventListener('seeked', h); r() }; src.el.addEventListener('seeked', h); (src.el as HTMLVideoElement).currentTime = Math.min(want, Math.max(src.media.durationMs / 1000 - 0.001, 0)) })
      }
    }
    this.cover(src.el, src.media.w, src.media.h)
  }

  private cover(el: CanvasImageSource, w: number, h: number) {
    const { ctx, canvas } = this
    const s = Math.max(canvas.width / w, canvas.height / h)
    const dw = w * s, dh = h * s
    ctx.drawImage(el, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh)
  }
}
