const CACHE_NAME = "finnn-assets-v5";
const HASHED_ASSET_PATH_PATTERN = /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.(?:css|js|mjs|png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?|ttf|otf)$/i;

function isCacheableHashedAsset(request) {
  if (request.method !== "GET") {
    return false;
  }

  if (request.destination === "document") {
    return false;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return false;
  }

  return HASHED_ASSET_PATH_PATTERN.test(url.pathname);
}

self.addEventListener("install", (_event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all([
        ...cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
        self.clients.claim(),
      ]);
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (!isCacheableHashedAsset(event.request)) {
    return;
  }

  event.respondWith(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        const response = await fetch(event.request);
        const isRedirect = response.status >= 300 && response.status < 400;

        if (!isRedirect && response.status === 200 && response.type === "basic") {
          await cache.put(event.request, response.clone());
        }

        return response;
      })
      .catch(() => {
        return new Response("Network error", {
          status: 408,
          headers: { "Content-Type": "text/plain" },
        });
      })
  );
});
