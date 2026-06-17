const CACHE_NAME = "finnn-v2";
const STATIC_FILE_PATTERN = /\.(?:css|js|mjs|png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?|ttf|otf)$/i;
const STATIC_PATH_PREFIXES = ["/_next/static/", "/images/", "/fonts/"];
const STATIC_PATHS = new Set(["/favicon.ico", "/manifest.json", "/site.webmanifest", "/apple-icon.png"]);

function isCacheableStaticAsset(request) {
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

  if (url.pathname.startsWith("/api/")) {
    return false;
  }

  if (url.pathname.startsWith("/auth/users/")) {
    return false;
  }

  if (url.pathname.startsWith("/_next/data/")) {
    return false;
  }

  if (STATIC_PATHS.has(url.pathname)) {
    return true;
  }

  if (STATIC_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return true;
  }

  if (["font", "image", "script", "style"].includes(request.destination)) {
    return true;
  }

  return STATIC_FILE_PATTERN.test(url.pathname);
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
  if (!isCacheableStaticAsset(event.request)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const isRedirect = response.status >= 300 && response.status < 400;

        if (isRedirect) {
          return response;
        }

        if (!response || response.status !== 200 || response.type !== "basic") {
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
