# Recon map: mobile auto-cut video editor (CapCut / KineMaster / Alight Motion style)

## 1. Scope (confirmed by user)
- **Platforms:** mobile web app (PWA) + native Android. Same product, two clients.
- **Slice, in build order:** (1) core loop: Auto Cut from a reference clip -> editable skeleton timeline with empty slots -> export. (2) then normal CapCut-style manual editing.
- **Analysis detects:** shot boundaries, beat/loudness, effects/transitions/zoom, on-screen text, speech, plus anything else that makes the result closer to the reference.
- **Runs:** on the user's device, personal / small team use. No server, no accounts, no payments.
- **Hard rule from user:** the plan is a suggestion, never locked. Every slot can be dragged and resized. Anything unclear goes back to the user first.

## 2. Sources
Access note: play.google.com and capcut.com were unreachable from this sandbox (DNS blocked), so Play listings were NOT read directly. Everything below is from web-search summaries and general knowledge. Confidence is marked. Ask the user to paste listing text / screenshots to raise it.

| source | gives | status |
| --- | --- | --- |
| CapCut help: Auto Cut (capcut.com/help/how-to-use-auto-cut) | auto cut on music beat or speech pauses | via search summary, medium |
| CapCut help: TikTok anchor points | sync points for beats/lyrics/SFX, breaks if audio replaced | via search summary, medium |
| Third-party template guides | "Use Template": placeholder slots, keep clip order/length | low-medium |
| KineMaster features page (kinemaster.com/features) | multi-layer, chroma key, keyframes, asset store, 4K export | via search, medium |
| Alight Motion listing / AlternativeTo | keyframes + easing curves, vector, blend modes, 160+ effects, MP4/GIF/PNG-seq export | via search, medium |
| User's own account / screenshots | real screens and states | **not yet provided** |

## 3. Screen inventory
| ID | screen | how you get there | purpose | key components | states |
| --- | --- | --- | --- | --- | --- |
| S01 | Home / projects | app launch | start new, reopen drafts | New project, Auto Cut entry, project grid | empty, filled |
| S02 | Media picker | New project / Add media | import photos+videos from device | grid, multi-select, album switcher, permission prompt | permission denied, empty, loading |
| S03 | Auto Cut: pick reference | Home -> Auto Cut | choose the clip to copy | reference picker, tips | empty |
| S04 | Analysis progress | after S03 | run detection on device | progress bar by stage (scenes, beats, effects, text, speech), cancel | running, failed, cancelled, done |
| S05 | Skeleton review | after S04 | show detected plan | scene list, thumbnails, slot count, "slots needed vs media you have" | 0 media, fewer media, enough media |
| S06 | Timeline editor | S05 or manual new project | main edit surface | preview player, multi-track timeline, playhead, toolbar | empty, filled, playing, selection |
| S07 | Slot detail | tap an empty/filled slot | fill, replace, trim slot | media fill button, in/out trim, duration drag handles | empty slot, filled, locked-off (always unlocked) |
| S08 | Resize/ripple behaviour | drag slot edge | change length, neighbours ripple or stay | snap to beat/cut toggle, ripple toggle | snapped, free |
| S09 | Audio panel | toolbar | reference audio, beats, volume | waveform, beat markers, volume, fade | no audio, beats shown |
| S10 | Effects/transitions panel | toolbar / slot | detected effect applied, change or remove | effect list, transition list, intensity | none, detected, user-changed |
| S11 | Text/captions panel | toolbar | detected on-screen text + speech captions | text list, edit text, style, timing | none, detected |
| S12 | Export | top-right | resolution, fps, format | resolution/fps picker, progress, share | progress, success, error |
| S13 | Settings | Home | storage, analysis quality, language | quality slider, cache clear | default |
| S14 | Manual editor tools (phase 2) | S06 toolbar | trim, split, speed, filters, keyframes, overlays, chroma key | tool tray per tool | per tool |

## 4. User flows
- **F01 Auto Cut from reference** (core, count clicks: target <= 6)
  S01 -> S03 pick reference -> S04 analysis -> S05 review skeleton -> S02 add own media -> S06 timeline with slots filled -> S12 export.
  edge: reference too long, no audio track, no cuts detected (single shot), analysis killed by memory pressure, app backgrounded mid-analysis, vertical vs horizontal mismatch.
