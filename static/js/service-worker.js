// static/js/service-worker.js

// Cache name for PWA
const CACHE_NAME = 'crapp-v1';

// Files to cache
const CACHE_FILES = [
  '/',
  '/login',
  '/register',
  '/profile',
  '/static/css/main.css',
  '/static/css/auth.css',
  '/static/css/profile.css',
  '/static/js/auth.js',
  '/static/js/form.js',
  '/static/js/profile.js',
  '/static/js/utils.js',
  '/static/icons/icon-192x192.png',
  '/static/icons/icon-512x512.png',
  '/static/icons/badge-96x96.png',
  '/static/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache opened');
        return cache.addAll(CACHE_FILES);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
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

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return the cached response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        // Make network request and cache the response
        return fetch(fetchRequest).then(
          (response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Open cache and store the response
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push received', event);

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    console.error('Error parsing push data', e);
    data = {
      title: 'CRAPP Notification',
      body: 'New notification from CRAPP',
    };
  }

  const options = {
    body: data.body || 'No message content',
    icon: data.icon || '/static/icons/icon-192x192.png',
    badge: data.badge || '/static/icons/badge-96x96.png',
    data: data.data || { url: '/' },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'CRAPP Notification', options)
  );
});

// Notification click event - open the app
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked', event);

  event.notification.close();

  // Try to get URL from notification data
  const urlToOpen = event.notification.data && event.notification.data.url ? 
    event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((windowClients) => {
        // Check if there is already a window/tab open with the target URL
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          // If so, focus it
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});