// Derived view models for the templates. program.json is the source of truth;
// everything here is computed from it and must stay free of anything
// time-dependent, so that an unchanged programme builds byte-identical output.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import rum from "./rum.js";

const raw = readFileSync(new URL("./program.json", import.meta.url), "utf8");
const program = JSON.parse(raw);

const SLOT_MIN = 5; // one grid row
const MS = 60_000;

// Card geometry, mirroring style.css. A card's usable text height follows from
// its duration alone, so the number of title lines that fit is known at build
// time -- no calc() inside line-clamp (Safari won't take one) and no measuring
// in the browser. Keep these in step with the CSS if the card chrome changes.
const SLOT_H = { d: 8.5, m: 11 };   // :root and the max-width:720px override
const CARD_CHROME = 16;             // 2px margin + 2px border + 12px padding
const TITLE_LEADING = 1.28;         // .session__title line-height
const TITLE_SIZE = { sm: 11, md: 12, lg: 12 };
// A ten-minute card is 20px tall on mobile and 15px on desktop, which the
// normal type and padding overshoot -- the line used to hang past the card and
// have its descenders sliced off. Those cards fall back to a compact scale
// (.session--tight) that fits inside them instead.
const TIGHT_CHROME = 6;             // 2px margin + 2px border + 2px padding
const TIGHT_LEADING = 1.1;
const TIGHT_SIZE = 10;

/**
 * How many title lines fit in a card of this duration, per breakpoint, plus
 * whether the card is too short to seat one line at the normal size.
 */
const titleLines = (durationMin, size) => {
  const room = (slotH, chrome) => (durationMin / SLOT_MIN) * slotH - chrome;
  const leading = TITLE_SIZE[size] * TITLE_LEADING;
  const tight =
    room(SLOT_H.d, CARD_CHROME) < leading || room(SLOT_H.m, CARD_CHROME) < leading;
  const lead = tight ? TIGHT_SIZE * TIGHT_LEADING : leading;
  const chrome = tight ? TIGHT_CHROME : CARD_CHROME;
  const fit = (slotH) => Math.max(1, Math.floor(room(slotH, chrome) / lead));
  return { tight, d: fit(SLOT_H.d), m: fit(SLOT_H.m) };
};

// One colour per track; the card's background and border are derived from it
// with color-mix() in CSS. The first five are the exact values from the design.
const TRACK_COLOUR = {
  "Application Security": "#b96806",
  "Identity": "#0d7d70",
  "Incident Management": "#3a3a38",
  "Offensive Security": "#b0491c",
  "Culture & Awareness": "#4f6b3c",
  "Business Continuity & Resilience": "#4a6a5a",
  "Cloud & Security Architecture": "#2f6f9e",
  "Cryptography": "#6b4fa0",
  "Cyber Crime": "#a03242",
  "Forensics": "#3f6b78",
  "Keynote": "#d96f07",
  "Legal & Compliance": "#6e6244",
  "National Security": "#2f5d4a",
  "Operational Technology": "#7d5a2b",
  "Personnel Security": "#8a5a7a",
  "Physical Security": "#55606e",
  "Risk & Security Management": "#94631a",
  "Supplier Security": "#7a6a3f",
  "Threat Intelligence": "#8a4b5c",
  "Other": "#7a7a74",
};
const FALLBACK_COLOUR = "#7a7a74";

const WEEKDAY_NO = {
  Monday: ["Mandag", "Man"], Tuesday: ["Tirsdag", "Tir"], Wednesday: ["Onsdag", "Ons"],
  Thursday: ["Torsdag", "Tor"], Friday: ["Fredag", "Fre"],
  Saturday: ["Lørdag", "Lør"], Sunday: ["Søndag", "Søn"],
};


const ms = (iso) => Date.parse(iso);
const floorTo = (t, min) => Math.floor(t / (min * MS)) * min * MS;
const ceilTo = (t, min) => Math.ceil(t / (min * MS)) * min * MS;
const colour = (track) => (track && TRACK_COLOUR[track.name]) || FALLBACK_COLOUR;
const byName = (a, b) => a.name.localeCompare(b.name, "nb");

const speakersById = new Map(program.speakers.map((s) => [s.id, s]));

/** Rooms that hold at least one talk, in the order Sessionize lays them out. */
function columnsFor(day, talks) {
  const used = new Set(talks.map((s) => s.roomId));
  const ordered = day.rooms.filter((r) => used.has(r.id));
  const known = new Set(ordered.map((r) => r.id));
  for (const s of talks) {
    if (!known.has(s.roomId)) {
      known.add(s.roomId);
      ordered.push({ id: s.roomId, name: s.roomName });
    }
  }
  return ordered;
}

