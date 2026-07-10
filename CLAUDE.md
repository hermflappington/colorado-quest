# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # start dev server (http://localhost:5173)
npm run build          # production build to dist/
npm run preview        # preview the production build locally
npm test               # run the Vitest suite once
npm run test:watch     # rerun tests on save
npm run test:coverage  # coverage report
```

Tests use Vitest + React Testing Library (`src/App.test.jsx`, jsdom environment, browser stubs in `src/test-setup.js`, fresh `fake-indexeddb` per test). There is no linter configured.

When deploying to GitHub Pages the build must pass the repository name as a base path:
```bash
npm run build -- --base=/colorado-quest/
```
This is handled automatically by the GitHub Actions workflow (`.github/workflows/deploy-gh-pages.yml`) on every push to `main`.

## Architecture

A small React PWA with no routing library, no state management library, and no backend:
- `src/game.js` — pure game logic and constants (categories, badges, levels, points, stats, entry normalization). No React, no DOM, no storage. This is what the unit tests import.
- `src/storage.js` — IndexedDB persistence (`loadState`/`saveState`/`clearState`), legacy localStorage migration, and `navigator.storage.persist()`.
- `src/fieldGuide.js` — offline learning-card content per category (kid-level, Northwest Colorado flavored).
- `src/App.jsx` — the entire UI, state, and photo/audio handling.

### State & persistence

All data is kept in one `db` state object persisted to **IndexedDB** (database `coquest`, single record):

```js
db = {
  profiles: [{ id, name, role }],   // role: 'adult' | 'kid'
  activeProfileId: string,
  entries: [Entry],
  safetyAck: boolean,               // first-run safety acknowledgement gate
  activeAdventure: null | { id, name, items: [string], found: [string], createdAt, questId? },
  savedQuests: [{ id, name, items: [string], createdAt }],
  lastBackupAt: number | null,
}
```

Loading is async (`loadInitial`): the app renders a loading state until IndexedDB responds. Data found only under the legacy localStorage key `coquest.v1` is migrated into IndexedDB on first load and the localStorage copy is left as a safety net. Writes are debounced 300ms and flushed on `beforeunload`/`pagehide`/`visibilitychange`; a failed save sets a visible warning banner. A backup nudge appears on Home after 3+ entries with no export in 30 days; `exportBackup` stamps `lastBackupAt`. `sanitizeDb` runs on load and import: repairs a dangling `activeProfileId`, normalizes entries, filters invalid quests, converts legacy adventures (`categories` → `items`), and drops found items no longer in the list.

An `Entry` holds: `id`, `title`, `notes`, `category`, `profileIds`, `photos` (base64 data URLs), `audioNotes` (base64 audio data URLs from MediaRecorder), `lat`, `lng`, `confidence`, `status`, `generalLocationName`, `landAccess`, `gratitude`, `createdAt`.

Photos are re-encoded through a canvas before storage (`processPhoto`): strips EXIF metadata — including GPS, which would otherwise bypass the privacy guards — resizes to max 1200px, compresses to JPEG 0.8. Undecodable files (e.g. HEIC on non-Safari browsers) resolve to null and surface an alert rather than hanging. Voice notes record via MediaRecorder (UI hidden when unsupported).

### Navigation

Screen state is a plain string (`screen`). All screens render inline in `App` with `{screen === 'Foo' && <section>…</section>}` conditionals. No React Router. Screens: `Home`, `New Discovery`, `Journal`, `Entry Detail`, `Edit Entry`, `Badges`, `Map`, `Yearbook`, `Profiles`, `Settings`. The selected journal entry is stored as an id (`selectedId`) and derived from `db.entries` — do not duplicate entry objects into separate state.

### Gamification system

`gameStats(entries)` (in `game.js`) is the single source of truth for all game data, memoized in App via `useMemo`. It computes entry points (base 10 + 5/photo + 5 gratitude + sensitive/quiet bonuses), badge evaluation (`BADGES[].earned(stats)` predicates with bonus points), level from `LEVELS` thresholds, and the rotating `placeTalk` prompt.

**Adventures & quests** live on Home. `activeAdventure.items` are free-text strings: the random adventure uses `pickAdventureCategories()` (Fisher-Yates, 5 categories); saved quests are adult-authored named lists (2–10 items). Items check off via "Found it!" or automatically when a logged entry's category matches an item. Only `adult` profiles see quest create/delete.

### Field guide

`FieldGuideCard` renders a collapsible learn card (facts / how-to-be-respectful / wonder question) on New Discovery (follows the selected category) and Entry Detail. Content lives in `src/fieldGuide.js` keyed by exact category name — keep keys in sync with `CATEGORIES`.

### Yearbook

The Yearbook screen renders a print-oriented view (cover page + chronological entries) filtered by year, exported via `window.print()` → Save as PDF. `@media print` rules in `styles.css` hide the header and `.no-print` controls and set page breaks. Sensitive-category entries print "Exact location kept private" instead of GPS.

### Sensitive categories & privacy

The `SENSITIVE` set (`Possible artifact`, `Rock art / petroglyph`, `Sacred or significant place`, `Fossil-looking object`) triggers privacy guards:
1. Photo EXIF (including embedded GPS) is stripped from **all** photos at intake via canvas re-encode.
2. On the Map, exact GPS is rounded to 2 decimal places (~1 km).
3. On Entry Detail, exact GPS hides behind a 2-second hold (mouse, touch, or Space/Enter) that only `adult` profiles can trigger. The hold guard must ignore keyboard auto-repeat (`e.repeat` / an already-running timer) — orphaned timers would reveal GPS after a short tap. Reveal state clears when leaving Entry Detail.
4. The Yearbook never prints exact GPS for sensitive entries.

### PWA / offline

`public/sw.js` is a cache-first service worker for the app shell. Registered only in production (`import.meta.env.PROD` in `src/main.jsx`). Bump `CACHE_NAME` when cached-asset behavior changes.

### CSS

All styles in `src/styles.css`, flat class names. Brand color `#1a3d2f` on `#f4f7f2`. Keyboard focus via `:focus-visible`; active nav via `aria-current="page"`; print rules under `@media print`.

## Key constants

| Constant | Where | Purpose |
|---|---|---|
| `CATEGORIES`, `SENSITIVE`, `BADGES`, `LEVELS`, `PLACE_TALKS` | `game.js` | Game content and privacy set |
| `FIELD_GUIDE` | `fieldGuide.js` | Learn-card content keyed by category |
| `LEGACY_STORAGE_KEY` (`'coquest.v1'`) | `storage.js` | Old localStorage key, read-only for migration |
| `BACKUP_NUDGE_MS` | `App.jsx` | Backup reminder interval (30 days) |

## Known limits

- Everything (including base64 photos/audio) lives in one IndexedDB record serialized per save; fine at family scale, revisit if entries grow into the thousands.
- Voice notes don't print in the Yearbook (noted as "N voice notes recorded").
- `npm audit` shows moderate/high items in the esbuild/vite dev-server chain; they do not affect the deployed static build. Clearing them requires a breaking Vite major upgrade.
