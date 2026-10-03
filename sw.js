const CACHE_NAME = "rebobinado-v31";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-512.png",
  "./icons/icon-192.png"
];

// INSTALACIÓN
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ACTIVACIÓN
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => self.clients.claim())
  );
});

// PETICIONES
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestURL = new URL(event.request.url);

  // Solo manejamos recursos de nuestra propia aplicación
  if (requestURL.origin !== self.location.origin) {
    return;
  }

  // Para la página principal usamos RED PRIMERO.
  // Así las actualizaciones de la aplicación aparecen normalmente.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
              cache.put("./index.html", networkResponse.clone());
            });
          }

          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request)
            .then((cachedResponse) => {
              return cachedResponse || caches.match("./index.html");
            });
        })
    );

    return;
  }

  // Para los demás recursos mantenemos la estrategia de caché.
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((networkResponse) => {
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type === "basic"
            ) {
              const responseToCache = networkResponse.clone();

              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }

            return networkResponse;
          });
      })
      .catch(() => {
        return new Response("", {
          status: 503,
          statusText: "Sin conexión"
        });
      })
  );
});