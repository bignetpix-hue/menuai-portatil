var CACHE = 'menuai-v1';
var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/app.html',
  '/menu.html',
  '/login.html',
  '/cadastro.html',
  '/css/estilo.css',
  '/js/config.js',
  '/js/utils.js',
  '/js/api.js',
  '/js/qrcode.min.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var fetchPromise = fetch(event.request).then(function (response) {
        if (response.ok && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(event.request, clone); });
        }
        return response;
      }).catch(function () {
        return cached;
      });
      return cached || fetchPromise;
    })
  );
});

// Push notification listener
self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'MENUAI', body: event.data.text() }; }
  var title = data.title || 'MENUAI';
  var options = {
    body: data.body || 'Novo pedido recebido!',
    icon: '/data/icon-192.svg',
    badge: '/data/icon-192.svg',
    vibrate: [200, 100, 200],
    tag: 'menuai-order'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/app.html#/orders'));
});
