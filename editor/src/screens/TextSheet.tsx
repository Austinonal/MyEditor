import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AlignCenter, AlignLeft, AlignRight, BookmarkPlus, Captions, X } from 'lucide-react';
import { BottomSheet, Button, CategoryTabs, PresetTile, Slider, Swatches, Switch } from '../ui';
import { edit } from '../store';
import { FONTS, family, importFont, importGoogleFont, listCustomFonts, type CustomFont } from '../fonts';
import { GOOGLE_FONTS } from '../googleFonts.ts';
import { TEXT_TEMPLATES, templateOf, type TextTemplate } from '../textTemplates.ts';
import { listPresets, removePreset, savePreset } from '../myPresets.ts';
import { BUBBLES, GRADIENTS, bubbleOutline } from '../bubbles.ts';
import { SEC, applyTextTemplate, setBehind, updateText } from '../timeline.ts';
import type { TextClip, TextStyle } from '../schema';

const COLOURS = ['#ffffff', '#000000', '#ff3b30', '#ff9500', '#ffd84d', '#34c759', '#00c7be', '#32ade6', '#007aff', '#af52de', '#ff4f8b', '#a2845e'];

// Looks only: font, size and placement stay as they are.
type Look = Pick<TextStyle, 'colour' | 'stroke' | 'shadow' | 'background'>;
const LOOKS: [string, Look][] = [
  ['ซับมาตรฐาน', { colour: '#ffffffff', stroke: { colour: '#000000ff', width: 6 }, shadow: null, background: null }],
  ['กล่องดำ', { colour: '#ffffffff', stroke: null, shadow: null, background: { colour: '#000000b3', radius: 12 } }],
  ['เหลืองขอบดำ', { colour: '#ffd84dff', stroke: { colour: '#000000ff', width: 6 }, shadow: null, background: null }],
  ['เงานุ่ม', { colour: '#ffffffff', stroke: null, shadow: { colour: '#000000cc', blur: 12, dx: 0, dy: 4 }, background: null }],
  ['นีออนฟ้า', { colour: '#ffffffff', stroke: null, shadow: { colour: '#00e5ffff', blur: 28, dx: 0, dy: 0 }, background: null }],
  ['นีออนชมพู', { colour: '#ffe0f0ff', stroke: null, shadow: { colour: '#ff2d95ff', blur: 28, dx: 0, dy: 0 }, background: null }],
  ['ป้ายชมพู', { colour: '#ffffffff', stroke: null, shadow: null, background: { colour: '#ff4f8bff', radius: 24 } }],
  ['ป้ายเหลือง', { colour: '#111111ff', stroke: null, shadow: null, background: { colour: '#ffd84dff', radius: 8 } }],
  ['ดำบนขาว', { colour: '#111111ff', stroke: null, shadow: null, background: { colour: '#ffffffe6', radius: 8 } }],
  ['ขอบแดงหนา', { colour: '#ffffffff', stroke: { colour: '#ff3b30ff', width: 12 }, shadow: null, background: null }],
  ['ขาวขอบดำหนา', { colour: '#ffffffff', stroke: { colour: '#000000ff', width: 14 }, shadow: { colour: '#00000099', blur: 0, dx: 6, dy: 6 }, background: null }],
  ['ตัวดำขอบขาว', { colour: '#111111ff', stroke: { colour: '#ffffffff', width: 8 }, shadow: null, background: null }],
];

const TABS = ['เทมเพลต', 'สไตล์', 'แบบอักษร', 'สี', 'กรอบคำพูด', 'ขอบ', 'เงา', 'พื้นหลัง', 'ตำแหน่ง'] as const;
type Tab = (typeof TABS)[number];

const rgb = (c: string) => c.slice(0, 7);
const alpha = (c: string) => (c.length >= 9 ? parseInt(c.slice(7, 9), 16) / 255 : 1);
const withAlpha = (c: string, a: number) => rgb(c) + Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, '0');

// A CSS stand-in for the canvas look, for the small style tiles.
function lookCss(l: Look): CSSProperties {
  return {
    color: l.colour,
    WebkitTextStroke: l.stroke ? `${l.stroke.width / 4}px ${l.stroke.colour}` : undefined,
    paintOrder: 'stroke fill',
    textShadow: l.shadow ? `${l.shadow.dx / 4}px ${l.shadow.dy / 4}px ${l.shadow.blur / 4}px ${l.shadow.colour}` : undefined,
    background: l.background?.colour,
    borderRadius: l.background ? l.background.radius / 4 : undefined,
    padding: '0 4px',
  };
}

