const CACHE_NAME = 'crapp-v1';

// Cache files list
const CACHE_FILES = [
  '/',
  '/static/css/main.css',
  '/static/css/auth.css',
  '/static/css/profile.css',
  '/static/js/core/utils.js',
  '/static/js/core/api.js',
  '/static/js/core/auth.js',
  '/static/icons/icon-192x192.png',
  '/static/icons/icon-512x512.png',
  '/static/icons/badge-96x96.png'
];

// Install event
self.addEventListener('install', (event) => {   
  // IMPORTANT: The entire promise chain must be inside waitUntil()
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(CACHE_FILES);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[ServiceWorker] Install error:', error);
        // Return a resolved promise even on error to complete installation
        return Promise.resolve();
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {    
  // IMPORTANT: Chain all promises inside waitUntil
  event.waitUntil(
    Promise.all([
      // Clean up caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim clients
      clients.claim()
    ])
    .catch(error => {
      console.error('[ServiceWorker] Activation error:', error);
      return Promise.resolve();
    })
  );
});

// Fetch event - implement a cache-first strategy
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Skip API requests - don't cache them
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Handle requests with a cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        return fetch(event.request)
          .then(response => {
            // Clone the response since it can only be consumed once
            const responseToCache = response.clone();
            
            // Check if valid response to cache
            if (response.status === 200 && response.type === 'basic') {
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }
            
            return response;
          })
          .catch(error => {
            console.error('[ServiceWorker] Fetch error:', error);
            // Add fallback behavior here if needed
          });
      })
  );
});

// Push event
self.addEventListener('push', (event) => {  
  // Parse notification data
  let data = {
    title: 'CRAPP Notification',
    body: 'Time to complete your assessment!',
    icon: '/static/icons/icon-192x192.png',
    badge: '/static/icons/badge-96x96.png',
  };
  
  try {
    if (event.data) {
        const payload = event.data.text();
        const jsonData = JSON.parse(payload);
        data = { ...data, ...jsonData };
    }
  } catch (e) {
      console.error('[ServiceWorker] Push data parsing error:', e);
  }
  
  // CRITICAL: Use waitUntil to keep service worker alive until notification is shown
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      data: { url: data.url || '/' }
    })
    .catch(error => {
      console.error('[ServiceWorker] Show notification error:', error);
      return Promise.resolve();
    })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {   
  event.notification.close();
  
  // IMPORTANT: Use waitUntil here too
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(windowClients => {
        // Find existing window to focus
        for (const client of windowClients) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window found, open a new one
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
      .catch(error => {
        console.error('[ServiceWorker] Notification click handling error:', error);
        return Promise.resolve();
      })
  );
});