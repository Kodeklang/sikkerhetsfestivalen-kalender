#!/usr/bin/env node
// Scrapes the Sikkerhetsfestivalen programme out of the Sessionize embed views
// and writes it to src/_data/program.json, downloading speaker photos on the way.
//
// Sessionize exposes no JSON API for this event, but the embed views return
// static HTML with Access-Control-Allow-Origin: *. We parse three of them:
//
//   GridSmart  day tabs, room columns, placement, service sessions
//   Sessions   descriptions, language, level
//   Speakers   photo, tagline, bio
//
// The output must be byte-stable for an unchanged programme: the deploy
// pipeline uses "did the bytes change?" as its change detector, so every
// collection is sorted and nothing time-dependent is ever written.

import { writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const EMBED_ID = "ecvivmck";
const BASE = `https://sessionize.com/api/v2/${EMBED_ID}/view`;
const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_FILE = path.join(ROOT, "src/_data/program.json");
const PHOTO_DIR = path.join(ROOT, "src/img/speakers");

// ---------------------------------------------------------------- html utils

// Sessionize only ever emits &amp; in these fields, but decode the common set
// so a future change in their escaping does not show up as literal entities.
const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  aring: "å", Aring: "Å", oslash: "ø", Oslash: "Ø", aelig: "æ", AElig: "Æ",
  hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘",
  ldquo: "“", rdquo: "”",
};

function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return body in ENTITIES ? ENTITIES[body] : whole;
  });
}

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;");

