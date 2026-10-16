# Build log

Web first (Vite + Preact + TypeScript, `web/`). Android later. Clean room: all code and copy written here.

| ID | screen | status | missing / notes |
| --- | --- | --- | --- |
| S01 | Home (tool launcher) | done | thumbnail tool is a "coming soon" tile; nav bar has 2 items |
| S03 | Pick reference | done | only video files, warns above 3 min |
| S04 | Analysis progress | partial | shot detection and beat tracking run; effects, text, speech are later phases |
| S05 | Skeleton review | done | auto-fill is in order, no smart matching |
| S06 | Timeline editor | partial | resize (drag + keyboard), split, delete, undo, zoom, aspect select. No reorder, merge, effects, text, audio |
| S07/S08 | Slot detail / resize | done | folded into S06 panel |
| S12 | Export | partial | real-time capture with the reference soundtrack, WebM in Chromium, no duration header in the file |
| S02 | Media picker | partial | system file picker + a sheet of imported media |
| S09 | Audio | partial | reference soundtrack on/off, beat ticks, align-to-beats; no volume slider |
| S10/S11 | Effects and text | partial | In/Out/Combo animations, 7 transitions, 8 filters, text per slot, speed. No keyframes, stickers, extra tracks |
| S13, S14 | settings, manual tools | not started | |

## Harder than it looked
- Seeking a `<video>` and reading pixels: `seeked` alone can still show the previous frame, so `seek()` waits for the next presented frame. Found by testing in real Chromium, not by unit tests.
- Flat colours drifting across a histogram bin edge looked like cuts; fixed with soft binning.
- MediaRecorder output has no duration metadata (shows N/A in ffprobe). Many players cope; the proper fix is WebCodecs + muxer.

- A seek during preview was overwritten by the play loop (found by the e2e test). `Player.seek` now stops playback first.
- Beat tracker first returned beats 250 ms late (a shifted moving average); the click-track unit tests caught it.
- Effects dock made the editor too tall on a phone; the preview shrank to a strip. Panel now scrolls inside 38% of the screen and the preview is sized with container units.

## Checks
- `cd web && npm test`: 22 unit tests (cut detection, beat tracking at 100/120/140 BPM, animations, align-to-beats, timeline ops, skeleton).
- `cd web && npm run build && node e2e/flow.mjs`: full flow in Chromium (reference -> 4 empty slots -> 1 photo -> editor -> drag/keyboard resize -> undo -> beats 120 BPM -> align to beats -> In/Out/Combo/transition/filter/text -> export with audio -> autosave). Screenshots in `replica/clone-screens/`.
