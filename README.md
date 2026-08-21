# Sikkerhetsfestivalen 2026 — programkalender

A standalone, installable programme calendar for
[Sikkerhetsfestivalen 2026](https://www.sikkerhetsfestivalen.no/program)
(Lillehammer, 24–26 August). Rooms across, time down, one page per session.

There is no day picker to get past: the root serves the first day's grid, and
the other days sit at `/dag/2/` and `/dag/3/`, one tap away in the header.

The published site is plain semantic HTML, CSS and vanilla JavaScript. Eleventy
is a build-time tool only — no framework, and no third-party requests at
runtime: fonts and speaker photos are served from this origin.

## Running it

```sh
npm install
npm run fetch     # pull the current programme from Sessionize
npm start         # http://localhost:8080
```

`npm run build` writes the site to `_site/`.

## How the data gets here

The programme lives in Sessionize (embed id `ecvivmck`), which exposes no JSON
API for this event. `scripts/fetch-program.mjs` parses three embed views —
`GridSmart` for placement and service sessions, `Sessions` for descriptions and
language/level, `Speakers` for photos and bios — and merges them into
`src/_data/program.json`, downloading any new speaker photos alongside.

The scraper sorts everything and writes stable JSON, so an unchanged programme
produces a byte-identical file. It refuses to write a suspiciously small result
rather than publishing an empty programme.

## How it deploys

`.github/workflows/update-and-deploy.yml` runs hourly, on every push to `main`,
and on demand:

1. scrape → `src/_data/program.json`, committed to `main` only if it changed
2. build with Eleventy
3. publish `_site` to the `gh-pages` branch, committed only if it changed

The site is published at <https://sikkerhetsfestivalen.kodeklang.dev>. Its
`CNAME` file lives in `src/root/` rather than being left where GitHub's custom
domain setting writes it, because step 3 replaces the `gh-pages` tree wholesale
— a file only GitHub put there would be gone on the next hourly run.

Because the built output is committed, git itself is the change detector. If the
bytes are identical there is no commit, no deploy, and every ETag on `gh-pages`
stays valid — so browsers keep their cached copy until the programme genuinely
changes.

**That makes build determinism load-bearing.** Nothing time-dependent may end up
in the output, or an hourly run would produce a diff every hour and defeat the
caching. So the red now-line and the session countdown are both computed in the
browser, and `version.json` carries a content hash rather than a build
timestamp.

The running app polls `version.json` (a 304 with no body until something
changes) and offers a reload when the hash differs from the one it was built
with. The service worker makes that reload instant and the site usable offline.

Because the worker serves CSS and JS cache-first, a visitor arriving right after
a deploy would otherwise run the previous bundle for that whole visit — the new
worker only takes over in the background. So the page reloads itself once when a
new worker claims it, and `sw.js` is registered with `updateViaCache: "none"` so
a deploy is noticed on the next visit rather than up to ten minutes later.

## Track filter

Each day lists only the tracks actually running that day, as chips above the
grid. The chips are independent toggles — pick any number of them, and the grid
narrows to exactly that selection:

- rooms the selection does not reach collapse away entirely
- every session outside the selection is removed from the layout

This is a filter, not a de-emphasis: a hidden session leaves the accessibility
tree along with the layout, so `#filter-status` announces what survived —
"Viser 2 spor: 8 foredrag i 2 rom". A leading "Alle spor" chip clears the whole
selection, which beats unpicking twenty chips by hand.

Which columns a track occupies is worked out at build time, per day, by walking
that day's schedule — a track may run in several rooms, and a room may host more
than one track, so nothing is assumed. Each chip carries its own column list in
`data-cols`, and the mapping is rebuilt whenever the programme is scraped.
Several chips keep the union of their columns.

In the current programme most tracks own a room for the whole day, so a single
pick usually leaves one column — on a phone that removes horizontal scrolling
altogether and turns the grid into a readable single-track agenda. Monday shows
the other case: Keynote and Application Security share a room, so selecting
Keynote keeps that column but hides the Application Security card sitting in it.
Sessions belonging to no track at all — the two Podcast O3C slots on Tuesday —
are hidden by any selection, since no chip claims them.

Columns collapse by being set to `0px` rather than renumbered, so no session
has to be repositioned. Clearing the selection removes the override and the
stylesheet's own `grid-template-columns` takes over again, which is also what
a visitor without JavaScript gets.

The selection persists in `localStorage` under `sf-tracks`, as a list of slugs,
and spans days. A day applies only the tracks it actually runs but keeps the
rest stored, so stepping to a day without them and back does not quietly drop
them. An older single-track `sf-track` value migrates once and is then removed.

## One-off tooling

Neither of these runs in CI; their output is committed.

```sh
node scripts/fetch-fonts.mjs   # re-vendor the webfonts
python3 scripts/make-icons.py  # redraw the app icon
```

## Notes on the design

Built from the Claude Design project *Conference Day View* and *Session Detail*.
Real data forced four deviations, all deliberate:

- **20 rooms and 20 tracks**, not the mock's 9 and 5. The five track colours the
  mock names are kept exactly; the rest extend the palette.
- **Multiple speakers per session.** The mock shows one card; the section repeats
  and its heading pluralises.
- **Bands sit under session blocks.** Real talks run straight through lunch
  (the CTF, for one), so an opaque full-width band would hide them.
- **"Passer for" is hidden.** Sessionize exposes no audience category for this
  event. The section renders itself as soon as one appears.

Day windows come from the data rather than the mock's assumed 08–19; the real
days run to 00:05 and 24:00.
