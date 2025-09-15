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