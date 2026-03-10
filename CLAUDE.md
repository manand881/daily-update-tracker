# Daily Update Tracker — Claude Instructions

## Tech Stack
- Electron (desktop app framework)
- better-sqlite3 (local SQLite database)
- Vanilla HTML / CSS / JavaScript — **no frameworks, no bundlers, no preprocessors**

## Key Files
- `main.js` — Electron main process, IPC handlers, window setup
- `preload.js` — context bridge between main and renderer
- `db/database.js` — SQLite schema and query functions
- `renderer/index.html` — app UI
- `renderer/styles.css` — all styles
- `renderer/renderer.js` — all renderer-side logic
- `sync/index.js` — UDP syncing
- `electron-builder.yml` — build targets (macOS DMG arm64, Linux DEB x64)

## Commands
- `npm start` — run the app
- `npm run dev` — run with auto-restart (electronmon)
- `npm run rebuild` — rebuild native modules for Electron (run after npm install)
- `npm run dist:mac` — build macOS DMG (Apple Silicon)
- `npm run dist:linux` — build Linux DEB (x64)

## Conventions
- Do not introduce frontend frameworks (React, Vue, etc.), CSS preprocessors, or bundlers
- Keep all renderer logic in `renderer/renderer.js` — no separate modules
- IPC handlers live in `main.js`; expose them via `preload.js`
- After any `npm install`, run `npm run rebuild` to rebuild better-sqlite3 for Electron

## Releases
- Tags follow the format `vX.Y-<brainrot-character-name>` (e.g. `v0.1-bombardilo-crocodilo`)
- Pushing a tag triggers the CI build and publishes `.dmg` and `.deb` to GitHub Releases
- Never push to main directly. create a branch commit, push, raise pr, merge.

## Color Scheme
| Name | Hex | Usage |
|---|---|---|
| Prussian Blue | `#102542` | Primary background |
| Vibrant Coral | `#f87060` | Primary actions, focus rings, CTAs |
| Warm Amber | `#d99152` | Field labels, required indicators, active toolbar state |
| Alabaster Grey | `#cdd7d6` | Body text, card content |
| Khaki Beige | `#b3a394` | Secondary text, icons, labels |
| White | `#ffffff` | Headings, input text |
