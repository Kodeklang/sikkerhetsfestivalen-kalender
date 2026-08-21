// Everything here is either time-dependent or a user preference, which is
// exactly what may not be baked into the HTML: the build must stay
// byte-identical for an unchanged programme.

const LANG_KEY = "sf-lang";
// GitHub Pages serves this under /<repo>/, so nothing may assume the root.
const BASE = document.querySelector('meta[name="base-path"]')?.content || "/";
const onLangChange = [];

/* ------------------------------------------------------------- language */

function currentLang() {
  return localStorage.getItem(LANG_KEY) === "en" ? "en" : "no";
}

function applyLang(lang) {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-en]")) {
    // Remember the Norwegian original the first time we touch an element.
    if (el.dataset.no === undefined) el.dataset.no = el.textContent.trim();
    el.textContent = lang === "en" ? el.dataset.en : el.dataset.no;
  }
  for (const fn of onLangChange) fn(lang);
}

const langButton = document.getElementById("lang");
if (langButton) {
  langButton.addEventListener("click", () => {
    const next = currentLang() === "en" ? "no" : "en";
    localStorage.setItem(LANG_KEY, next);
    applyLang(next);
  });
}
applyLang(currentLang());

/* --------------------------------------------------------- track filter */

// Picking a track leaves its sessions in colour and greys the rest down. It is
// a de-emphasis, not a filter: nothing is hidden, so the shape of the day and
// the accessibility tree both stay intact.

const TRACK_KEY = "sf-track";
const chips = document.querySelectorAll(".chip[data-track]");
const trackedSessions = document.querySelectorAll(".session[data-track]");
const filterStatus = document.getElementById("filter-status");

if (chips.length) {
  const nameOf = (slug) =>
    [...chips].find((c) => c.dataset.track === slug)?.textContent.trim() ?? slug;

  const gridEl = document.querySelector(".grid");
  const columned = gridEl ? gridEl.querySelectorAll("[data-col]") : [];
  const roomCount = gridEl ? Number(gridEl.style.getPropertyValue("--rooms")) : 0;

  /**
   * Collapse every room with no session in this track. Columns are zeroed
   * rather than renumbered, so nothing else on the grid has to move.
   * Returns how many rooms survived.
   */
  const applyColumns = (keep) => {
    if (!gridEl) return 0;
    if (!keep) {
      gridEl.style.removeProperty("--cols");
      gridEl.style.setProperty("--visible-rooms", String(roomCount));
      for (const el of columned) el.classList.remove("is-collapsed");
      return roomCount;
    }
    const widths = [];
    for (let col = 2; col < roomCount + 2; col++) {
      widths.push(keep.has(String(col)) ? "minmax(var(--col-w), 1fr)" : "0px");
    }
    gridEl.style.setProperty("--cols", `var(--gutter-w) ${widths.join(" ")}`);
    gridEl.style.setProperty("--visible-rooms", String(keep.size));
    for (const el of columned) {
      el.classList.toggle("is-collapsed", !keep.has(el.dataset.col));
    }
    return keep.size;
  };

  // `announce` guards the live region: only a real click should speak. Writing
  // it on load or on a language switch would just be noise.
  const applyTrack = (slug, { announce = false, lang = currentLang() } = {}) => {
    for (const chip of chips) {
      const on = chip.dataset.track === slug;
      chip.setAttribute("aria-pressed", String(on));
      chip.classList.toggle("is-muted", Boolean(slug) && !on);
    }

    const matching = [...trackedSessions].filter((s) => s.dataset.track === slug);
    // Which columns a track occupies is worked out at build time, per day, from
    // that day's schedule - a track may sit in several rooms, and a room may
    // host more than one track. Sessions in a kept room that belong to another
    // track stay visible but greyed, for context.
    const chip = slug ? [...chips].find((c) => c.dataset.track === slug) : null;
    const keep = chip ? new Set(chip.dataset.cols.split(" ").filter(Boolean)) : null;
    const rooms = applyColumns(keep);

    for (const session of trackedSessions) {
      session.classList.toggle("is-dimmed", Boolean(slug) && session.dataset.track !== slug);
    }

    if (!filterStatus) return;
    if (!announce) {
      filterStatus.textContent = "";
      return;
    }
    if (!slug) {
      filterStatus.textContent = lang === "en" ? "Showing all tracks" : "Viser alle spor";
      return;
    }
    filterStatus.textContent = lang === "en"
      ? `Highlighting ${nameOf(slug)}: ${matching.length} sessions in ${rooms} rooms`
      : `Framhever ${nameOf(slug)}: ${matching.length} foredrag i ${rooms} rom`;
  };

  for (const chip of chips) {
    chip.addEventListener("click", () => {
      // Clicking the active track clears the filter.
      const next = chip.getAttribute("aria-pressed") === "true" ? "" : chip.dataset.track;
      if (next) localStorage.setItem(TRACK_KEY, next);
      else localStorage.removeItem(TRACK_KEY);
      applyTrack(next, { announce: true });
    });
  }

  // Re-announce in the new language, and carry the choice across days.
  onLangChange.push((lang) => applyTrack(localStorage.getItem(TRACK_KEY) || "", { lang }));

  const stored = localStorage.getItem(TRACK_KEY) || "";
  const active = [...chips].find((c) => c.dataset.track === stored);
  // A track may not appear on every day; drop a selection this day cannot show.
  applyTrack(active ? stored : "");
  if (active) {
    // Carried over from another day, the chip may sit off-screen in the
    // horizontally scrolling legend - show why the grid is greyed.
    active.scrollIntoView({ inline: "center", block: "nearest" });
  }
}