const POSITIONS: [string, number][] = [
  ['บน', 0.15],
  ['กลาง', 0.5],
  ['ล่าง', 0.82],
];

// A small drawing of each bubble shape for its tile.
function BubbleIcon({ shape }: { shape: (typeof BUBBLES)[number][0] }) {
  const o = bubbleOutline(shape, 30, 12);
  const pts = o.main.map(([x, y]) => `${x + 15},${y + 14}`).join(' ');
  return (
    <svg viewBox="0 0 60 40" className="h-8 w-12" aria-hidden>
      <polygon points={pts} className="fill-fg stroke-bg" strokeWidth={1.5} />
      {o.dots.map((d, i) => <circle key={i} cx={d.x + 15} cy={d.y + 14} r={d.r} className="fill-fg" />)}
    </svg>
  );
}

export function TextSheet({ open, onClose, clip, shown, setTransform, onNext }: { open: boolean; onClose: () => void; clip: TextClip; shown: TextClip['transform']; setTransform: (patch: Partial<TextClip['transform']>, key: string) => void; onNext?: () => void }) {
  const [tab, setTab] = useState<Tab>('สไตล์');
  const [custom, setCustom] = useState<CustomFont[]>([]);
  const [fontError, setFontError] = useState('');
  const [mine, setMine] = useState<TextTemplate[]>([]);
  const reloadMine = () => void listPresets().then(setMine, () => {});
  const fontInput = useRef<HTMLInputElement>(null);
  const [googleGroup, setGoogleGroup] = useState(GOOGLE_FONTS[0][0]);
  const [googleName, setGoogleName] = useState('');
  const [downloading, setDownloading] = useState('');
  function getGoogle(name: string) {
    setFontError('');
    setDownloading(name);
    importGoogleFont(name)
      .then(
        (font) => {
          setCustom((c) => [...c, font]);
          setGoogleName('');
          style({ fontId: font.id }, 'font');
        },
        (err: Error) => setFontError(err.message),
      )
      .finally(() => setDownloading(''));
  }
  useEffect(() => {
    if (open) void listCustomFonts().then(setCustom, () => {});
    if (open) reloadMine();
  }, [open]);
  async function saveMine() {
    const name = clip.text.trim().slice(0, 16) || 'พรีเซ็ต';
    await savePreset(templateOf(clip, name, `my-${crypto.randomUUID().slice(0, 8)}`));
    reloadMine();
  }
  const templateTile = (t: TextTemplate) => (
    <PresetTile
      label={t.name}
      selected={false}
      thumb={
        <span className="text-base leading-tight" style={{ fontFamily: family(t.style.fontId), ...lookCss({ colour: t.style.colour, stroke: t.style.stroke, shadow: t.style.shadow, background: t.style.background }) }}>
          {t.text.length > 8 ? 'Aa ก' : t.text}
        </span>
      }
      onClick={() => edit((d) => applyTextTemplate(d, clip.id, t))}
    />
  );
  const area = useRef<HTMLTextAreaElement>(null);
  const s = clip.style;
  const style = (patch: Partial<TextStyle>, key: string) => edit((d) => updateText(d, clip.id, { style: patch }), `text-${key}-${clip.id}`);
  const transform = (patch: Partial<TextClip['transform']>, key: string) => setTransform(patch, `text-${key}-${clip.id}`); // keyframe-aware, from the editor

  // A new subtitle opens with its text selected, so typing replaces it.
  useEffect(() => {
    if (open) area.current?.select();
  }, [open, clip.id]);

  return (
    <BottomSheet open={open} title="ข้อความ" onClose={onClose} modal={false}>
      <div className="flex flex-col gap-3">
        <textarea
          ref={area}
          aria-label="ข้อความ"
          placeholder="พิมพ์ข้อความ…"
          rows={2}
          value={clip.text}
          onChange={(e) => edit((d) => updateText(d, clip.id, { text: e.target.value }), `text-input-${clip.id}`)}
          className="w-full resize-none rounded-md border border-border-input bg-bg p-2 text-base focus-visible:outline-2 focus-visible:outline-accent"
        />
        {onNext && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={onNext}>
              <Captions size={16} aria-hidden /> ซับถัดไป
            </Button>
            <span className="text-xs text-muted">{(clip.duration / SEC).toFixed(1)} วิ · ต่อท้ายด้วยสไตล์เดียวกัน</span>
          </div>
        )}
        <CategoryTabs items={[...TABS]} value={tab} onChange={(v) => setTab(v as Tab)} />

        {tab === 'เทมเพลต' && (
          <>
            <h3 className="text-sm font-semibold">พรีเซ็ตของฉัน</h3>
            <Button variant="secondary" size="md" onClick={() => void saveMine()}>
              <BookmarkPlus size={16} aria-hidden /> บันทึกข้อความนี้เป็นพรีเซ็ต
            </Button>
            {mine.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {mine.map((t) => (
                  <div key={t.id} className="relative">
                    {templateTile(t)}
                    <button
                      aria-label={`ลบพรีเซ็ต ${t.name}`}
                      onClick={() => void removePreset(t.id).then(reloadMine)}
                      className="absolute top-0 right-1 grid size-7 place-items-center rounded-pill bg-bg/80 text-fg focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <h3 className="text-sm font-semibold">เทมเพลตสำเร็จรูป</h3>
            <div className="grid grid-cols-3 gap-2">
              {TEXT_TEMPLATES.map((t) => (
                <div key={t.id}>{templateTile(t)}</div>
              ))}
            </div>
            <p className="text-xs text-muted">เลือกแล้วตั้งสไตล์ ตำแหน่ง และแอนิเมชันให้ครบ ข้อความที่พิมพ์ไว้แล้วจะไม่ถูกเปลี่ยน แก้ต่อได้ในแท็บอื่น</p>
          </>
        )}

        {tab === 'สไตล์' && (
          <div className="grid grid-cols-4 gap-2">
            {LOOKS.map(([name, look]) => (
              <PresetTile
                key={name}
                label={name}
                selected={JSON.stringify([s.colour, s.stroke, s.shadow, s.background]) === JSON.stringify([look.colour, look.stroke, look.shadow, look.background])}
                thumb={
                  <span className="text-lg" style={{ fontFamily: family(s.fontId), ...lookCss(look) }}>
                    Aa ก
                  </span>
                }
                onClick={() => style(look, 'look')}
              />
            ))}
          </div>
        )}

        {tab === 'แบบอักษร' && (
          <div role="group" aria-label="แบบอักษร" className="grid grid-cols-2 gap-2">
            {FONTS.map((f) => (
              <button
                key={f.id}
                aria-pressed={s.fontId === f.id}
                onClick={() => style({ fontId: f.id }, 'font')}
                className={`flex h-14 flex-col items-start justify-center rounded-md bg-raised px-3 text-left focus-visible:outline-2 focus-visible:outline-accent ${s.fontId === f.id ? 'ring-2 ring-accent' : ''}`}
              >
                <span className="text-lg leading-tight" style={{ fontFamily: family(f.id), fontWeight: f.weight }}>
                  สวัสดี Aa
                </span>
                <span className="text-xs text-muted">{f.name}</span>
              </button>
            ))}
            {custom.map((f) => (
              <button
                key={f.id}
                aria-pressed={s.fontId === f.id}
                onClick={() => style({ fontId: f.id }, 'font')}
                className={`flex h-14 flex-col items-start justify-center rounded-md bg-raised px-3 text-left focus-visible:outline-2 focus-visible:outline-accent ${s.fontId === f.id ? 'ring-2 ring-accent' : ''}`}
              >
                <span className="text-lg leading-tight" style={{ fontFamily: family(f.id) }}>
                  สวัสดี Aa
                </span>
                <span className="truncate text-xs text-muted">{f.name}</span>
              </button>
            ))}
            <Button variant="secondary" size="md" className="col-span-2" onClick={() => fontInput.current?.click()}>
              นำเข้าฟอนต์จากเครื่อง
            </Button>
            <input
              ref={fontInput}
              type="file"
              accept=".ttf,.otf,.woff,.woff2,font/*"
              hidden
              aria-label="เลือกไฟล์ฟอนต์"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                setFontError('');
                importFont(f).then(
                  (font) => {
                    setCustom((c) => [...c, font]);
                    style({ fontId: font.id }, 'font');
                  },
                  (err: Error) => setFontError(err.message),
                );
              }}
            />
            {fontError && <p role="alert" className="col-span-2 text-sm text-danger">{fontError}</p>}
            <h3 className="col-span-2 mt-2 text-sm font-semibold">ดาวน์โหลดจาก Google Fonts</h3>
            <div className="col-span-2">
              <CategoryTabs items={GOOGLE_FONTS.map(([g]) => g)} value={googleGroup} onChange={setGoogleGroup} />
            </div>
            <div className="col-span-2 flex flex-wrap gap-2">
              {(GOOGLE_FONTS.find(([g]) => g === googleGroup)?.[1] ?? [])
                .filter((n) => !custom.some((c) => c.name === n))
                .map((n) => (
                  <button key={n} disabled={!!downloading} onClick={() => getGoogle(n)} className="h-9 rounded-pill bg-raised px-3 text-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent">
                    {downloading === n ? 'กำลังโหลด…' : n}
                  </button>
                ))}
            </div>
            <form
              className="col-span-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (googleName.trim()) getGoogle(googleName);
              }}
            >
              <input
                aria-label="ชื่อฟอนต์ใน Google Fonts"
                placeholder="พิมพ์ชื่อฟอนต์อื่น เช่น Lobster"
                value={googleName}
                onChange={(e) => setGoogleName(e.target.value)}
                className="h-10 min-w-0 flex-1 rounded-md border border-border-input bg-bg px-3 text-sm focus-visible:outline-2 focus-visible:outline-accent"
              />
              <Button size="md" type="submit" loading={!!downloading && downloading === googleName} disabled={!!downloading || !googleName.trim()}>
                ดาวน์โหลด
              </Button>
            </form>
            <p className="col-span-2 text-xs text-muted">ฟอนต์ที่นำเข้าหรือดาวน์โหลดเก็บไว้ในเครื่องนี้ (ใช้เน็ตแค่ตอนดาวน์โหลด) ใช้ได้ทั้งในตัวอย่างและตอนส่งออก · ใช้เฉพาะฟอนต์ที่คุณมีสิทธิ์ใช้</p>
          </div>
        )}

        {tab === 'สี' && (
          <>
            <Swatches label="สีตัวอักษร" colours={COLOURS} value={rgb(s.colour)} onChange={(c) => style({ colour: withAlpha(c, alpha(s.colour)), gradient: null }, 'colour')} />
            <div role="radiogroup" aria-label="ไล่สีตัวอักษร" className="grid grid-cols-4 gap-2">
              <PresetTile label="สีเดียว" none selected={!s.gradient} onClick={() => style({ gradient: null }, 'gradient')} />
              {GRADIENTS.map(([name, g]) => (
                <PresetTile
                  key={name}
                  label={name}
                  selected={JSON.stringify(s.gradient) === JSON.stringify(g)}
                  thumb={<span className="text-xl font-bold" style={{ backgroundImage: `linear-gradient(${g.across ? '90deg' : '180deg'}, ${g.colours.join(', ')})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Aa ก</span>}
                  onClick={() => style({ gradient: g }, 'gradient')}
                />
              ))}
            </div>
            <Slider label="ความทึบ" value={Math.round(shown.opacity * 100)} min={0} max={100} step={5} format={(v) => `${v}%`} onChange={(v) => transform({ opacity: v / 100 }, 'opacity')} />
          </>
        )}

        {tab === 'กรอบคำพูด' && (
          <>
            <div role="radiogroup" aria-label="กรอบคำพูด" className="grid grid-cols-4 gap-2">
              <PresetTile label="ไม่มี" none selected={!s.bubble} onClick={() => style({ bubble: null }, 'bubble')} />
              {BUBBLES.map(([shape, name]) => (
                <PresetTile key={shape} label={name} selected={s.bubble?.shape === shape} thumb={<BubbleIcon shape={shape} />} onClick={() => style({ bubble: { fill: s.bubble?.fill ?? '#ffffffff', border: s.bubble?.border ?? '#111111ff', shape }, colour: s.bubble ? s.colour : '#111111ff', stroke: s.bubble ? s.stroke : null, background: null }, 'bubble')} />
              ))}
            </div>
            {s.bubble && (
              <>
                <Swatches label="สีกรอบ" colours={COLOURS} value={rgb(s.bubble.fill)} onChange={(c) => style({ bubble: { ...s.bubble!, fill: withAlpha(c, 1) } }, 'bubble-fill')} />
                <Swatches label="สีเส้นขอบกรอบ" colours={COLOURS} value={rgb(s.bubble.border ?? '#000000')} onChange={(c) => style({ bubble: { ...s.bubble!, border: withAlpha(c, 1) } }, 'bubble-border')} />
                <Button variant="ghost" size="md" disabled={!s.bubble.border} onClick={() => style({ bubble: { ...s.bubble!, border: null } }, 'bubble-border-off')}>
                  ไม่มีเส้นขอบ
                </Button>
              </>
            )}
          </>
        )}

        {tab === 'ขอบ' && (
          <>
            <Swatches label="สีขอบ" colours={COLOURS} value={rgb(s.stroke?.colour ?? '#000000')} onChange={(c) => style({ stroke: { colour: withAlpha(c, 1), width: s.stroke?.width || 6 } }, 'stroke')} />
            <Slider
              label="ความหนาขอบ"
              value={s.stroke?.width ?? 0}
              min={0}
              max={24}
              step={1}
              onChange={(v) => style({ stroke: v > 0 ? { colour: s.stroke?.colour ?? '#000000ff', width: v } : null }, 'stroke-width')}
            />
          </>
        )}

        {tab === 'เงา' && (
          <>
            <Swatches label="สีเงา" colours={COLOURS} value={rgb(s.shadow?.colour ?? '#000000')} onChange={(c) => style({ shadow: { blur: 12, dx: 0, dy: 4, ...s.shadow, colour: withAlpha(c, alpha(s.shadow?.colour ?? '#000000cc')) } }, 'shadow')} />
            <Slider
              label="ความฟุ้ง"
              value={s.shadow?.blur ?? 0}
              min={0}
              max={40}
              step={1}
              onChange={(v) => style({ shadow: { colour: '#000000cc', dx: 0, dy: 4, ...s.shadow, blur: v } }, 'shadow-blur')}
            />
            <Slider
              label="ระยะเงา"
              value={s.shadow?.dy ?? 0}
              min={0}
              max={20}
              step={1}
              onChange={(v) => style({ shadow: { colour: '#000000cc', blur: 12, ...s.shadow, dx: v / 2, dy: v } }, 'shadow-offset')}
            />
            <Button variant="ghost" size="md" disabled={!s.shadow} onClick={() => style({ shadow: null }, 'shadow-off')}>
              ไม่มีเงา
            </Button>
          </>
        )}

        {tab === 'พื้นหลัง' && (
          <>
            <Swatches label="สีพื้นหลัง" colours={COLOURS} value={rgb(s.background?.colour ?? '#000000')} onChange={(c) => style({ background: { colour: withAlpha(c, alpha(s.background?.colour ?? '#000000b3')), radius: s.background?.radius ?? 12 } }, 'bg')} />
            <Slider
              label="ความทึบพื้นหลัง"
              value={Math.round(alpha(s.background?.colour ?? '#00000000') * 100)}
              min={0}
              max={100}
              step={5}
              format={(v) => `${v}%`}
              onChange={(v) => style({ background: v > 0 ? { colour: withAlpha(s.background?.colour ?? '#000000', v / 100), radius: s.background?.radius ?? 12 } : null }, 'bg-alpha')}
            />
            <Slider
              label="ความมนของมุม"
              value={s.background?.radius ?? 0}
              min={0}
              max={60}
              step={2}
              onChange={(v) => s.background && style({ background: { ...s.background, radius: v } }, 'bg-radius')}
            />
          </>
        )}

        {tab === 'ตำแหน่ง' && (
          <>
            <Slider label="ขนาด" value={s.size} min={16} max={240} step={2} onChange={(v) => style({ size: v }, 'size')} />
            <div role="group" aria-label="จัดแนว" className="flex gap-2">
              {(
                [
                  ['left', AlignLeft, 'ชิดซ้าย'],
                  ['center', AlignCenter, 'กึ่งกลาง'],
                  ['right', AlignRight, 'ชิดขวา'],
                ] as const
              ).map(([v, Icon, label]) => (
                <Button key={v} variant={s.align === v ? 'primary' : 'secondary'} size="md" aria-label={label} aria-pressed={s.align === v} onClick={() => style({ align: v }, 'align')}>
                  <Icon size={18} aria-hidden />
                </Button>
              ))}
              <span className="flex-1" />
              {POSITIONS.map(([label, y]) => (
                <Button key={label} variant="secondary" size="md" onClick={() => transform({ x: 0.5, y }, 'place')}>
                  {label}
                </Button>
              ))}
            </div>
            <Slider label="หมุน" value={Math.round(shown.rotation)} min={-180} max={180} step={1} format={(v) => `${v}°`} onChange={(v) => transform({ rotation: v }, 'rotate')} />
            <Slider label="ซูม" value={Math.round(shown.scale * 100)} min={20} max={400} step={5} format={(v) => `${v}%`} onChange={(v) => transform({ scale: v / 100 }, 'scale')} />
            <Switch label="ไว้หลังคน" hint="ข้อความอยู่หลังตัวคนในวิดีโอหลัก เหมือนคนยืนบังตัวหนังสือ" on={!!clip.behind} onChange={(on) => edit((d) => setBehind(d, clip.id, on))} />
            <p className="text-xs text-muted">บนจอตัวอย่าง: ลากเพื่อย้าย ใช้สองนิ้วเพื่อย่อ/ขยายและหมุน</p>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
