// Service Worker for Lock-In Protocol (Web Push & Background Notifications)
const CACHE_NAME = 'lockin-protocol-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push Event: Received push from backend even when browser/tab is closed
self.addEventListener('push', (event) => {
  let data = {
    title: '⚡ Lock-In Protocol: Daily Tasks Briefing',
    body: 'Time to lock in! Open your protocol to review today’s scheduled habits & tasks.',
    dayNumber: 1,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url: '/',
  };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'daily-protocol-briefing',
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || '/',
      dayNumber: data.dayNumber || 1,
    },
    actions: [
      { action: 'open_protocol', title: '⚡ Open Protocol' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
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
    const { title, body, dayNumber } = event.data;
    self.registration.showNotification(title || '⚡ Lock-In Protocol Daily Briefing', {
      body: body || 'Time to lock in and review your tasks!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: 'daily-protocol-briefing',
      renotify: true,
      data: {
        url: '/',
        dayNumber: dayNumber || 1,
      },
      actions: [
        { action: 'open_protocol', title: '⚡ Open Protocol' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    });
  }
});

