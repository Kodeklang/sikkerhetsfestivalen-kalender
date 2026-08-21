// Starts Real User Monitoring. This file exists only to carry the build-time
// configuration in src/_data/rum.js into the browser: src/js/app.js is copied
// through untouched and never sees a template.
//
// The SDK bundle is loaded just above this one, both deferred, so DD_RUM is
// already defined by the time this runs. The guard is for the visitor whose
// content blocker ate the bundle - a missing analytics script must never take
// the programme down with it.

if (window.DD_RUM) {
  window.DD_RUM.onReady(function () {
    window.DD_RUM.init({
  "applicationId": "66620052-0f7f-4fd0-a99c-67db2da0512b",
  "clientToken": "pub572110d7577bcdf36821d5af480b08d7",
  "site": "datadoghq.eu",
  "service": "sikkerhetsfestivalen-kalender",
  "env": "prod",
  "version": "1.0.0",
  "sessionSampleRate": 100,
  "sessionReplaySampleRate": 20,
  "trackResources": true,
  "trackUserInteractions": true,
  "trackLongTasks": true,
  "defaultPrivacyLevel": "mask-user-input"
});
  });
}
