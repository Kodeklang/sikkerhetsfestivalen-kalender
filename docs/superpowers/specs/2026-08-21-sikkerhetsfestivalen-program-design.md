# Sikkerhetsfestivalen 2026 — program­kalender

Design doc. 2026-08-21.

## Purpose

A standalone, installable program calendar for Sikkerhetsfestivalen 2026
(24–26 August, Lillehammer), hosted on GitHub Pages. It renders the official
programme as a day grid — rooms across, time down — plus a detail page per
session. The schedule refreshes itself without anyone touching the repo.

The site ships as plain semantic HTML, CSS and vanilla JS. Eleventy is a
build-time tool only; no framework reaches the browser.

## Source data

The official programme lives in Sessionize, embed id `ecvivmck`. It is not
exposed as JSON, but the embed views return static HTML with
`Access-Control-Allow-Origin: *`:

| View | URL suffix | Gives us |
|---|---|---|
| `GridSmart` | `/view/GridSmart?under=True` | grid placement, rooms, service sessions |
| `Sessions` | `/view/Sessions?under=True` | descriptions, language, level |
| `Speakers` | `/view/Speakers?under=True` | photo, tagline, bio |

Shape as of 2026-08-21: 176 sessions (159 talks + 17 service), 20 rooms,
20 tracks, 199 speakers, 3 days. Times are ISO-8601 UTC in `data-sztz`
attributes; the festival runs in Europe/Oslo (CEST, UTC+2).

Category groups available: `main_tag` (20 tracks), `language` (Norwegian,
English), `level` (High-level, Detailed, Deep-dive). There is no audience
category — see "Passer for" below.

## Architecture

```
eleventy.config.mjs
scripts/fetch-program.mjs          scraper, CI + local
src/
  _data/program.json               generated, committed to main
  _data/site.js                    derived view models
  _includes/*.njk                  layout, grid, cards
  index.njk                        redirects to the right day
  dag.njk                          one page per day
  program.njk                      one page per session
  css/ js/ img/speakers/
  sw.js  manifest.webmanifest
.github/workflows/update-and-deploy.yml
```

### Rendering: one path, at build time

Both the grid and the detail pages are rendered by Nunjucks at build time.
The client never re-renders them. This is the central constraint: rendering
the grid a second time in JS would mean maintaining the same layout logic
twice.

Consequences:

- The site works with JavaScript disabled.
- It is indexable and deep-linkable.
- Updating the programme is a *page reload*, not a re-render.

### The grid

One CSS Grid per day. Columns are named lines per room (`track-74823`), rows
are named lines per five-minute step (`time-0940`). A session is placed with
`grid-column: track-74823; grid-row: time-1130 / time-1150`. This is the
technique Sessionize itself uses. Sticky room headers and a sticky time
gutter come free; no JS computes any pixel value.

Markup is honest rather than ARIA-decorated: room headers are `<h2>`, each
session is an `<article>` with `<h3>` and `<time datetime>`, and the time
gutter is `aria-hidden` because every session states its own time. The DOM
order is chronological, so linear screen-reader reading makes sense.

The 17 service sessions (registration, lunch, breaks, dinners) all sit in a
single "Info" pseudo-room and are festival-wide. They render as full-width
bands, matching the design.

Per-day time windows are computed from the data, not hardcoded. The real days
are far longer than the design mock assumed:

| Day | Window (CEST) |
|---|---|
| Mon 24 Aug | 09:00 – 00:05 (after party) |
| Tue 25 Aug | 09:40 – 24:00 (festival dinner) |
| Wed 26 Aug | 09:40 – 13:00 |

### Session detail

One page per session at `/program/<slug>-<id>/`, generated with
`pagination: { data: program.sessions, size: 1 }`.

Deviations from the design mock, forced by real data:

1. **Multiple speakers.** The mock shows one speaker card; real sessions have
   several. The section repeats and the heading pluralises.
2. **20 tracks, not 5.** All five track names in the mock are real, so their
   exact colours are kept and the palette is extended to the other 15.
3. **"Passer for" has no data source.** No audience category exists and the
   per-session questions field is empty for all 159 sessions. The section
   renders conditionally, so it stays hidden now and appears automatically if
   the organisers add such a category later.

"Samtidig i programmet" is computed at build time: sessions overlapping this
one, same day, excluding itself and service sessions.

The back pill is a real `<a href="/dag/2/#session-1088221">` so it works
without JS; JS upgrades it to `history.back()` when the user came from the
grid, which preserves scroll position.

### Time-dependent things are client-side, always

The red now-line, the auto-scroll to it, "which day is today", and the detail
page countdown (`72t 51 min til start` / `pågår nå` / finished) are computed
in the browser at runtime. None of them may be baked into HTML — see
determinism below.

### Language

A NO/EN toggle swaps interface chrome only. Session titles and descriptions
stay as authored, which is a mix of both. The choice persists in
`localStorage` and defaults to Norwegian.

### PWA

`manifest.webmanifest` (standalone, `theme_color: #e8850f`) plus a service
worker that precaches the app shell under a versioned cache name. Speaker
photos are downloaded into the repo at build time, so the site makes no
third-party requests and works fully offline.

## Update and deploy

A single workflow, `update-and-deploy.yml`, on an hourly schedule, on push to
`main`, and on manual dispatch:

1. Checkout `main`, `npm ci`.
2. `node scripts/fetch-program.mjs` → writes `src/_data/program.json` and any
   new speaker photos.
3. Commit to `main` **only if changed**, with `[skip ci]`. This keeps a
   readable history of programme changes and lets a fresh clone run
   `npm start` immediately.
4. `npx @11ty/eleventy` → `_site`, plus `.nojekyll`.
5. Publish through a git worktree on `gh-pages`: sync `_site` in, then
   `git diff --staged --quiet || (commit && push)`.

No third-party actions; plain `git` with the built-in `GITHUB_TOKEN` and
`permissions: contents: write`. Pages serves from `gh-pages` at root.
`GITHUB_TOKEN` pushes do not retrigger workflows, so there is no loop.

### Caching, and why the build must be deterministic

Committing built output means git itself is the change detector: if the bytes
are identical, there is no commit, no deploy, and every ETag on `gh-pages`
stays valid. The browser then caches until content genuinely changes.

That only holds if an unchanged programme produces byte-identical output. So:

- The scraper sorts everything deterministically and writes stable JSON.
- `version.json` contains a **content hash only**. A build timestamp anywhere
  in the output would produce a diff every hour and defeat the whole scheme.
- Anything time-dependent is client-side, as above.

The running app polls `version.json` with `cache: 'no-cache'`, getting a 304
with no body until something changes. When the hash differs from the one baked
into the page, a dismissible notice offers a reload. The service worker makes
that reload instant.

## Out of scope

Favourites and free-text search.

The track chips began as a display-only legend, as in the design. They were
made clickable shortly after: selecting a track leaves its sessions in colour
and greys the rest down. That also forced the legend to be scoped per day —
listing all twenty tracks on a day that runs three would have let you grey out
the entire grid with nothing to explain why.

Later still, the chips became multi-select and the greying became real hiding:
any number of tracks can be picked, and everything outside the selection leaves
the grid. See "Track filter" in the README for the behaviour as it now stands.

## Risks

- **The scraper parses HTML.** Sessionize could change its markup. The scraper
  validates what it extracts and fails loudly rather than committing an empty
  or truncated programme.
- **Repo growth.** Built output and speaker photos live in git. Negligible at
  this size; the payoff is a diffable deploy.
