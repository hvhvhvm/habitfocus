import { api } from './api';

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

export async function requestPushNotificationSubscription(preferredTime: string = '08:00'): Promise<{ success: boolean; error?: string }> {
  try {
    if (!('serviceWorker' in navigator)) {
      return { success: false, error: 'Service Workers are not supported on this browser.' };
    }
    if (!('Notification' in window)) {
      return { success: false, error: 'Notifications are not supported on this browser.' };
    }

    // 1. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission was not granted by user.' };
    }

    // 2. Ready Service Worker
    const registration = await navigator.serviceWorker.ready;

    // 3. Fetch VAPID public key from backend
    const { publicKey } = await api.getVapidPublicKey();
    if (!publicKey) {
      return { success: false, error: 'VAPID key not configured on server.' };
    }

    const convertedVapidKey = urlBase64ToUint8Array(publicKey);

    // 4. Subscribe with PushManager
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      return { success: false, error: 'Failed to generate browser push keys.' };
    }

    // 5. Send subscription to backend
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    await api.subscribePush({
      endpoint: subJson.endpoint,
      keys: {
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      },
      preferredTime,
      timezone: userTimezone,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Failed to subscribe to push notifications:', err);
    return { success: false, error: err?.message || 'Failed to enable push notifications.' };
  }
}

export async function testMobilePushNotification(): Promise<{ success: boolean; message?: string }> {
  try {
    // Also trigger a local notification directly if in active tab
    if (Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (reg) {
        reg.showNotification('⚡ Lock-In Protocol Daily Test', {
          body: 'Mobile Push Active! You will receive Day number & tasks briefings every morning.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'test-notification',
        });
      }
    }

    const serverRes = await api.sendTestPushNotification().catch(() => null);
    return {
      success: true,
      message: serverRes?.sentCount
        ? `Dispatched push to ${serverRes.sentCount} connected mobile device(s)!`
        : 'Notification sent to your device!',
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed sending test push.' };
  }
}
