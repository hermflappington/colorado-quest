# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (http://localhost:5173)
npm run build     # production build to dist/
npm run preview   # preview the production build locally
```

There is no test runner and no linter configured in this project.

When deploying to GitHub Pages the build must pass the repository name as a base path:
```bash
npm run build -- --base=/colorado-quest/
```
This is handled automatically by the GitHub Actions workflow (`.github/workflows/deploy-gh-pages.yml`) on every push to `main`.

## Architecture

This is a **single-file React PWA** — virtually the entire application lives in `src/App.jsx`. There is no routing library, no state management library, and no backend.

### State & persistence

All data is kept in one `db` state object and written synchronously to `localStorage` under the key `coquest.v1` on every change:

```js
db = {
  profiles: [{ id, name, role }],   // role: 'adult' | 'kid'
  activeProfileId: string,
  entries: [Entry],
  safetyAck: boolean,               // first-run safety acknowledgement gate
}
```

An `Entry` holds: `id`, `title`, `notes`, `category`, `profileIds`, `photos` (array of base64 data URLs), `lat`, `lng`, `confidence`, `status`, `generalLocationName`, `landAccess`, `gratitude`, `createdAt`.

Photos are stored as base64 data URLs directly in `localStorage`. This can grow large quickly — there is no compression or quota guard.

### Navigation

Screen state is a plain string (`screen`). All screens are rendered inline in `App` with `{screen === 'Foo' && <section>…</section>}` conditionals. No React Router. Screens: `Home`, `New Discovery`, `Journal`, `Entry Detail`, `Edit Entry`, `Badges`, `Map`, `Profiles`, `Settings`.

### Gamification system

`gameStats(entries)` is the single source of truth for all game data. It is memoized via `useMemo`. It computes:
- **Entry points**: base 10 pts per entry + 5 per photo + 5 for gratitude + bonus for sensitive/quiet categories.
- **Badge evaluation**: each badge in the `BADGES` array has an `earned(stats)` predicate; earned badges add bonus points.
- **Level**: determined by total points against the `LEVELS` thresholds.
- **placeTalk**: a rotating reflective prompt indexed by `(entryCount + earnedBadgeCount) % PLACE_TALKS.length`.

### Sensitive categories & privacy

The `SENSITIVE` set (`Possible artifact`, `Rock art / petroglyph`, `Sacred or significant place`, `Fossil-looking object`) triggers two privacy guards:
1. On the Map, exact GPS is rounded to 2 decimal places (~1 km).
2. On Entry Detail, exact GPS is hidden behind a 2-second hold interaction that only `adult`-role profiles can trigger.

### PWA / offline

`public/sw.js` is a cache-first service worker. It caches the app shell (root HTML, manifest, icons) on install and serves all GET requests from cache with a network fallback. The service worker is registered **only in production** (`import.meta.env.PROD` check in `src/main.jsx`).

### CSS

All styles are in `src/styles.css` using flat class names (no modules, no Tailwind). The color palette uses `#1a3d2f` (dark green) as the primary brand color and `#f4f7f2` as the background.

## Key constants (all in `src/App.jsx`)

| Constant | Purpose |
|---|---|
| `STORAGE_KEY` | `'coquest.v1'` — localStorage key |
| `CATEGORIES` | Ordered list of discovery categories |
| `SENSITIVE` | Set of categories that trigger privacy guards |
| `BADGES` | Array of badge definitions with `earned(stats)` predicates |
| `LEVELS` | Array of `{name, points}` thresholds for level progression |
| `PLACE_TALKS` | Rotating reflective prompts shown on Home and New Discovery |
