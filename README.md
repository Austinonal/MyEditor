# MyEditor

Mobile video and thumbnail editor with Auto Cut from a reference clip (CapCut-style), written clean-room.

| folder | what |
| --- | --- |
| `editor/` | **The app** (from `Austinonal/My-storage`): React + Vite + Capacitor. Web and Android APK from one codebase. `npm ci && npm run dev`, tests with `npm test` (74). |
| `web-v1/` | Earlier, smaller web prototype (Preact). Kept for reference; superseded by `editor/`. |
| `replica/` | Recon map, architecture, design tokens, feature matrix (`features.csv`) and build log for `editor/`. `replica/web-v1/` holds the prototype's docs. |
| `.github/workflows/editor.yml` | CI: tests, build, GitHub Pages, and a debug APK (artifact `editor-apk`; a release on the default branch). |
