const CACHE_NAME = "gymadmin-v1.0";
const urlsToCache = [
  "/gymadmin/",
  "/gymadmin/index.html",
  "/gymadmin/clientes.html",
  "/gymadmin/rendimientos.html",
  "/gymadmin/configuracion.html",
  "/gymadmin/notificaciones.html",
  "/gymadmin/css/styles.css",
  "/gymadmin/js/app.js",
  "/gymadmin/js/firebase-config.js",
  "/gymadmin/partials/header.html",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js",
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js",
];

// Instalar el Service Worker y cachear recursos
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(urlsToCache);
    })
  );
});

// Interceptar solicitudes y servir desde cache cuando sea posible
self.addEventListener("fetch", function (event) {
  event.respondWith(
    caches.match(event.request).then(function (response) {
      // Devuelve el recurso desde cache o haz la solicitud network
      return response || fetch(event.request);
    })
  );
});

// Limpiar caches viejos
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
