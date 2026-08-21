// Google's "latin" subset of Montserrat carries a few hundred glyphs and costs
// 38KB a weight. This site draws on about 120 characters. Subsetting each face
// to the ones that can actually appear takes the four latin faces a page pulls
// from 141KB to a fraction of that.
//
// The character set is derived, not hand-written, because the programme is
// refetched hourly: a speaker called Škoda must not silently fall back to a
// system font. Everything that can reach the page is scanned - the programme
// itself, the Norwegian and English strings in the templates - on top of a base
// set covering Latin-1, which is where most European accents live. Anything
// rarer - Š, ł, ő - is picked up from the programme on the build that
// introduces it, because the hourly workflow rebuilds whenever it changes.

import subsetFont from "subset-font";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export const FONT_DIR = ".cache/fonts";

const SRC = new URL("../src/css/fonts/", import.meta.url);
const ROOT = new URL("../src/", import.meta.url);

/** Printable ASCII, Latin-1 letters, and the punctuation the templates use. */
function baseChars() {
  let s = "";
  for (let c = 0x20; c <= 0x7e; c++) s += String.fromCodePoint(c);
  // Latin-1 Supplement letters: the accents behind most European names.
  for (let c = 0xc0; c <= 0xff; c++) s += String.fromCodePoint(c);
  // Typographic punctuation the programme text and the templates rely on.
  return s + "‐‑‒–—‘’‚“”„•…‹›·«»´€";
}

/** Every character that any template or the programme itself can put on a page. */
export function siteChars() {
  let text = baseChars();
  text += readFileSync(new URL("_data/program.json", ROOT), "utf8");

  // Template literals: the Norwegian labels and their data-en counterparts.
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(njk|html)$/.test(entry.name)) text += readFileSync(p, "utf8");
    }
  };
  walk(path.dirname(new URL("index.njk", ROOT).pathname));

  return [...new Set(text)].filter((c) => c.codePointAt(0) > 0x1f).sort().join("");
}

export async function buildFonts() {
  mkdirSync(FONT_DIR, { recursive: true });
  const chars = siteChars();
  const dir = path.dirname(new URL("x", SRC).pathname);

  for (const file of readdirSync(dir).filter((f) => f.endsWith(".woff2"))) {
    const out = path.join(FONT_DIR, file);
    const source = readFileSync(path.join(dir, file));
    // Each face keeps only the glyphs it actually has: passing the whole set to
    // a latin file and a latin-ext file lets each take its own share, and the
    // unicode-range in fonts.css still decides which one a browser fetches.
    const subset = await subsetFont(source, chars, { targetFormat: "woff2" });
    writeFileSync(out, subset);
  }
}
