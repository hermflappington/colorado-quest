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

Tests use Vitest + React Testing Library (`src/App.test.jsx`, jsdom environment, browser stubs in `src/test-setup.js`). There is no linter configured.

When deploying to GitHub Pages the build must pass the repository name as a base path:
```bash
npm run build -- --base=/colorado-quest/
```
This is handled automatically by the GitHub Actions workflow (`.github/workflows/deploy-gh-pages.yml`) on every push to `main`.

## Architecture

This is a **two-file React PWA** with no routing library, no state management library, and no backend:
- `src/game.js` — all pure game logic and constants (categories, badges, levels, points, stats). No React, no DOM, no storage. This is what the unit tests import.
- `src/App.jsx` — the entire UI, state, persistence, and photo handling.

### State & persistence

All data is kept in one `db` state object persisted to `localStorage` under the key `coquest.v1`:

```js
db = {
  profiles: [{ id, name, role }],   // role: 'adult' | 'kid'
  activeProfileId: string,
  entries: [Entry],
  safetyAck: boolean,               // first-run safety acknowledgement gate
  activeAdventure: null | { id, categories: [5 category names], found: [category names], createdAt },
}
```

Writes are debounced 300ms and flushed synchronously on `beforeunload`/`pagehide`/`visibilitychange` (the mobile-backgrounding case). A `QuotaExceededError` sets a visible storage-full warning banner instead of failing silently. `load()` and backup import both run `sanitizeDb`, which repairs a dangling `activeProfileId`, normalizes entries missing array fields, and nulls out a corrupt or stale `activeAdventure`.

An `Entry` holds: `id`, `title`, `notes`, `category`, `profileIds`, `photos` (array of base64 data URLs), `lat`, `lng`, `confidence`, `status`, `generalLocationName`, `landAccess`, `gratitude`, `createdAt`.

Photos are re-encoded through a canvas before storage (`processPhoto`): this strips EXIF metadata — including GPS, which would otherwise bypass the privacy guards — resizes to max 1200px, and compresses to JPEG 0.8. Undecodable files (e.g. HEIC on non-Safari browsers) resolve to null and surface an alert rather than hanging.

### Navigation

Screen state is a plain string (`screen`). All screens are rendered inline in `App` with `{screen === 'Foo' && <section>…</section>}` conditionals. No React Router. Screens: `Home`, `New Discovery`, `Journal`, `Entry Detail`, `Edit Entry`, `Badges`, `Map`, `Profiles`, `Settings`. The selected journal entry is stored as an id (`selectedId`) and derived from `db.entries` — do not duplicate entry objects into separate state.

### Gamification system

`gameStats(entries)` (in `game.js`) is the single source of truth for all game data, memoized in App via `useMemo`. It computes:
- **Entry points**: base 10 pts per entry + 5 per photo + 5 for gratitude + bonus for sensitive/quiet categories.
- **Badge evaluation**: each badge in the `BADGES` array has an `earned(stats)` predicate; earned badges add bonus points.
- **Level**: determined by total points against the `LEVELS` thresholds.
- **placeTalk**: a rotating reflective prompt indexed by `(entryCount + earnedBadgeCount) % PLACE_TALKS.length`.

The **adventure mode** ("Find These 5 Things") lives on Home: `pickAdventureCategories()` Fisher-Yates-shuffles `CATEGORIES` and takes 5. Items are checked off instantly via "Found it!" or automatically when a matching entry is logged.

### Sensitive categories & privacy

The `SENSITIVE` set (`Possible artifact`, `Rock art / petroglyph`, `Sacred or significant place`, `Fossil-looking object`) triggers three privacy guards:
1. Photo EXIF (including embedded GPS) is stripped from **all** photos at intake via canvas re-encode.
2. On the Map, exact GPS is rounded to 2 decimal places (~1 km).
3. On Entry Detail, exact GPS is hidden behind a 2-second hold interaction (mouse, touch, or Space/Enter) that only `adult`-role profiles can trigger. The hold guard must ignore keyboard auto-repeat (`e.repeat` / an already-running timer) — orphaned timers would reveal GPS after a short tap. Reveal state clears when leaving Entry Detail.

### PWA / offline

`public/sw.js` is a cache-first service worker. It caches the app shell (root HTML, manifest, icons) on install and serves all GET requests from cache with a network fallback. The service worker is registered **only in production** (`import.meta.env.PROD` check in `src/main.jsx`). Bump `CACHE_NAME` when cached-asset behavior changes.

### CSS

All styles are in `src/styles.css` using flat class names (no modules, no Tailwind). The color palette uses `#1a3d2f` (dark green) as the primary brand color and `#f4f7f2` as the background. Keyboard focus uses `:focus-visible` outlines; the active nav button is styled via `aria-current="page"`.

## Key constants (all in `src/game.js`)

| Constant | Purpose |
|---|---|
| `CATEGORIES` | Ordered list of discovery categories |
| `SENSITIVE` | Set of categories that trigger privacy guards |
| `BADGES` | Array of badge definitions with `earned(stats)` predicates |
| `LEVELS` | Array of `{name, points}` thresholds for level progression |
| `PLACE_TALKS` | Rotating reflective prompts shown on Home and New Discovery |

`STORAGE_KEY` (`'coquest.v1'`) remains in `src/App.jsx` alongside the persistence code.

## Known limits

- localStorage is the ceiling (~5–10 MB). Photo compression keeps entries small (~10× smaller than raw), and the storage-full banner warns the user, but a heavily-photographed journal will eventually need IndexedDB.
- `npm audit` shows moderate/high items in the esbuild/vite dev-server chain; they do not affect the deployed static build. Clearing them requires a breaking Vite major upgrade.