- **F02 Fewer media than slots** (user example: 1 photo, reference needs 6-7)
  S05 shows 6-7 empty placeholder blocks, user's media fills the first/best matches, rest stay empty -> S07 fill later or delete slot.
  edge: export with empty slots (warn, offer black/freeze/delete).
- **F03 Adjust the plan**
  S06 drag slot edge to resize (S08), drag slot to reorder, split/merge/delete slot. Beat snap on by default, can be turned off. Nothing is locked.
- **F04 Replace media in a slot**
  S06 tap slot -> S07 -> S02 -> new media fits slot length, user picks in-point.
- **F05 Manual edit from scratch** (phase 2)
  S01 -> S02 -> S06 (S14 tools) -> S12.
- **F06 Resume draft**: S01 -> S06, autosave, reopen after crash.

## 5. Components
Preview player with scrub; multi-track timeline (video, overlay, text, audio, effect lanes); slot block (empty/filled/selected, drag handles); beat markers; waveform; thumbnails strip; playhead with snap; toolbar tray; bottom sheet; progress card with stage list; media grid cell with selection count; export dialog; toast; permission prompt; confirm dialog.

## 6. Inferred data model (confidence)
- **Project** id, name, aspect_ratio, fps, created_at, updated_at, reference_id? (high)
- **Media** id, kind (video|image|audio), uri, duration, width, height, hash (high)
- **Reference** id, media_id, analysis_version, duration, status (high)
- **Scene** id, reference_id, start_ms, end_ms, shot_kind guess, thumbnail (high)
- **BeatMarker** reference_id, t_ms, strength (high)
- **DetectedEffect** scene_id or boundary, kind (cut|fade|zoom|shake|flash|slide|...), params json, confidence (medium: effects are a vocabulary guess)
- **TextEvent** reference_id, start/end, text, source (ocr|speech), bbox, style guess (medium)
- **Slot** id, project_id, scene_id?, order, start_ms, duration_ms, media_id?, in_ms, out_ms, effect_id?, snapped bool (high)
- **Track/Clip** for manual editing: track_id, clip start/duration, transform, keyframes json (medium)
- **ExportJob** project_id, resolution, fps, format, status, output_uri (high)

## 7. Feature matrix
See features.csv.

## 8. Cannot be cloned (skip)
- Music, sticker, font, effect and template libraries (licensed; use own or open-licensed assets).
- Trending-template feed, social network and creator marketplace.
- Cloud AI features (auto captions in 100+ languages, generative AI) at the originals' quality; local models only.
- Exactly reproducing a reference's custom effects: detection maps to a **fixed vocabulary** of our own effects, a close match, never 100%.
- Copyrighted reference content: the app analyses structure only; it never copies reference media into the output.

## 9. Size and hard parts
Counts: 14 screens, 6 flows, ~11 entities. Size: **XL for everything, L for slice 1.** Rescope tip: ship slice 1 as web PWA first, then Android.
Hard parts:
1. **On-device analysis accuracy and speed** (shot detection, beat tracking, effect classification, OCR, speech-to-text) on phones; effect/transition detection is the least reliable and the research-heavy part.
2. **Timeline editor** with smooth drag/resize/snap on touch, and frame-accurate preview.
3. **Video decode/encode/export** on-device: WebCodecs / ffmpeg.wasm in the browser (limited memory, slower) vs MediaCodec on Android. Two clients double the engine work; consider a shared Rust/C++ core or a shared project JSON format.
Out of scope for now: accounts, cloud sync, payments, templates marketplace.

## 10. Open questions for the user
1. Can you paste Play Store listing text or screenshots of the three apps (and CapCut's Auto Cut / Template screens)? Direct access failed.
2. Free of watermark, no ads, no subscription: confirm.
3. Output aspect ratio default: 9:16 vertical?
4. Which languages must speech/text detection support (Thai + English?). This decides the speech-to-text and OCR models.
5. One shared codebase for web+Android, or Android native separately? (affects /replica-architect)