const days = program.days.map((day, index) => {
  const sessions = program.sessions.filter((s) => s.dayId === day.id);
  const talks = sessions.filter((s) => !s.isService);
  const services = sessions.filter((s) => s.isService);

  const from = floorTo(Math.min(ms(day.startUtc), ...sessions.map((s) => ms(s.startUtc))), SLOT_MIN);
  const to = ceilTo(Math.max(ms(day.endUtc), ...sessions.map((s) => ms(s.endUtc))), SLOT_MIN);
  const row = (iso) => (ms(iso) - from) / MS / SLOT_MIN + 2; // row 1 is the header

  const rooms = columnsFor(day, talks);
  const colOf = new Map(rooms.map((r, i) => [r.id, i + 2])); // column 1 is the time gutter

  // Horizontal rules every half hour; only whole hours carry a label.
  const clock = new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const rules = [];
  for (let t = ceilTo(from, 30); t <= to; t += 30 * MS) {
    const major = t % (60 * MS) === 0;
    rules.push({
      row: (t - from) / MS / SLOT_MIN + 2,
      major,
      label: major ? clock.format(new Date(t)) : null,
    });
  }

  // Only the tracks actually running today. A legend listing all 20 would be
  // misleading on Monday, which has four talks, and clicking an absent track
  // would grey out the whole grid for no reason.
  //
  // Each track also carries the columns it actually occupies today, worked out
  // from this day's schedule. Selecting a track collapses everything else, and
  // because the mapping is derived per day per track it keeps working if the
  // organisers move a track across rooms or split it over several.
  const trackRooms = new Map();
  for (const s of talks) {
    if (!s.track) continue;
    if (!trackRooms.has(s.track.id)) {
      trackRooms.set(s.track.id, { ...s.track, colour: colour(s.track), cols: new Set() });
    }
    trackRooms.get(s.track.id).cols.add(colOf.get(s.roomId));
  }
  const dayTracks = [...trackRooms.values()]
    .map(({ cols, ...t }) => ({ ...t, cols: [...cols].sort((a, b) => a - b) }))
    .sort(byName);

  const [long, short] = WEEKDAY_NO[day.weekday] ?? [day.weekday, day.weekday.slice(0, 3)];
  return {
    id: day.id,
    index,
    number: index + 1,
    date: day.date,
    dateLabel: `${day.date.slice(8, 10)}.${day.date.slice(5, 7)}`,
    weekday: { no: long, en: day.weekday },
    weekdayShort: { no: short, en: day.weekday.slice(0, 3) },
    url: `/dag/${index + 1}/`,
    startUtc: new Date(from).toISOString(),
    slots: (to - from) / MS / SLOT_MIN,
    rooms,
    rules,
    tracks: dayTracks,
    sessions: talks.map((s) => {
      // Card density buckets: at the grid's px-per-minute a 30-minute block is
      // about 54px, which is where the avatar and a second line of title fit.
      const size = s.durationMin >= 45 ? "lg" : s.durationMin >= 30 ? "md" : "sm";
      return {
        ...s,
        url: `/program/${s.slug}/`,
        colour: colour(s.track),
        size,
        lines: titleLines(s.durationMin, size),
        avatar: speakersById.get(s.speakerIds[0])?.photo ?? null,
        col: colOf.get(s.roomId),
        rowStart: row(s.startUtc),
        rowEnd: row(s.endUtc),
      };
    }),
    bands: services.map((s) => ({
      ...s,
      kind: /lunch|break|pause|lunsj/i.test(s.title) ? "pause" : "event",
      rowStart: row(s.startUtc),
      rowEnd: row(s.endUtc),
    })),
  };
});

const dayById = new Map(days.map((d) => [d.id, d]));

/** Everything the detail page needs, resolved at build time. */
const sessions = program.sessions.map((s) => {
  const day = dayById.get(s.dayId);
  const overlapping = program.sessions
    .filter((o) => o.dayId === s.dayId && o.id !== s.id && !o.isService)
    .filter((o) => ms(o.startUtc) < ms(s.endUtc) && ms(s.startUtc) < ms(o.endUtc))
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc) || a.roomName.localeCompare(b.roomName, "nb"));

  return {
    ...s,
    colour: colour(s.track),
    url: `/program/${s.slug}/`,
    day: { number: day.number, url: day.url, weekday: day.weekday, dateLabel: day.dateLabel },
    speakers: s.speakerIds.map((id) => speakersById.get(id)).filter(Boolean),
    // Empty today: Sessionize exposes no audience category for this event.
    // The detail page renders the section only when this fills up.
    audience: Object.values(s.otherTags ?? {}).flat(),
    parallel: overlapping.map((o) => ({
      id: o.id, title: o.title, roomName: o.roomName, startUtc: o.startUtc,
      url: `/program/${o.slug}/`, colour: colour(o.track),
    })),
  };
});

// The service worker's cache name must change when *any* shipped asset
// changes, not just the programme, or a CSS edit would never reach a client.
const assetHash = createHash("sha256").update(raw);
for (const f of [
  "../css/style.css",
  "../css/fonts.css",
  "../js/app.js",
  "../../node_modules/@datadog/browser-rum-slim/bundle/datadog-rum-slim.js",
  // /js/rum.js and /sw.js are generated rather than shipped, so hash what
  // generates them. Leaving the worker itself out was its own trap: a change
  // to how it caches could not retire the cache it had already filled, so a
  // fix for a caching bug never reached the clients suffering from it.
  "../rum.njk",
  "../sw.njk",
]) {
  assetHash.update(readFileSync(new URL(f, import.meta.url)));
}
assetHash.update(JSON.stringify(rum));

export default {
  buildId: assetHash.digest("hex").slice(0, 12),
  daysIndex: days.map((d) => ({ url: d.url, date: d.date })),
  version: createHash("sha256").update(raw).digest("hex").slice(0, 12),
  event: program.event,
  days,
  sessions,
  // Detail pages exist for talks only: service entries (lunch, breaks) carry no
  // description and nothing links to them.
  talks: sessions.filter((s) => !s.isService),
  tracks: program.tracks.map((t) => ({ ...t, colour: TRACK_COLOUR[t.name] ?? FALLBACK_COLOUR })),
};
