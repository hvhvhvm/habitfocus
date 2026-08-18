// Service Worker for Lock-In Protocol (Web Push, Background Sync & iOS Compatible Notifications)
const CACHE_NAME = 'lockin-protocol-v3';

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
    tag: `lockin-briefing-${Date.now()}`,
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = Object.assign(data, parsed);
    } catch (e) {
      try {
        data.body = event.data.text() || data.body;
      } catch (err) {}
    }
  }

  const notificationTitle = data.title || '⚡ Lock-In Protocol Daily Briefing';
  const notificationOptions = {
    body: data.body || 'Time to review your tasks and lock in!',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || `lockin-block-${Date.now()}`,
    renotify: true,
    data: {
      url: data.url || '/',
      dayNumber: data.dayNumber || 1,
      timeBlock: data.timeBlock || 'morning',
    },
  };

  // Safely include vibrate for browsers that support it (omitted on iOS WebKit if unsupported)
  if ('vibrate' in navigator) {
    notificationOptions.vibrate = [200, 100, 200, 100, 200];
  }

  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions).catch((err) => {
      // iOS WebKit fallback without extra options if strict validation fails
      return self.registration.showNotification(notificationTitle, {
        body: data.body || 'Lock-In Protocol Alert',
        icon: '/icon-192.png',
      });
    })
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

// Push Subscription Change Event (iOS / WebKit token refresh)
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.getSubscription().then((subscription) => {
      if (subscription) {
        // Broadcast new subscription to all clients so they can sync with backend
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'PUSH_SUBSCRIPTION_CHANGED',
              subscription: subscription.toJSON(),
            });
          });
        });
      }
    })
  );
});

// Client Message Event: Direct triggers and local notification dispatch
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, dayNumber, tag, url, timeBlock } = event.data;
    const nTitle = title || '⚡ Lock-In Protocol Daily Briefing';
    const nOpts = {
      body: body || 'Time to lock in and review your tasks!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag || `daily-protocol-${Date.now()}`,
      renotify: true,
      data: {
        url: url || '/',
        dayNumber: dayNumber || 1,
        timeBlock: timeBlock || 'morning',
      },
    };

    if ('vibrate' in navigator) {
      nOpts.vibrate = [200, 100, 200];
    }

    self.registration.showNotification(nTitle, nOpts).catch(() => {
      self.registration.showNotification(nTitle, {
        body: body || 'Lock-In Protocol Alert',
        icon: '/icon-192.png',
      });
    });
  }
});
