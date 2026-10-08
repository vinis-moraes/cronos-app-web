// Firebase Messaging Service Worker
// Required for FCM push notifications in PWA

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

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title ?? 'Cronos';
  const notificationOptions = {
    body: payload.notification?.body ?? '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data,
    vibrate: [200, 100, 200],
    tag: payload.data?.bill_id ?? 'cronos',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — open the bill detail
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const billId = event.notification.data?.bill_id;
  const url = billId ? `/boletos/${billId}` : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
