// Service Worker for Lock-In Protocol (Web Push & Background Notifications)
const CACHE_NAME = 'lockin-protocol-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push Event: Received push from backend even when browser/tab is closed
self.addEventListener('push', (event) => {
  let data = {
    title: '⚡ Lock-In Protocol: Tasks & Daily Protocol',
    body: 'Time to lock in! Review your scheduled protocol tasks.',
    dayNumber: 1,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url: '/',
    tag: 'lockin-scheduled-briefing',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = Object.assign(data, parsed);
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || `lockin-block-${Date.now()}`,
    renotify: true,
    data: {
      url: data.url || '/',
      dayNumber: data.dayNumber || 1,
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, notificationOptions)
  );
});

// Notification Click Event: Focus or Open Lock-In Web App
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Client Message Event: Direct triggers and local notification dispatch
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, dayNumber, tag } = event.data;
    self.registration.showNotification(title || '⚡ Lock-In Protocol Daily Briefing', {
      body: body || 'Time to lock in and review your tasks!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: tag || 'daily-protocol-briefing',
      renotify: true,
      data: {
        url: '/',
        dayNumber: dayNumber || 1,
      },
    });
  }
});


