import { mkdirSync } from "node:fs";
import { AVATAR_DIR, buildAvatars } from "./lib/avatars.mjs";
import { FONT_DIR, buildFonts } from "./lib/fonts.mjs";

// Created up front so the passthrough copy below has something to point at on a
// clean checkout, before any image has been generated.
mkdirSync(AVATAR_DIR, { recursive: true });
mkdirSync(FONT_DIR, { recursive: true });

export default function (eleventyConfig) {
  // Re-encode the speaker photos before anything else runs. Passthrough copy
  // happens ahead of the data cascade, so generating them from the data file
  // alone would publish an empty directory on a cold build.
  eleventyConfig.on("eleventy.before", buildAvatars);

  // Same ordering rule as the avatars: subset before passthrough copies run.
  eleventyConfig.on("eleventy.before", buildFonts);

  // Named individually rather than copying src/css wholesale: the originals in
  // src/css/fonts are the input to the subsetter, not something to publish.
  eleventyConfig.addPassthroughCopy({ "src/css/style.css": "css/style.css" });
  eleventyConfig.addPassthroughCopy({ "src/css/fonts.css": "css/fonts.css" });
  eleventyConfig.addPassthroughCopy({ [FONT_DIR]: "css/fonts" });
  eleventyConfig.addPassthroughCopy({ "src/js": "js" });
  eleventyConfig.addPassthroughCopy({ "src/icons": "icons" });
  eleventyConfig.addPassthroughCopy({ "src/root": "." });

  // The RUM SDK ships a prebuilt bundle, so it needs no bundler of our own.
  // Copy the whole directory: the session replay recorder and the profiler are
  // separate chunks the SDK fetches at runtime, relative to its own URL.
  eleventyConfig.addPassthroughCopy({
    "node_modules/@datadog/browser-rum/bundle": "js/datadog",
  });

  // Only the generated derivatives are published. The originals stay in the
  // repo as the source for those, but nothing links to them.
  eleventyConfig.addPassthroughCopy({ [AVATAR_DIR]: "img/av" });

  // Norwegian-style time and date, always in the festival's own timezone so
  // the build does not depend on the machine it runs on.
  const inOslo = (opts) => new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", ...opts });
  const hhmm = inOslo({ hour: "2-digit", minute: "2-digit", hour12: false });

  eleventyConfig.addFilter("time", (iso) => hhmm.format(new Date(iso)));
  eleventyConfig.addFilter("duration", (min) =>
    min >= 60 ? `${Math.floor(min / 60)} t${min % 60 ? ` ${min % 60} min` : ""}` : `${min} min`);

  return {
    // The site is served from the root of its own domain. Override with
    // PATH_PREFIX=/sikkerhetsfestivalen-kalender/ to build for the bare
    // github.io project URL again.
    pathPrefix: process.env.PATH_PREFIX ?? "/",
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
