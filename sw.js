// Tokt.app Service Worker v2.0
// Handles push notifications and offline caching

const CACHE_NAME = 'tokt-v2';
const STATIC_ASSETS = ['/', '/index.html', '/terms.html'];

// Install
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate – delete any old caches (e.g. tokt-v1)
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch
//  - Pages (HTML/navigations): NETWORK-FIRST so updates show up immediately,
//    falling back to cache only when offline.
//  - Other assets: cache-first, but refreshed in the background.
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  const isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if(isHTML) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }).catch(() =>
        caches.match(req).then(cached => cached || caches.match('/index.html'))
      )
    );
  } else {
    e.respondWith(
      caches.match(req).then(cached =>
        cached || fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return res;
        })
      )
    );
  }
});

// Push notification received
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'Tokt.app';
  const options = {
    body: data.body || 'Du har et nytt varsel',
    icon: data.icon || '/icon192.png',
    badge: '/icon192.png',
    tag: data.tag || 'tokt-notification',
    data: { url: data.url || '/' },
    actions: data.actions || [],
    vibrate: [100, 50, 100],
    requireInteraction: false
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Notification clicked
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If app already open, focus it
      for(const client of clientList) {
        if(client.url.includes('tokt.app') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow(url);
    })
  );
});
