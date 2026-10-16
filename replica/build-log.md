# Build log

Web first (Vite + Preact + TypeScript, `web/`). Android later. Clean room: all code and copy written here.

| ID | screen | status | missing / notes |
| --- | --- | --- | --- |
| S01 | Home (tool launcher) | done | thumbnail tool is a "coming soon" tile; nav bar has 2 items |
| S03 | Pick reference | done | only video files, warns above 3 min |
| S04 | Analysis progress | partial | only shot detection runs; beats, effects, text, speech are later phases |
| S05 | Skeleton review | done | auto-fill is in order, no smart matching |
| S06 | Timeline editor | partial | resize (drag + keyboard), split, delete, undo, zoom, aspect select. No reorder, merge, effects, text, audio |
| S07/S08 | Slot detail / resize | done | folded into S06 panel |
| S12 | Export | partial | real-time capture, WebM in Chromium, no audio, no duration header in the file |
| S02 | Media picker | partial | system file picker + a sheet of imported media |
| S09-S11, S13, S14 | audio, effects, text, settings, manual tools | not started | |

## Harder than it looked
- Seeking a `<video>` and reading pixels: `seeked` alone can still show the previous frame, so `seek()` waits for the next presented frame. Found by testing in real Chromium, not by unit tests.
- Flat colours drifting across a histogram bin edge looked like cuts; fixed with soft binning.
- MediaRecorder output has no duration metadata (shows N/A in ffprobe). Many players cope; the proper fix is WebCodecs + muxer.

## Checks
- `cd web && npm test`: 12 unit tests (cut detection, timeline ops, skeleton).
- `cd web && npm run build && node e2e/flow.mjs`: full flow in Chromium (reference -> 4 empty slots -> 1 photo -> editor -> drag/keyboard resize -> undo -> export -> autosave). Screenshots in `replica/clone-screens/`.
