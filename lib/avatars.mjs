// Speaker photos come off Sessionize at their original size - 200x200, and for
// about half the speakers as PNGs of a photograph, which is the worst possible
// encoding for one. The grid draws them at 22px and the detail page at 52px, so
// shipping the originals meant 3.3MB of avatars on a day that renders 200KB of
// them. Here they are re-encoded once, at the two sizes actually used.
//
// The generated files land in .cache/img rather than the output directory so
// they survive between builds: eleventy-img skips any derivative already on
// disk, so an unchanged photo costs nothing after the first run. CI caches that
// directory, which is why an hourly build only pays for genuinely new speakers.

import Image from "@11ty/eleventy-img";
import { readFileSync } from "node:fs";
import path from "node:path";

const program = JSON.parse(
  readFileSync(new URL("../src/_data/program.json", import.meta.url), "utf8"),
);

// 22px in the grid and 52px on the detail page, both at up to 3x and 2.5x.
const GRID = 64;
const DETAIL = 128;

export const AVATAR_DIR = ".cache/img";

const OPTIONS = {
  widths: [GRID, DETAIL],
  formats: ["webp"],
  outputDir: `${AVATAR_DIR}/`,
  urlPath: "/img/av/",
  // The filename carries a hash of the source and these options, so an
  // unchanged photo keeps its URL and the build stays byte-identical.
};

/**
 * Map every speaker photo to its generated derivatives, keyed by the original
 * path as it appears in program.json. Templates look themselves up by that key
 * and fall back to the placeholder when a speaker has no photo at all.
 */
export async function buildAvatars() {
  const sources = [...new Set(program.speakers.map((s) => s.photo).filter(Boolean))];

  const entries = await Promise.all(sources.map(async (src) => {
    // program.json stores web paths ("/img/speakers/x.png"); resolve to disk.
    const onDisk = path.join("src", src);
    const metadata = await Image(onDisk, OPTIONS);
    const [small, large] = metadata.webp;
    return [src, { small: small.url, large: large.url, width: GRID, height: GRID }];
  }));

  return Object.fromEntries(entries);
}
