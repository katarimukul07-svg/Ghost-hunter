const CACHE = "echo-steps-original-score-v4";
const OFFLINE_ASSETS = [
  "./",
  "./index.html",
  "./styles/game.css",
  "./src/platform/native-bridge.js",
  "./src/game/config.js",
  "./src/game/random.js",
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
  "./src/cloud/account.js",
  "./src/game/ranked-bridge.js",
  "./src/cloud/ranked-canvas.js",
  "./src/cloud/secure-storage-provider.js",
  "./src/cloud/secure-storage-native.js",
  "./manifest.webmanifest",
  "./privacy.html",
  "./support.html",
  "./assets/music/synthwave-house.mp3",
  "./assets/music/menu-synth-wave.mp3",
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
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.endsWith("/cloud-config.json")) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    })),
  );
});
