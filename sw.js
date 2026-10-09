// Cronos Service Worker — Morpheus Relojoaria
// Combines PWA offline caching with Firebase Cloud Messaging Web Push

const CACHE_NAME = 'cronos-pwa-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './favicon.png',
  './apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

// Install: pre-cache application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[PWA SW] Pre-caching warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

// Fetch: Network-first for navigation, stale-while-revalidate for assets
self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Allow external API calls directly through network
  if (
    url.origin.includes('supabase.co') ||
    url.origin.includes('googleapis.com') ||
    url.origin.includes('gstatic.com') ||
    url.protocol.startsWith('chrome-extension')
  ) {
    return;
  }

  // Navigation requests: network first, cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const indexFallback = await caches.match('./index.html');
          if (indexFallback) return indexFallback;
          return caches.match('./');
        })
    );
    return;
  }

  // Static assets: serve cached if available, update in background
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});

// Firebase Cloud Messaging Background Notification Handler
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

  firebase.initializeApp({
    apiKey: 'AIzaSyCIOaLlMTQTqFiscbqlIkQm7akA32Fiuc0',
    authDomain: 'cronos-app-75129.firebaseapp.com',
    projectId: 'cronos-app-75129',
    storageBucket: 'cronos-app-75129.firebasestorage.app',
    messagingSenderId: '576904135011',
    appId: '1:576904135011:web:d5c5720d7f4eee781a9356',
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[FCM SW] Background message received:', payload);
    const notificationTitle = payload.notification?.title ?? 'Cronos';
    const notificationOptions = {
      body: payload.notification?.body ?? '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: payload.data,
      vibrate: [200, 100, 200],
      tag: payload.data?.bill_id ?? 'cronos',
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const billId = event.notification.data?.bill_id;
    const targetUrl = billId ? `./#/boletos/${billId}` : './#/';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
    );
  });
} catch (err) {
  console.warn('[PWA SW] FCM scripts initialization skipped/failed:', err);
}
