// const CACHE_NAME = "gymadmin-v1.0";
// const urlsToCache = [
//   "/gymadmin/",
//   "/gymadmin/index.html",
//   "/gymadmin/clientes.html",
//   "/gymadmin/rendimientos.html",
//   "/gymadmin/configuracion.html",
//   "/gymadmin/notificaciones.html",
//   "/gymadmin/css/styles.css",
//   "/gymadmin/js/app.js",
//   "/gymadmin/js/firebase-config.js",
//   "/gymadmin/partials/header.html",
//   "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
//   "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js",
//   "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js",
//   "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js",
// ];

// // Instalar el Service Worker y cachear recursos
// self.addEventListener("install", function (event) {
//   event.waitUntil(
//     caches.open(CACHE_NAME).then(function (cache) {
//       return cache.addAll(urlsToCache);
//     })
//   );
// });

// // Interceptar solicitudes y servir desde cache cuando sea posible
// self.addEventListener("fetch", function (event) {
//   event.respondWith(
//     caches.match(event.request).then(function (response) {
//       // Devuelve el recurso desde cache o haz la solicitud network
//       return response || fetch(event.request);
//     })
//   );
// });

// // Limpiar caches viejos
// self.addEventListener("activate", function (event) {
//   event.waitUntil(
//     caches.keys().then(function (cacheNames) {
//       return Promise.all(
//         cacheNames.map(function (cacheName) {
//           if (cacheName !== CACHE_NAME) {
//             return caches.delete(cacheName);
//           }
//         })
//       );
//     })
//   );
// });

// const CACHE_NAME = "gymadmin-v1";
// const urlsToCache = ["/", "/css/styles.css", "/js/app.js"];

// self.addEventListener("install", (event) => {
//   event.waitUntil(
//     caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
//   );
// });

// self.addEventListener("fetch", (event) => {
//   event.respondWith(
//     caches
//       .match(event.request)
//       .then((response) => response || fetch(event.request))
//   );
// });


const CACHE_NAME = "gymadmin-v1.2";

// Determinar si es desarrollo por la URL
const isDevelopment =
  self.location.hostname.includes("localhost") ||
  self.location.hostname.includes("127.0.0.1");

// URLs para cachear (diferentes para dev y prod)
const urlsToCache = isDevelopment
  ? [
      // DESARROLLO: Solo recursos externos
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
      "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js",
      "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js",
      "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js",
    ]
  : [
      // PRODUCCIÓN: Todas las páginas y recursos
      "/",
      "/index.html",
      "/pages/clientes.html",
      "/pages/rendimientos.html",
      "/pages/notificaciones.html",
      "/pages/configuracion.html",
      "/css/styles.css",
      "/js/app.js",
      "/js/firebase-config.js",
      "/partials/header.html",
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
      "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js",
      "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js",
      "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js",
    ];

self.addEventListener("install", (event) => {
  if (isDevelopment) {
    console.log("🚀 Service Worker instalado (modo desarrollo)");
    self.skipWaiting();
    return;
  }

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", (event) => {
  if (isDevelopment) {
    // DESARROLLO: No cachear, siempre ir a network
    event.respondWith(fetch(event.request));
    return;
  }

  // PRODUCCIÓN: Strategy: Cache First, then Network
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

self.addEventListener("activate", (event) => {
  if (isDevelopment) {
    console.log("🔧 Service Worker activado (modo desarrollo)");
    self.clients.claim();
    return;
  }

  // PRODUCCIÓN: Limpiar caches viejos
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});