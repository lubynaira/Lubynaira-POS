const CACHE_NAME = "skupy-hpp-gamis-v2";
const CORE_ASSETS = ["/", "/manifest.json", "/icons/icon.svg", "/icons/maskable.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate" || requestUrl.pathname.startsWith("/_next/")) {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && CORE_ASSETS.includes(requestUrl.pathname)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }

        return response;
      })
      .catch(() =>
        caches.match(request).then(async (cached) => {
          if (cached) return cached;
          if (request.mode === "navigate") {
            const appShell = await caches.match("/");
            if (appShell) return appShell;
          }

          return Response.error();
        })
      )
  );
});
