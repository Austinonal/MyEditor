# Architecture: on-device auto-cut video editor

Constraints from the user: personal / small team, everything runs on the device, **web PWA and native Android as two separate codebases**, 9:16 first plus other ratios, Thai + English, no accounts, no payments, no watermark.

## 1. Stack (the template's default does not fit: no server, no auth, no Stripe, no Vercel)
| layer | web PWA | Android native | why |
| --- | --- | --- | --- |
| language / UI | TypeScript + Vite + Preact or React, Tailwind | Kotlin + Jetpack Compose | boring, well documented |
| storage | SQLite-WASM on OPFS (same `schema.sql`) | Room/SQLite (same `schema.sql`) | one schema, two engines |
| decode/preview | WebCodecs + Canvas/WebGL | Media3 / MediaCodec + OpenGL | hardware decode |
| export | WebCodecs encode + mp4 muxer; ffmpeg.wasm fallback | Media3 Transformer / MediaCodec | |
| scene cuts | frame histogram + SSIM on downscaled frames (own code) | same algorithm in Kotlin/NDK | cheap, accurate for hard cuts |
| beats | onset/tempo on audio (own code or essentia.js) | aubio/essentia via NDK | |
| speech (Thai+EN) | Whisper via onnxruntime-web / transformers.js (WebGPU) | whisper.cpp (NDK) | multilingual; see risks |
| OCR (Thai+EN) | PaddleOCR (Thai + Latin models) on onnxruntime-web | PaddleOCR/Tesseract `tha`+`eng` via NDK | **ML Kit v2 does not list Thai** (Latin, Chinese, Devanagari, Japanese, Korean) |
| hosting | any static host with COOP/COEP headers (for SharedArrayBuffer) | Play Store / sideload APK | |
| shared contract | `project.json` + `analysis.json` (versioned) | same | lets each side open the other's files |

One rule: **the analysis output is a plain JSON file**. Each client has its own engine, but both write the same `analysis.json`, and a test set of reference clips compares them.

## 2. Schema
`replica/schema.sql` (14 tables). Decisions: ms integers for time, `analysis_version` to invalidate cached analysis, `stages_done` so a killed analysis resumes, `slot.media_id null` = empty placeholder, nothing is ever locked (`snap` is a per-slot toggle). Access rules: single user, no RLS; every query scoped by `project_id`. Foreign keys: deleting a project cascades to slots/clips/tracks; deleting media sets `media_id` null (slot becomes empty, not lost); a reference's media is `restrict` so analysis is not orphaned.

## 3. "API" = internal module interfaces (no server)
| interface | does | input -> output | flow |
| --- | --- | --- | --- |
| `Media.import(uris)` | register + hash + probe | uris -> Media[] | F01,F04,F05 |
| `Analyzer.run(mediaId, opts)` | staged analysis, emits progress, cancellable, resumable | media -> `analysis.json` rows | F01 |
| `Skeleton.build(referenceId, mediaIds[])` | scenes -> slots, auto-fill best matches, leave rest empty | -> Slot[] | F01,F02 |
| `Slot.resize/move/split/merge/delete` | edit plan, snap to beats optional | slot patch -> Slot | F03 |
| `Slot.fill(slotId, mediaId, inMs)` | replace media | -> Slot | F04 |
| `Timeline.render(t)` | frame at time t for preview | -> frame | all |
| `Export.start(projectId, opts)` | encode, progress, cancel | -> file | F01,F05 |
| `Project.autosave/load` | debounced write, crash-safe | | F06 |
Background work: analysis and export run in a Worker (web) / foreground service (Android) so they survive screen-off. No webhooks, no jobs server.

Matching media to slots (the "smart" bit): score by aspect fit, duration >= slot length, and optionally motion level vs the scene's; user can always override. Simple heuristic first.

## 4. The parts that bite
- **Memory/thermal:** analyse a downscaled proxy (e.g. 160px wide, 4-8 fps) not full frames; process in chunks; cap reference length (suggest 3 min) and warn.
- **Background kill:** save `stages_done` after each stage; resume on reopen.
- **Variable frame rate / rotation metadata:** normalise timestamps; many phone clips are VFR.
- **Effect detection is fuzzy:** map to our fixed vocabulary with a confidence; low confidence -> plain cut. Never promise 100%.
- **Thai text:** no spaces between words; OCR and ASR need Thai-specific models and segmentation (PyThaiNLP-equivalent for captions line breaks). Whisper stock Thai accuracy is weak; a Thai fine-tune of base reports ~16-20% WER on benchmark sets, so allow editing every caption.
- **Web limits:** memory cap (~2-4GB per tab on phones), iOS Safari WebCodecs/WebGPU gaps, needs cross-origin isolation headers, files only persisted via OPFS; large exports may fail. Android is the quality target.
- **Copyright:** analysing a reference is fine, but the user's export must not embed the reference's media or audio unless they own it. Add a notice; default soundtrack = user choice.
- **Aspect ratio change mid-project:** slots are time-based so unaffected, but crops/transforms need re-fit.
- **Two codebases drift:** golden test clips + expected `analysis.json` tolerance in CI.

## 5. Build order
1. **Vertical slice (Android first for quality, web in parallel for reach):** import reference + 3 photos -> hard-cut scene detection only -> skeleton with empty slots -> fill -> drag resize -> export MP4. Screens S01,S02,S03,S04,S05,S06,S12. Tables: media, project, reference, scene, track, slot, export_job. No beats, no OCR yet.
2. **Auto Cut musts:** beats + snap (S09), Thai/EN speech and OCR (S11), effect detection (S10), analysis progress/resume (S04), aspect ratios, autosave drafts (S01,S13).
3. **Should:** ripple toggle, captions styling, effect editing, auto-fill smarter matching.
4. **Phase 2 manual editor:** multi-track, split/trim, speed, text, filters, transitions, keyframes (S14; tables clip).
5. **Fixes from `/replica-entrepreneur` review mining.**

## 6. Riskiest three
1. Effect/transition detection accuracy (research problem; ship cuts + zoom + fade + flash first).
2. Thai ASR/OCR quality and size on-device (model download 70-500MB; first-run download screen needed).
3. Two separate engines producing the same analysis, and smooth touch timeline on both.

## 7. Open decisions for the user
- Android minimum version / low-RAM devices (suggest API 26+, 4GB RAM recommended)?
- Model download on first run OK (Thai models are big)?
- Android first, or web first for the vertical slice? (Recommended: Android first.)
