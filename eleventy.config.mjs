export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/css": "css" });
  eleventyConfig.addPassthroughCopy({ "src/js": "js" });
  eleventyConfig.addPassthroughCopy({ "src/img": "img" });
  eleventyConfig.addPassthroughCopy({ "src/icons": "icons" });
  eleventyConfig.addPassthroughCopy({ "src/root": "." });

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
