import type { Media, Slot } from './types'
import { slotAt, starts, total } from './timeline'
import { animTransform, drawTransition, filterCss } from './anim'

interface Src { media: Media; el: HTMLVideoElement | HTMLImageElement; url: string }
export interface Soundtrack { buffer: AudioBuffer; on: boolean; volume: number }

/** Draws the timeline to a canvas, with CapCut-style animations, transitions, filters and text. Same code path for preview and export. */
export class Player {
  t = 0
  playing = false
  onTick: (tMs: number) => void = () => {}
  onEnd: () => void = () => {}
  soundtrack: Soundtrack | null = null
  audioDest: MediaStreamAudioDestinationNode | null = null // export taps the soundtrack here
  private srcs = new Map<string, Src>()
  private raf = 0
  private t0 = 0
  private from = 0
  private active = -1
  private ctx: CanvasRenderingContext2D
  private layer: HTMLCanvasElement // the slot being shown
  private prev: HTMLCanvasElement // last frame of the previous slot, for transitions
  private prevFor = -1
  private ac: AudioContext | null = null
  private node: AudioBufferSourceNode | null = null
  private gain: GainNode | null = null

  constructor(public canvas: HTMLCanvasElement, public slots: () => Slot[]) {
    this.ctx = canvas.getContext('2d')!
    this.layer = this.mk(); this.prev = this.mk()
  }
  private mk() { const c = document.createElement('canvas'); c.width = this.canvas.width; c.height = this.canvas.height; return c }

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
    this.pause(); this.ac?.close().catch(() => {}); this.ac = null
    this.srcs.forEach((s) => URL.revokeObjectURL(s.url))
    this.srcs.clear()
  }

  async seek(tMs: number) {
    if (this.playing) { this.pause(); this.onEnd() } // scrubbing stops playback, otherwise the play loop would overwrite the new time
    const s = this.slots(); const len = total(s)
    this.t = Math.min(Math.max(tMs, 0), len)
    await this.draw(false)
    this.onTick(this.t)
  }

  private stopAt: number | null = null
  play(stopAt?: number) {
    if (this.playing || !this.slots().length) return
    if (this.t >= total(this.slots()) - 10) this.t = 0
    this.stopAt = stopAt ?? null
    this.playing = true; this.from = this.t; this.t0 = performance.now(); this.active = -1; this.prevFor = -1
    this.startAudio()
    const frame = () => {
      if (!this.playing) return
      this.t = this.from + (performance.now() - this.t0)
      const len = total(this.slots())
      if (this.stopAt !== null && this.t >= this.stopAt) { this.t = Math.min(this.stopAt, len); this.draw(true); this.onTick(this.t); this.pause(); this.onEnd(); return }
      if (this.t >= len) { this.t = len; this.draw(true); this.onTick(this.t); this.pause(); this.onEnd(); return }
      this.draw(true); this.onTick(this.t)
      this.raf = requestAnimationFrame(frame)
    }
    this.raf = requestAnimationFrame(frame)
  }

  pause() {
    this.playing = false; cancelAnimationFrame(this.raf)
    this.srcs.forEach((s) => s.el instanceof HTMLVideoElement && s.el.pause())
    try { this.node?.stop() } catch { /* already stopped */ }
    this.node = null
  }

  private startAudio() {
    const st = this.soundtrack
    if (!st || !st.on) return
    this.ac ??= new AudioContext()
    this.ac.resume().catch(() => {})
    this.gain = this.ac.createGain(); this.gain.gain.value = st.volume
    const n = this.ac.createBufferSource(); n.buffer = st.buffer
    n.connect(this.gain); this.gain.connect(this.ac.destination)
    if (this.audioDest) this.gain.connect(this.audioDest)
    n.start(0, Math.min(this.t / 1000, Math.max(st.buffer.duration - 0.01, 0))); this.node = n
  }
  /** Create the tap used by export. Must be called before play(). */
  prepareExportAudio(): MediaStream | null {
    if (!this.soundtrack?.on) return null
    this.ac ??= new AudioContext(); this.audioDest = this.ac.createMediaStreamDestination()
    return this.audioDest.stream
  }

  private async draw(playing: boolean) {
    const { ctx, canvas, layer, prev } = this
    for (const c of [layer, prev]) if (c.width !== canvas.width || c.height !== canvas.height) { c.width = canvas.width; c.height = canvas.height; this.prevFor = -1 }
    const slots = this.slots()
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (!slots.length) return
    const i = slotAt(slots, this.t)
    const slot = slots[i]; const tIn = this.t - starts(slots)[i]
    await this.renderSlot(layer.getContext('2d')!, i, tIn, playing)
    const tr = slot.trans
    if (i > 0 && tr && tr.type !== 'none' && tIn < tr.ms) {
      if (!playing || this.prevFor !== i - 1) {
        await this.renderSlot(prev.getContext('2d')!, i - 1, slots[i - 1].durationMs - 1, false); this.prevFor = i - 1
        if (playing) this.active = -1 // the paused render moved the previous video; restart the current one
        await this.renderSlot(layer.getContext('2d')!, i, tIn, playing)
      }
      drawTransition(ctx, prev, layer, tr.type, tIn / tr.ms)
    } else {
      ctx.drawImage(layer, 0, 0)
      if (playing) { prev.getContext('2d')!.drawImage(layer, 0, 0); this.prevFor = i }
    }
  }

  private async renderSlot(c: CanvasRenderingContext2D, i: number, tIn: number, playing: boolean) {
    const slots = this.slots(); const slot = slots[i]
    const { width: W, height: H } = c.canvas
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none'; c.fillStyle = '#000'; c.fillRect(0, 0, W, H)
    const src = slot.mediaId ? this.srcs.get(slot.mediaId) : undefined
    if (src) {
      const speed = slot.speed ?? 1
      if (src.el instanceof HTMLVideoElement) await this.syncVideo(src, i, slot, tIn, speed, playing)
      const x = animTransform(slot.anim, tIn, slot.durationMs)
      c.translate(W / 2 + x.tx * W, H / 2 + x.ty * H); c.rotate(x.rot); c.scale(x.s, x.s); c.globalAlpha = x.a
      const f = filterCss(slot.filter); if (f) c.filter = f
      const s = Math.max(W / src.media.w, H / src.media.h)
      c.drawImage(src.el, (-src.media.w * s) / 2, (-src.media.h * s) / 2, src.media.w * s, src.media.h * s)
    }
    c.restore()
    if (slot.text?.content) this.drawText(c, slot, tIn)
  }

  private async syncVideo(src: Src, i: number, slot: Slot, tIn: number, speed: number, playing: boolean) {
    const v = src.el as HTMLVideoElement
    const want = Math.min((slot.inMs + tIn * speed) / 1000, Math.max(src.media.durationMs / 1000 - 0.001, 0))
    if (playing) {
      if (this.active !== i) {
        this.srcs.forEach((s) => s !== src && s.el instanceof HTMLVideoElement && s.el.pause())
        v.playbackRate = speed; v.currentTime = want; this.active = i; await v.play().catch(() => {})
      }
    } else {
      v.pause(); this.active = -1
      if (Math.abs(v.currentTime - want) > 0.02) await new Promise<void>((r) => { const h = () => { v.removeEventListener('seeked', h); r() }; v.addEventListener('seeked', h); v.currentTime = want })
    }
  }

  private drawText(c: CanvasRenderingContext2D, slot: Slot, tIn: number) {
    const t = slot.text!; const { width: W, height: H } = c.canvas
    const x = animTransform({ in: t.anim, inMs: 400 }, tIn, slot.durationMs)
    const px = Math.round((t.size / 720) * W)
    c.save(); c.globalAlpha = x.a; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${px}px "Noto Sans Thai", system-ui, sans-serif`
    const y = (t.pos === 'top' ? 0.15 : t.pos === 'center' ? 0.5 : 0.85) * H
    c.translate(W / 2 + x.tx * W, y + x.ty * H); c.scale(x.s, x.s)
    c.lineWidth = px / 6; c.lineJoin = 'round'; c.strokeStyle = t.color === '#000000' ? '#fff' : '#000'; c.strokeText(t.content, 0, 0)
    c.fillStyle = t.color; c.fillText(t.content, 0, 0); c.restore()
  }
}
