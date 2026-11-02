const CACHE_NAME = "miumiu-care-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./sheets.js",
  "./manifest.json",
  "./assets/cat-icon.svg",
  "./assets/apple-touch-icon.png",
  "./assets/cat-icon-192.png",
  "./assets/cat-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        return caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).then(() => response);
      }
      return response;
    }).catch(() => caches.match(request.mode === "navigate" ? "./index.html" : request)));
});