/** Collapse whitespace and decode entities. For attribute-ish plain text. */
const text = (s) => decodeEntities(s.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

/**
 * Turn a Sessionize rich-text field into an array of paragraph HTML strings.
 * Only <br> (as a paragraph break) and <a href> survive; everything else is
 * dropped and all text is re-escaped, so the output is safe to render with
 * Nunjucks' `| safe`.
 */
function richText(raw) {
  if (!raw) return [];
  return raw
    .split(/(?:<br\s*\/?>\s*)+/i)
    .map((chunk) => {
      let out = "";
      let open = 0;
      const token = /<a\b[^>]*href="([^"]*)"[^>]*>|<\/a\s*>|<[^>]*>/gi;
      let last = 0;
      let m;
      while ((m = token.exec(chunk))) {
        out += escapeHtml(decodeEntities(chunk.slice(last, m.index)));
        last = token.lastIndex;
        if (m[0].toLowerCase().startsWith("</a")) {
          if (open > 0) { out += "</a>"; open--; }
        } else if (m[1] !== undefined) {
          const href = decodeEntities(m[1]);
          if (/^https?:\/\//i.test(href)) {
            out += `<a href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank">`;
            open++;
          }
        }
        // any other tag is dropped
      }
      out += escapeHtml(decodeEntities(chunk.slice(last)));
      while (open-- > 0) out += "</a>";
      return out.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
}

/**
 * Return the outer HTML of the element starting at `start`, matching nesting.
 * Safe here because Sessionize never puts ">" inside an attribute value.
 */
function outerHtml(html, start, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*?(/?)>|</${tag}\\s*>`, "gi");
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith("</")) {
      if (--depth === 0) return html.slice(start, re.lastIndex);
    } else if (m[1] !== "/") {
      depth++;
    }
  }
  return null;
}

/** Yield the outer HTML of every element matching `openRe` (must be global). */
function* eachElement(html, openRe, tag) {
  openRe.lastIndex = 0;
  let m;
  while ((m = openRe.exec(html))) {
    const outer = outerHtml(html, m.index, tag);
    if (outer) {
      yield { outer, match: m };
      openRe.lastIndex = m.index + outer.length;
    }
  }
}

/** Sessionize emits 7 fractional-second digits, which Safari's Date parser
 *  rejects. Normalise to plain ISO so the browser can parse it. */
const iso = (s) => new Date(s).toISOString();

const slugify = (s) =>
  decodeEntities(s).toLowerCase()
    .replace(/[æ]/g, "ae").replace(/[ø]/g, "o").replace(/[å]/g, "a")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "sesjon";

// ------------------------------------------------------------------ fetching

async function fetchView(name) {
  const url = `${BASE}/${name}?under=True`;
  const res = await fetch(url, { headers: { "user-agent": "sikkerhetsfestivalen-kalender" } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const body = await res.text();
  if (body.length < 10_000 || body.includes("404 @ Sessionize.com")) {
    throw new Error(`${name}: unexpected response (${body.length} bytes)`);
  }
  return body;
}

// ------------------------------------------------------------------- parsing

/** Tags on a session, grouped by Sessionize category name. */
function parseTags(block) {
  const tags = {};
  const re = /<li class="sz-tag[^"]*"([^>]*)>([^<]*)<\/li>/gi;
  let m;
  while ((m = re.exec(block))) {
    const attrs = m[1];
    const group = /data-categoryname="([^"]*)"/.exec(attrs)?.[1];
    const id = /data-tagid="(\d+)"/.exec(attrs)?.[1];
    if (!group) continue;
    (tags[group] ??= []).push({ id, name: text(m[2]) });
  }
  return tags;
}

function parseSpeakerRefs(block) {
  const ul = /<ul class="sz-session__speakers">([\s\S]*?)<\/ul>/i.exec(block);
  if (!ul) return [];
  return [...ul[1].matchAll(/data-speakerid="([^"]+)"/g)].map((m) => m[1]);
}

function parseGrid(html) {
  const days = [];
  const sessions = [];

  const tabRe = /<a class="sz-tabs__link" href="#sz-tab-(\d+)" data-sztz="DayLong\|[^|]+\|([^|]+)\|([^"]+)">([^<]*)</g;
  for (const m of html.matchAll(tabRe)) {
    days.push({ id: m[1], startUtc: iso(m[2]), endUtc: iso(m[3]), weekday: text(m[4]), rooms: [] });
  }
  if (!days.length) throw new Error("GridSmart: no day tabs found");

  for (const day of days) {
    const start = html.indexOf(`<div class="sz-cssgrid sz-cssgrid--${day.id}"`);
    if (start < 0) throw new Error(`GridSmart: no grid for day ${day.id}`);
    const grid = outerHtml(html, start, "div");
    if (!grid) throw new Error(`GridSmart: unterminated grid for day ${day.id}`);

    // Room columns, in the order Sessionize lays them out.
    const roomRe = /<span class="[^"]*\bsz-room--(\d+)"[^>]*>([^<]*)<\/span>/g;
    for (const m of grid.matchAll(roomRe)) {
      day.rooms.push({ id: m[1], name: text(m[2]) });
    }
    if (!day.rooms.length) throw new Error(`GridSmart: no rooms for day ${day.id}`);

    const openRe = /<div data-sessionid="([^"]+)" class="sz-session([^"]*)"/g;
    for (const { outer, match } of eachElement(grid, openRe, "div")) {
      const [, id, classes] = match;
      const when = /data-sztz="TimeWithDuration\|[^|]+\|([^|]+)\|([^"]+)"/.exec(outer);
      const room = /data-roomid="(\d+)" class="sz-session__room">([^<]*)</.exec(outer);
      const title = /<h3 class="sz-session__title">\s*(?:<a[^>]*>)?([\s\S]*?)(?:<\/a>)?\s*<\/h3>/.exec(outer);
      if (!when || !room || !title) throw new Error(`GridSmart: incomplete session ${id}`);

      const startUtc = iso(when[1]);
      const endUtc = iso(when[2]);
      sessions.push({
        id,
        title: text(title[1]),
        dayId: day.id,
        roomId: room[1],
        roomName: text(room[2]),
        startUtc,
        endUtc,
        durationMin: Math.round((Date.parse(endUtc) - Date.parse(startUtc)) / 60000),
        isService: classes.includes("sz-session--service"),
        speakerIds: parseSpeakerRefs(outer),
        tags: parseTags(outer),
      });
    }
  }
  return { days, sessions };
}

/** Descriptions, language and level, keyed by session id. */
function parseSessions(html) {
  const extra = new Map();
  const openRe = /<li id="sz-session-([^"]+)" data-sessionid="[^"]+" class="sz-session/g;
  for (const { outer, match } of eachElement(html, openRe, "li")) {
    const desc = /<p class="sz-session__description">([\s\S]*?)<\/p>/.exec(outer);
    const tags = parseTags(outer);
    const { language, level, main_tag, ...rest } = tags;
    extra.set(match[1], {
      description: richText(desc?.[1] ?? ""),
      language: language?.[0]?.name ?? null,
      level: level?.[0]?.name ?? null,
      // Anything Sessionize adds later (a target-audience category, say) lands
      // here and the detail page picks it up on its own.
      otherTags: Object.fromEntries(
        Object.entries(rest).map(([group, list]) => [group, list.map((t) => t.name)]),
      ),
    });
  }
  return extra;
}

function parseSpeakers(html) {
  const speakers = [];
  const openRe = /<li id="sz-speaker-([^"]+)" data-speakerid="[^"]+" class="sz-speaker/g;
  for (const { outer, match } of eachElement(html, openRe, "li")) {
    const name = /<h3 class="sz-speaker__name">([\s\S]*?)<\/h3>/.exec(outer);
    const tagline = /<h4 class="sz-speaker__tagline">([\s\S]*?)<\/h4>/.exec(outer);
    const bio = /<p class="sz-speaker__bio">([\s\S]*?)<\/p>/.exec(outer);
    const photo = /<img[^>]*src="(https:\/\/cdn\.sessionize\.com\/image\/[^"]+)"/.exec(outer);
    if (!name) throw new Error(`Speakers: no name for ${match[1]}`);
    speakers.push({
      id: match[1],
      name: text(name[1]),
      tagline: tagline ? text(tagline[1]) : null,
      bio: richText(bio?.[1] ?? ""),
      photoUrl: photo?.[1] ?? null,
    });
  }
  return speakers;
}

// -------------------------------------------------------------------- photos

async function downloadPhotos(speakers) {
  await mkdir(PHOTO_DIR, { recursive: true });
  const existing = new Set(await readdir(PHOTO_DIR).catch(() => []));
  let fetched = 0;

  for (const s of speakers) {
    if (!s.photoUrl) { s.photo = null; continue; }
    const ext = (path.extname(new URL(s.photoUrl).pathname) || ".jpg").toLowerCase();
    const file = `${s.id}${ext}`;
    s.photo = `/img/speakers/${file}`;
    if (existing.has(file)) continue;
    const res = await fetch(s.photoUrl);
    if (!res.ok) {
      console.warn(`  ! photo for ${s.name}: HTTP ${res.status}`);
      s.photo = null;
      continue;
    }
    await writeFile(path.join(PHOTO_DIR, file), Buffer.from(await res.arrayBuffer()));
    fetched++;
  }
  return fetched;
}

// ---------------------------------------------------------------------- main

const [gridHtml, sessionsHtml, speakersHtml] = await Promise.all(
  ["GridSmart", "Sessions", "Speakers"].map(fetchView),
);

const { days, sessions } = parseGrid(gridHtml);
const extra = parseSessions(sessionsHtml);
const speakers = parseSpeakers(speakersHtml);

if (sessions.length < 50) throw new Error(`only ${sessions.length} sessions — refusing to write`);
if (speakers.length < 20) throw new Error(`only ${speakers.length} speakers — refusing to write`);

// Merge, and reduce tags to the fields the site actually renders.
const tracks = new Map();
for (const s of sessions) {
  const track = s.tags.main_tag?.[0] ?? null;
  if (track) tracks.set(track.id, { ...track, slug: slugify(track.name) });
  const more = extra.get(s.id) ?? {};
  s.track = track ? { id: track.id, name: track.name, slug: slugify(track.name) } : null;
  s.description = more.description ?? [];
  s.language = more.language ?? null;
  s.level = more.level ?? null;
  s.otherTags = more.otherTags ?? {};
  s.slug = `${slugify(s.title)}-${s.id}`;
  delete s.tags;
}

const used = new Set(sessions.flatMap((s) => s.speakerIds));
const byName = (a, b) => a.name.localeCompare(b.name, "nb");

const fetched = await downloadPhotos(speakers.filter((s) => used.has(s.id)));

const program = {
  event: { name: "Sikkerhetsfestivalen 2026", timezone: "Europe/Oslo", sessionizeId: EMBED_ID },
  days: days.map((d) => ({ ...d, date: d.startUtc.slice(0, 10) })),
  tracks: [...tracks.values()].sort(byName),
  speakers: speakers
    .filter((s) => used.has(s.id))
    .map(({ photoUrl, ...s }) => s)
    .sort(byName),
  // Chronological, then by room, so the file is stable across runs.
  sessions: sessions.sort(
    (a, b) => a.startUtc.localeCompare(b.startUtc) || a.roomId.localeCompare(b.roomId) || a.id.localeCompare(b.id),
  ),
};

await mkdir(path.dirname(DATA_FILE), { recursive: true });
await writeFile(DATA_FILE, JSON.stringify(program, null, 2) + "\n");

console.log(
  `${program.sessions.length} sessions (${program.sessions.filter((s) => s.isService).length} service), ` +
  `${program.days.length} days, ${program.tracks.length} tracks, ` +
  `${program.speakers.length} speakers, ${fetched} new photos`,
);
