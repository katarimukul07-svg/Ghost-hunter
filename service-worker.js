const CACHE = "echo-steps-v8";
const OFFLINE_ASSETS = [
  "./",
  "./index.html",
  "./styles/game.css",
  "./src/platform/native-bridge.js",
  "./src/game/config.js",
  "./src/game/audio.js",
  "./src/game/arena.js",
  "./src/game/state.js",
  "./src/game/gameplay.js",
  "./src/game/rendering.js",
  "./src/game/controls.js",
  "./src/game/bootstrap.js",
  "./src/game/systems/fairness.js",
  "./src/game/systems/bonuses.js",
  "./src/rendering/backgrounds.js",
  "./src/ui/tutorial.js",
  "./manifest.webmanifest",
  "./privacy.html",
  "./support.html",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(OFFLINE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    })),
  );
});
