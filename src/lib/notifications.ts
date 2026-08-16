import { api } from './api';

const DEFAULT_VAPID_PUBLIC_KEY = 'BMZiB3VFUwDpd0RUTX24kTrzKVQlrK2Ob1aOW3GS5kFzH2bGFUJA2_Gznq53tab7IAzHAAxZ-wkYWmC5t1YsZjY';

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

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js');
    }
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn('Could not get/register service worker:', err);
    return null;
  }
}

export async function ensurePushSubscriptionActive(): Promise<boolean> {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return false;
    }

    const reg = await getServiceWorkerRegistration();
    if (!reg || !('pushManager' in reg)) return false;

    let publicKey = DEFAULT_VAPID_PUBLIC_KEY;
    try {
      const vapidRes = await api.getVapidPublicKey().catch(() => null);
      if (vapidRes?.publicKey) publicKey = vapidRes.publicKey;
    } catch (e) {}

    const convertedVapidKey = urlBase64ToUint8Array(publicKey);
    let subscription = await reg.pushManager.getSubscription().catch(() => null);

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
    }

    const subJson = subscription.toJSON();
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    if (subJson?.endpoint && subJson?.keys?.p256dh && subJson?.keys?.auth) {
      await api.subscribePush({
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
        preferredTime: '07:00',
        timezone: userTimezone,
      });

      localStorage.setItem('lockin_push_sub', JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        isActive: true,
        updatedAt: new Date().toISOString(),
      }));
      return true;
    }
    return false;
  } catch (e) {
    console.warn('Auto-sync push subscription notice:', e);
    return false;
  }
}

export async function requestPushNotificationSubscription(preferredTime: string = '07:00'): Promise<{ success: boolean; error?: string }> {
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
    const registration = await getServiceWorkerRegistration();

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

    // 4. Web PushManager subscription
    if (registration && 'pushManager' in registration) {
      const convertedVapidKey = urlBase64ToUint8Array(publicKey);
      let subscription = await registration.pushManager.getSubscription().catch(() => null);

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      }
      subJson = subscription.toJSON();
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

    // 6. Sync to FastAPI backend and await confirmation
    if (subJson?.endpoint && subJson?.keys?.p256dh && subJson?.keys?.auth) {
      try {
        await api.subscribePush({
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
          preferredTime,
          timezone: userTimezone,
        });
      } catch (err) {
        console.warn('Backend push registration sync issue:', err);
      }
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
    api.sendTestPushNotification().catch(() => {});
    return { success: true, message: '⚡ Daily Briefing delivered to your phone lockscreen!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed delivering test notification.' };
  }
}

const TIME_BLOCK_META: Record<string, { name: string; icon: string; quotes: string[] }> = {
  morning: {
    name: 'Morning Lock-In',
    icon: '☀️',
    quotes: [
      'Win the morning, win the day. Eliminate distractions and execute.',
      'Discipline is choosing between what you want now and what you want most.',
      'The secret of getting ahead is getting started. Deep work begins now.',
      'Energy flows where attention goes. Protect your morning focus.',
    ],
  },
  afternoon: {
    name: 'Afternoon Momentum',
    icon: '✨',
    quotes: [
      'Midday check-in: Push through resistance. Champions build momentum when others fade.',
      'Consistency over intensity. Keep stacking daily wins.',
      "Don't stop when you're tired; stop when you're done.",
      'Small daily improvements over time lead to stunning transformations.',
    ],
  },
  evening: {
    name: 'Evening Surge',
    icon: '🌇',
    quotes: [
      'Finish the day strong. Review your goals and close all open loops.',
      "Discipline in the evening sets the foundation for tomorrow's victory.",
      'How you finish today determines how you start tomorrow.',
      'Reflect, review, and lock in your evening routines.',
    ],
  },
  night: {
    name: 'Night Protocol & Recovery',
    icon: '🌙',
    quotes: [
      "Rest is fuel for tomorrow's battle. Wind down and recharge.",
      "Celebrate today's wins, let go of the friction, and prepare your mindset.",
      'Sleep is the ultimate performance enhancer. Lock in your sleep protocol.',
      'Another day locked in. Recharge your mind for tomorrow.',
    ],
  },
};

