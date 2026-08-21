# Sikkerhetsfestivalen 2026 — programkalender

A standalone, installable programme calendar for
[Sikkerhetsfestivalen 2026](https://www.sikkerhetsfestivalen.no/program)
(Lillehammer, 24–26 August). Rooms across, time down, one page per session.

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

Because the built output is committed, git itself is the change detector. If the
bytes are identical there is no commit, no deploy, and every ETag on `gh-pages`
stays valid — so browsers keep their cached copy until the programme genuinely
changes.

**That makes build determinism load-bearing.** Nothing time-dependent may end up
in the output, or an hourly run would produce a diff every hour and defeat the
caching. So the red now-line, the "which day is today" redirect and the session
countdown are all computed in the browser, and `version.json` carries a content
hash rather than a build timestamp.

The running app polls `version.json` (a 304 with no body until something
changes) and offers a reload when the hash differs from the one it was built
with. The service worker makes that reload instant and the site usable offline.

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
