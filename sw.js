// Service worker for the Sikkerhetsfestivalen programme.
//
// The cache name carries a hash of the programme *and* every shipped asset, so
// any real change retires the old cache wholesale.

const CACHE = "sf-e96a41294693";

const BASE = "/";

// Day one's url *is* BASE, so the loop already covers the front page. Listing
// it twice would make cache.addAll reject the whole install on duplicates.
const SHELL = [
  "/",
  "/dag/2/",
  "/dag/3/",
  "/css/style.css",
  "/css/fonts.css",
  "/js/app.js",
  "/js/rum.js",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: "reload" so this is filled from the network rather than from the
      // browser's HTTP cache. GitHub Pages stamps every asset max-age=600, so a
      // worker installing in the ten minutes after a deploy would otherwise
      // store pre-deploy files under a cache name asserting they are current -
      // and nothing below ever revalidates them.
      .then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Let the browser start a navigation's network request while this worker is
    // still booting, so the two overlap instead of queueing.
    await self.registration.navigationPreload?.enable();
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

/**
 * Serve the page from the cache and refresh it in the background.
 *
 * Every day grid is precached at install, so stepping between dates costs a
 * cache read rather than a round trip - which on a crowded conference network
 * is the difference between instant and a wait. Going to the network first
 * meant waiting for it even though the answer was already on disk.
 *
 * Freshness does not depend on this path. A deploy changes CACHE, so the new
 * worker installs a fresh copy of every page and app.js reloads the document on
 * controllerchange; version.json is never served from here, so the update
 * banner still sees the truth.
 */
async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);

  const fresh = (async () => {
    const response = (await event.preloadResponse) || (await fetch(request));
    if (response?.ok) await cache.put(request, response.clone());
    return response;
  })();

  if (cached) {
    // Do not make the visitor wait on the refresh, but keep the worker alive
    // long enough to finish it.
    event.waitUntil(fresh.catch(() => {}));
    return cached;
  }

  try {
    return await fresh;
  } catch {
    return (await cache.match(BASE)) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  // Same reason as the precache: a miss is about to be stored under a cache
  // name that stands for a particular deploy, so it must come from the network
  // and not from whatever the HTTP cache kept from the last one.
  const response = await fetch(new Request(request, { cache: "reload" }));
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

  if (request.mode === "navigate") {
    event.respondWith(staleWhileRevalidate(event, request));
    return;
  }

  // Fonts, icons, photos, CSS and JS are all retired by the cache name.
  event.respondWith(cacheFirst(request));
});
