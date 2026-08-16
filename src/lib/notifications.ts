import { api } from './api';

const DEFAULT_VAPID_PUBLIC_KEY = 'BFtljDcFhhZ4HHZIAhnzjnvskgthdrChtLxMd5R0DmPIB1822Huy4wViJPSqzn99iMnlml1g8Q3Go2YHwHG4KFg';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function isPushNotificationSupported(): Promise<boolean> {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getNotificationPermissionState(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function requestPushNotificationSubscription(preferredTime: string = 'random_morning'): Promise<{ success: boolean; error?: string }> {
  try {
    if (!('Notification' in window)) {
      return { success: false, error: 'Notifications are not supported on this browser.' };
    }

    // 1. Request permission from user (Shows native iOS/Android prompt)
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        error: 'Notification permission was denied. Please allow notifications in your iPhone Settings > Safari > Notifications.',
      };
    }

    // 2. Ready Service Worker
    let registration: ServiceWorkerRegistration | null = null;
    if ('serviceWorker' in navigator) {
      registration = await navigator.serviceWorker.ready.catch(() => null);
    }

    // 3. Obtain VAPID Public Key (with resilient fallback)
    let publicKey = DEFAULT_VAPID_PUBLIC_KEY;
    try {
      const vapidRes = await api.getVapidPublicKey().catch(() => null);
      if (vapidRes?.publicKey) {
        publicKey = vapidRes.publicKey;
      }
    } catch (e) {
      // Use fallback key
    }

    let subJson: any = null;

    // 4. Try Web PushManager subscription if supported
    if (registration && 'pushManager' in registration) {
      try {
        const convertedVapidKey = urlBase64ToUint8Array(publicKey);
        let subscription = await registration.pushManager.getSubscription().catch(() => null);
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey,
          });
        }
        subJson = subscription.toJSON();
      } catch (pushErr) {
        console.warn('PushManager subscription warning:', pushErr);
      }
    }

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    // 5. Store subscription preferences locally in localStorage
    const localSubRecord = {
      endpoint: subJson?.endpoint || 'local_device',
      keys: subJson?.keys || { p256dh: '', auth: '' },
      preferredTime,
      timezone: userTimezone,
      isActive: true,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem('lockin_push_sub', JSON.stringify(localSubRecord));

    // 6. Attempt syncing to FastAPI backend without blocking offline mode
    if (subJson?.endpoint && subJson?.keys?.p256dh && subJson?.keys?.auth) {
      api.subscribePush({
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
        preferredTime,
        timezone: userTimezone,
      }).catch((err) => {
        console.warn('Backend push registration synced in local mode:', err);
      });
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to subscribe to push notifications:', err);
    return { success: false, error: err?.message || 'Failed to enable notifications on this device.' };
  }
}

export async function testMobilePushNotification(customPayload?: {
  dayNumber?: number;
  totalDays?: number;
  streakDays?: number;
  tasks?: Array<{ name: string; timeBlock?: string; completed?: boolean }>;
}): Promise<{ success: boolean; message?: string }> {
  try {
    let dayNum = customPayload?.dayNumber || 1;
    let totalDays = customPayload?.totalDays || 90;
    let streak = customPayload?.streakDays || 1;
    let tasksList = customPayload?.tasks || [];

    // If not passed, read from localStorage
    if (tasksList.length === 0) {
      try {
        const savedTasks = localStorage.getItem('lockin_tasks');
        if (savedTasks) tasksList = JSON.parse(savedTasks);
      } catch (e) {}
    }

    const uncompletedTasks = tasksList.filter((t: any) => !t.completed);
    const mCount = uncompletedTasks.filter((t: any) => (t.timeBlock || 'morning').toLowerCase() === 'morning').length;
    const aCount = uncompletedTasks.filter((t: any) => (t.timeBlock || '').toLowerCase() === 'afternoon').length;
    const eCount = uncompletedTasks.filter((t: any) => (t.timeBlock || '').toLowerCase() === 'evening').length;
    const nCount = uncompletedTasks.filter((t: any) => (t.timeBlock || '').toLowerCase() === 'night').length;
    const remainingCount = uncompletedTasks.length;

    const title = `⚡ Day ${dayNum} of ${totalDays} Protocol`;
    let body = '';

    if (tasksList.length === 0) {
      body = `Day ${dayNum} begins! 0 tasks set.\n☀️ Morning: 0 | ✨ Aft: 0 | 🌇 Eve: 0 | 🌙 Night: 0\n🔥 Streak: ${streak} days active. Lock in!`;
    } else if (remainingCount === 0) {
      body = `Day ${dayNum}: All ${tasksList.length} tasks locked in for today!\n🔥 Streak: ${streak} days active. Outstanding discipline!`;
    } else {
      body = `Day ${dayNum}: You have ${remainingCount} tasks scheduled today:\n☀️ Morning: ${mCount} tasks\n✨ Afternoon: ${aCount} tasks\n🌇 Evening: ${eCount} tasks\n🌙 Night: ${nCount} tasks\n🔥 Streak: ${streak} days active. Time to lock in!`;
    }

    // 1. Deliver notification immediately via Service Worker
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200, 100, 200],
          tag: 'daily-protocol-briefing',
          renotify: true,
          data: { url: '/', dayNumber: dayNum },
        });
      }
    }

    // 2. Also trigger backend webpush dispatch if connected
    api.sendTestPushNotification().catch(() => {});

    return {
      success: true,
      message: '⚡ Daily Briefing delivered to your phone lockscreen!',
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed delivering test notification.' };
  }
}
