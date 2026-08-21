// Service worker for the Sikkerhetsfestivalen programme.
//
// The cache name carries a hash of the programme *and* every shipped asset, so
// any real change retires the old cache wholesale.

const CACHE = "sf-5c305b012601";

const BASE = "/sikkerhetsfestivalen-kalender/";

const SHELL = [
  BASE,
  "/sikkerhetsfestivalen-kalender/dag/1/",
  "/sikkerhetsfestivalen-kalender/dag/2/",
  "/sikkerhetsfestivalen-kalender/dag/3/",
  "/sikkerhetsfestivalen-kalender/css/style.css",
  "/sikkerhetsfestivalen-kalender/css/fonts.css",
  "/sikkerhetsfestivalen-kalender/js/app.js",
  "/sikkerhetsfestivalen-kalender/manifest.webmanifest",
  "/sikkerhetsfestivalen-kalender/icons/icon.svg",
  "/sikkerhetsfestivalen-kalender/icons/icon-192.png",
];

const NETWORK_TIMEOUT = 2500;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

/** Network first, but never leave the user staring at a spinner on bad wifi. */
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT)),
    ]);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") return (await cache.match(BASE)) ?? Response.error();
    throw new Error("offline and uncached");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // The update check must always see the truth.
  if (url.pathname === `${BASE}version.json`) return;

  // Pages go network-first so that "reload" after an update really reloads.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Fonts, icons, photos, CSS and JS are all retired by the cache name.
  event.respondWith(cacheFirst(request));
});
