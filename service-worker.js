const CACHE_NAME = "gymadmin-v1.2";
const REPO_NAME = "gymadmin"; // Nombre de tu repositorio

// Determinar el entorno - GitHub Pages NO es desarrollo
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
      // PRODUCCIÓN (GitHub Pages): Todas las páginas y recursos
      `/${REPO_NAME}/`,
      `/${REPO_NAME}/index.html`,
      `/${REPO_NAME}/pages/clientes.html`,
      `/${REPO_NAME}/pages/rendimientos.html`,
      `/${REPO_NAME}/pages/notificaciones.html`,
      `/${REPO_NAME}/pages/configuracion.html`,
      `/${REPO_NAME}/css/styles.css`,
      `/${REPO_NAME}/js/app.js`,
      `/${REPO_NAME}/js/firebase-config.js`,
      `/${REPO_NAME}/partials/header.html`,
      `/${REPO_NAME}/icons/logo_focus_fit.png`,
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
    caches.open(CACHE_NAME).then((cache) => {
      console.log("📦 Cache abierto y agregando recursos");
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", (event) => {
  // Para recursos de Firebase y APIs, siempre ir a la red
  if (
    event.request.url.includes("firebase") ||
    event.request.url.includes("googleapis")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isDevelopment) {
    // DESARROLLO: No cachear, siempre ir a network
    event.respondWith(fetch(event.request));
    return;
  }

  // PRODUCCIÓN: Strategy: Cache First, then Network
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => {
        // Devuelve el recurso en cache o busca en la red
        return (
          response ||
          fetch(event.request).then((fetchResponse) => {
            // Opcional: agregar nuevos recursos al cache
            if (fetchResponse && fetchResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, fetchResponse.clone());
              });
            }
            return fetchResponse;
          })
        );
      })
      .catch(() => {
        // Fallback para páginas: servir index.html para rutas SPA
        if (event.request.mode === "navigate") {
          return caches.match(`/${REPO_NAME}/index.html`);
        }
      })
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
            console.log("🗑️ Eliminando cache viejo:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
