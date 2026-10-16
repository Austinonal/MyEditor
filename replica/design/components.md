# Components

Icons: Lucide (open). Font: Noto Sans Thai (open, covers Thai + Latin). All sizes in dp/px. Min touch target 48. Tokens from `tokens.json`.
Every component below needs TalkBack/screen-reader labels (Thai + English strings) and works with system font scaling up to 200%.

**Button** variants primary, secondary, ghost, danger; sizes md 48, sm 40; states default, pressed, focus-visible (2px accent ring), disabled, loading (keeps label for screen readers). Tokens: accent/on-accent, radius md. Used on S01,S03,S05,S12.

**IconButton** 48x48 hit area, 24 icon, label required. Used in toolbar S06.

**Slot block** (the key component). Height `timeline-row`, min width 24, radius sm.
- empty: dashed 2px `slot-empty-border`, plus icon, label "ว่าง / Empty", number badge
- filled: `slot-filled` fill, thumbnail strip, duration label
- selected: 2px `slot-selected` border, two 20px-wide drag handles at left/right edges (whole 48px tall target)
- dragging: raised shadow, snap guide line shows when snapped to beat/cut
- never locked: handles always present; long-press to reorder; a11y custom actions "extend / shorten / move / delete / fill"
Used on S05,S06,S07,S08.

**Timeline**: horizontal scroll + pinch zoom, ruler with time, beat markers (`beat-marker`, 2px ticks), playhead (`playhead`, 2px line with 12px head), track lanes with `track-*` colour, waveform lane. Used on S06,S09.

**Preview player**: 9:16 letterbox in other ratios, play/pause, scrub, current/total time. Used on S06,S07.

**Media grid cell**: square thumbnail, selection order badge, video duration chip. States default, selected, loading, unreadable. Used on S02.

**Progress card** (analysis): stage list (scenes, beats, effects, text, speech) each pending/running/done/failed, overall bar, cancel. Used on S04.

**Model download card** (first run): size, Wi-Fi only toggle, progress, retry, "later". Used on first launch / S13.

**Bottom sheet**: drag handle, scrim, dismiss by swipe and Back. Used on S07,S10,S11,S12.

**Toggle chip** (Snap, Ripple, Beats): on/off with check, 40px. Used on S06,S08.

**Slider** (volume, effect intensity): 48 touch height, value label. Used on S09,S10.

**Text field**: label above, `border-input` border, error text with icon, helper. Used on S11,S13.

**Dialog / Toast**: confirm (empty slots at export), undo toast after delete. Used on S12.

**Empty state**: icon + one-line Thai/English copy + one action, written fresh. Used on S01,S02.
