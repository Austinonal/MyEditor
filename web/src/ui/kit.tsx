import type { ComponentChildren } from 'preact'
import { useEffect } from 'preact/hooks'
import { Icon } from './icons'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [onClose])
  return (
    <div class="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}><div class="grab" /><h3>{title}</h3>{children}</div>
    </div>
  )
}
export const Notice = ({ children, err }: { children: ComponentChildren; err?: boolean }) => <div class={'notice' + (err ? ' err' : '')} role={err ? 'alert' : 'status'}><Icon n="alert" /><span>{children}</span></div>
export const Top = ({ title, back = '#/', right }: { title: string; back?: string; right?: ComponentChildren }) => (
  <div class="top"><a class="ib" href={back} aria-label="ย้อนกลับ"><Icon n="back" /></a><h1>{title}</h1>{right}</div>
)
export const fmt = (ms: number) => { const s = Math.max(ms, 0) / 1000; return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}` }
