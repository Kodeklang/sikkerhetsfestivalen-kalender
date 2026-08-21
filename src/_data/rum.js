// Real User Monitoring settings, passed verbatim to datadogRum.init() by
// rum.njk. This lives apart from site.js because none of it derives from the
// programme: it is deployment metadata, and site.js is strictly a view model.
//
// The application id and client token are public by design. Datadog's browser
// tokens are write-only intake credentials meant to be shipped to every
// visitor; they grant no read access to the organisation.

import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

export default {
  applicationId: "66620052-0f7f-4fd0-a99c-67db2da0512b",
  clientToken: "pub572110d7577bcdf36821d5af480b08d7",
  site: "datadoghq.eu",
  service: "sikkerhetsfestivalen-kalender",

  // GitHub Actions is the only thing that publishes, so anything else is a
  // developer running `eleventy --serve` and must not land in production data.
  env: process.env.CI ? "prod" : "dev",
  // Deliberately not site.version: that is a hash of the programme, which the
  // hourly scrape changes for reasons that have nothing to do with the code.
  version: pkg.version,

  sessionSampleRate: 100,
  sessionReplaySampleRate: 20,
  trackResources: true,
  trackUserInteractions: true,
  trackLongTasks: true,

  // Session replay records the DOM, so state the privacy level rather than
  // leaning on the SDK default of the same name.
  defaultPrivacyLevel: "mask-user-input",
};