/* ------------------------------------------------------------- now line */

const grid = document.querySelector(".grid");
const nowLine = document.getElementById("now");

if (grid && nowLine) {
  const dayStart = Date.parse(grid.dataset.dayStart);
  const slotMin = Number(grid.dataset.slotMin) || 5;
  const totalMin = Number(grid.style.getPropertyValue("--slots")) * slotMin;
  const nowTime = document.getElementById("now-time");
  const clock = new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  let placed = false;

  const tick = () => {
    const minutes = (Date.now() - dayStart) / 60_000;
    if (minutes < 0 || minutes > totalMin) {
      nowLine.hidden = true;
      return false;
    }
    grid.style.setProperty("--now-min", minutes.toFixed(2));
    nowTime.textContent = clock.format(new Date());
    nowLine.hidden = false;
    return true;
  };

  if (tick()) {
    // Open scrolled to the now-line, a little above centre.
    const scroller = document.getElementById("grid-scroll");
    requestAnimationFrame(() => {
      if (placed) return;
      placed = true;
      scroller.scrollTop = Math.max(0, nowLine.offsetTop - scroller.clientHeight * 0.42);
    });
  }
  setInterval(tick, 30_000);
}

/* ------------------------------------------------------------- countdown */

const countdown = document.getElementById("countdown");

if (countdown) {
  const start = Date.parse(countdown.dataset.start);
  const end = Date.parse(countdown.dataset.end);

  const render = (lang) => {
    const now = Date.now();
    if (now >= end) {
      countdown.textContent = lang === "en" ? "Finished" : "Ferdig";
      return;
    }
    if (now >= start) {
      countdown.textContent = lang === "en" ? "On now" : "Pågår nå";
      return;
    }
    const mins = Math.round((start - now) / 60_000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const span = h ? `${h}${lang === "en" ? "h" : " t"} ${m} min` : `${m} min`;
    countdown.textContent = lang === "en" ? `${span} to start` : `${span} til start`;
  };

  onLangChange.push(render);
  render(currentLang());
  setInterval(() => render(currentLang()), 30_000);
}

/* ------------------------------------------------------------------ back */

// The href is a real link to the day grid so this works without JS; when the
// visitor actually came from the grid, going back preserves their scroll.
const back = document.getElementById("back");
if (back && document.referrer) {
  try {
    const from = new URL(document.referrer);
    if (from.origin === location.origin && from.pathname.startsWith(`${BASE}dag/`)) {
      back.addEventListener("click", (event) => {
        event.preventDefault();
        history.back();
      });
    }
  } catch {
    /* malformed referrer: keep the plain link */
  }
}

/* ---------------------------------------------------------- programme update */

const banner = document.getElementById("update");
const built = document.querySelector('meta[name="app-version"]')?.content;

async function checkForUpdate() {
  if (!banner || !built) return;
  try {
    // no-cache still revalidates, so this is a 304 with no body until the
    // programme actually changes.
    const res = await fetch(`${BASE}version.json`, { cache: "no-cache" });
    if (!res.ok) return;
    const { version } = await res.json();
    if (version && version !== built) banner.hidden = false;
  } catch {
    /* offline: try again later */
  }
}

document.getElementById("update-reload")?.addEventListener("click", () => location.reload());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkForUpdate();
});
checkForUpdate();
setInterval(checkForUpdate, 10 * 60_000);

/* --------------------------------------------------------- service worker */

if ("serviceWorker" in navigator) {
  // A page that is already controlled has loaded its CSS and JS from the old
  // worker's cache. When a new worker takes over it brings fresh assets, but
  // this document is still running the previous bundle - so reload once.
  // Without this every deploy would only reach people on their *second* visit.
  if (navigator.serviceWorker.controller) {
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  }

  window.addEventListener("load", () => {
    // updateViaCache: "none" keeps sw.js itself off the HTTP cache, so a deploy
    // is noticed on the next visit rather than up to ten minutes later.
    navigator.serviceWorker
      .register(`${BASE}sw.js`, { scope: BASE, updateViaCache: "none" })
      .catch(() => {
        /* the site works fine without it */
      });
  });
}
