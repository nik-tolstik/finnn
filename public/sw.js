const CACHE_NAME = "finnn-v2";

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
  if (event.request.method !== "GET") {
    return;
  }

  if (event.request.destination === "document") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const isRedirect = response.status >= 300 && response.status < 400;
        
        if (isRedirect) {
          return response;
        }

        if (!response || response.status !== 200 || response.type === "error") {
          return caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || response;
          });
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || new Response("Network error", {
            status: 408,
            headers: { "Content-Type": "text/plain" },
          });
        });
      })
  );
});