export async function testTimeBlockNotification(
  timeBlock: string,
  opts?: {
    dayNumber?: number;
    totalDays?: number;
    streakDays?: number;
    tasks?: Array<{ name: string; timeBlock?: string; completed?: boolean }>;
  }
): Promise<{ success: boolean; message?: string }> {
  try {
    const meta = TIME_BLOCK_META[timeBlock] || TIME_BLOCK_META['morning'];
    const quote = meta.quotes[Math.floor(Math.random() * meta.quotes.length)];

    let dayNum = opts?.dayNumber || 1;
    let totalDays = opts?.totalDays || 90;
    let streak = opts?.streakDays || 1;
    let tasksList = opts?.tasks || [];

    if (tasksList.length === 0) {
      try {
        const savedTasks = localStorage.getItem('lockin_tasks');
        if (savedTasks) tasksList = JSON.parse(savedTasks);
      } catch (e) {}
    }

    const uncompleted = tasksList.filter((t: any) => !t.completed);
    const blockTasks = uncompleted.filter(
      (t: any) => (t.timeBlock || 'morning').toLowerCase() === timeBlock
    );
    const blockCount = blockTasks.length;
    const totalRemaining = uncompleted.length;

    let proteinGoal = 140;
    let totalProtein = 0;
    try {
      const savedGoal = localStorage.getItem('lockin_protein_goal');
      if (savedGoal) proteinGoal = Number(savedGoal) || 140;
      const savedLogs = localStorage.getItem('lockin_protein_entries');
      if (savedLogs) {
        const parsed = JSON.parse(savedLogs);
        if (Array.isArray(parsed)) {
          totalProtein = parsed.reduce((sum: number, item: any) => sum + (Number(item.protein_grams || item.grams || 0) || 0), 0);
        }
      }
    } catch (e) {}

    const remProtein = Math.max(0, proteinGoal - totalProtein);
    let proteinLine = '';
    if (timeBlock === 'morning') {
      proteinLine = `🥩 Protein Goal: ${proteinGoal}g`;
    } else if (timeBlock === 'afternoon') {
      proteinLine = totalProtein >= proteinGoal
        ? `🥩 Protein: ${totalProtein}g/${proteinGoal}g (Goal Met! 🏆)`
        : `🥩 Protein: ${totalProtein}g/${proteinGoal}g (${remProtein}g left for lunch/snacks)`;
    } else if (timeBlock === 'evening') {
      proteinLine = totalProtein >= proteinGoal
        ? `🥩 Protein: ${totalProtein}g/${proteinGoal}g (Goal Met! 🏆)`
        : `🥩 Protein: ${totalProtein}g/${proteinGoal}g (${remProtein}g left — time for dinner/shake!)`;
    } else {
      proteinLine = totalProtein >= proteinGoal
        ? `🥩 Protein: ${totalProtein}g/${proteinGoal}g (+20 PTS Earned! 🏆)`
        : `🥩 Protein: ${totalProtein}g/${proteinGoal}g (${remProtein}g remaining today)`;
    }

    const title = `${meta.icon} ${meta.name} — Day ${dayNum} of ${totalDays}`;
    let body = '';

    if (blockCount === 0 && totalRemaining === 0) {
      body = `Day ${dayNum}: All tasks 100% done! 🏆\n${proteinLine}\n💡 "${quote}"\n🔥 Streak: ${streak} days. Incredible discipline!`;
    } else if (blockCount === 0) {
      body = `Day ${dayNum}: All ${meta.name} tasks finished! (${totalRemaining} left in other blocks)\n${proteinLine}\n💡 "${quote}"\n🔥 Streak: ${streak} days active.`;
    } else {
      const preview = blockTasks
        .slice(0, 2)
        .map((t: any) => `• ${t.name}`)
        .join('\n');
      const extra = blockCount > 2 ? `\n• +${blockCount - 2} more` : '';
      body = `Day ${dayNum}: ${blockCount} ${timeBlock.charAt(0).toUpperCase() + timeBlock.slice(1)} task${blockCount !== 1 ? 's' : ''} (${totalRemaining} left today):\n${preview}${extra}\n${proteinLine}\n💡 "${quote}"\n🔥 Streak: ${streak} days. Lock in!`;
    }

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200],
          tag: `block-briefing-${timeBlock}`,
          renotify: true,
          data: { url: '/', dayNumber: dayNum },
        });
      }
    }

    // Also attempt backend dispatch (non-blocking)
    api.sendTestBlockPushNotification(timeBlock).catch(() => {});

    return { success: true, message: `${meta.icon} ${meta.name} briefing sent to your phone!` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed sending time-block notification.' };
  }
}
