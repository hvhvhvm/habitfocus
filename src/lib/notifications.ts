import { api } from './api';

export const DEFAULT_VAPID_PUBLIC_KEY = 'BMZiB3VFUwDpd0RUTX24kTrzKVQlrK2Ob1aOW3GS5kFzH2bGFUJA2_Gznq53tab7IAzHAAxZ-wkYWmC5t1YsZjY';

export interface NotificationScheduleConfig {
  preferredTime: string;
  morningTime: string;
  afternoonTime: string;
  eveningTime: string;
  nightTime: string;
  notifyMorning: boolean;
  notifyAfternoon: boolean;
  notifyEvening: boolean;
  notifyNight: boolean;
}

export const DEFAULT_SCHEDULE_CONFIG: NotificationScheduleConfig = {
  preferredTime: '07:00',
  morningTime: '07:00',
  afternoonTime: '12:30',
  eveningTime: '17:30',
  nightTime: '21:30',
  notifyMorning: true,
  notifyAfternoon: true,
  notifyEvening: true,
  notifyNight: true,
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

export async function isPushNotificationSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'Notification' in window;
}

export function getNotificationPermissionState(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  return Notification.permission;
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn('Service worker registration notice:', err);
    return null;
  }
}

export function getLocalScheduleConfig(): NotificationScheduleConfig {
  try {
    const saved = localStorage.getItem('lockin_schedule_config');
    if (saved) {
      return { ...DEFAULT_SCHEDULE_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {}
  return DEFAULT_SCHEDULE_CONFIG;
}

export function saveLocalScheduleConfig(config: Partial<NotificationScheduleConfig>): NotificationScheduleConfig {
  const current = getLocalScheduleConfig();
  const updated = { ...current, ...config };
  try {
    localStorage.setItem('lockin_schedule_config', JSON.stringify(updated));
  } catch (e) {}
  return updated;
}

export async function ensurePushSubscriptionActive(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
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
      }).catch((subErr) => {
        console.warn('PushManager subscription notice:', subErr);
        return null;
      });
    }

    if (!subscription) return false;

    const subJson = subscription.toJSON();
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const schedule = getLocalScheduleConfig();

    if (subJson?.endpoint && subJson?.keys?.p256dh && subJson?.keys?.auth) {
      await api.subscribePush({
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
        preferredTime: schedule.preferredTime || schedule.morningTime || '07:00',
        morningTime: schedule.morningTime || '07:00',
        afternoonTime: schedule.afternoonTime || '12:30',
        eveningTime: schedule.eveningTime || '17:30',
        nightTime: schedule.nightTime || '21:30',
        notifyMorning: schedule.notifyMorning,
        notifyAfternoon: schedule.notifyAfternoon,
        notifyEvening: schedule.notifyEvening,
        notifyNight: schedule.notifyNight,
        timezone: userTimezone,
      }).catch(() => {});

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
    console.warn('Push sync notice:', e);
    return false;
  }
}

/**
 * iOS & Safari compatible Permission Requester & Push Subscriber
 */
export async function requestPushNotificationSubscription(customSchedule?: Partial<NotificationScheduleConfig>): Promise<{ success: boolean; error?: string }> {
  try {
    const isIOS = isIOSDevice();
    const isStandalone = isStandalonePWA();

    if (!('Notification' in window)) {
      if (isIOS) {
        return {
          success: false,
          error: 'On iPhone / iPad, Apple requires adding Lock-In to your Home Screen first. Tap Share (⬆️) > "Add to Home Screen" (+), then open the app and tap Enable.',
        };
      }
      return { success: false, error: 'Notifications are not supported by this browser.' };
    }

    // 1. Direct synchronous user-gesture request (Dual Promise / Callback compatible for all iOS Safari versions)
    let permission: NotificationPermission = 'default';
    if (typeof Notification.requestPermission === 'function') {
      try {
        const pResult = Notification.requestPermission();
        if (pResult && typeof (pResult as any).then === 'function') {
          permission = await pResult;
        } else {
          permission = await new Promise<NotificationPermission>((resolve) => {
            Notification.requestPermission((p) => resolve(p));
          });
        }
      } catch (reqErr) {
        console.warn('requestPermission call error:', reqErr);
      }
    }

    if (permission !== 'granted') {
      if (isIOS && !isStandalone) {
        return {
          success: false,
          error: 'Notification permission requires Home Screen installation on iOS. Tap Share (⬆️) > "Add to Home Screen", open the Home Screen icon, and tap Enable.',
        };
      }
      return {
        success: false,
        error: 'Notification permission was denied. Please allow notifications in device Settings.',
      };
    }

    // 2. Ready Service Worker
    const registration = await getServiceWorkerRegistration();

    // 3. Obtain VAPID Public Key
    let publicKey = DEFAULT_VAPID_PUBLIC_KEY;
    try {
      const vapidRes = await api.getVapidPublicKey().catch(() => null);
      if (vapidRes?.publicKey) {
        publicKey = vapidRes.publicKey;
      }
    } catch (e) {}

    let subJson: any = null;

    // 4. Web PushManager subscription
    if (registration && 'pushManager' in registration) {
      try {
        const convertedVapidKey = urlBase64ToUint8Array(publicKey);
        let subscription = await registration.pushManager.getSubscription().catch(() => null);

        if (subscription) {
          try {
            subJson = subscription.toJSON();
          } catch (e) {
            await subscription.unsubscribe().catch(() => {});
            subscription = null;
          }
        }

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey,
          });
        }
        if (subscription) {
          subJson = subscription.toJSON();
        }
      } catch (pushErr) {
        console.warn('PushManager registration notice (local notifications remain active):', pushErr);
      }
    }

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const schedule = saveLocalScheduleConfig(customSchedule || {});

    // 5. Store subscription record in localStorage
    const localSubRecord = {
      endpoint: subJson?.endpoint || 'local_device',
      keys: subJson?.keys || { p256dh: '', auth: '' },
      preferredTime: schedule.morningTime || '07:00',
      morningTime: schedule.morningTime || '07:00',
      afternoonTime: schedule.afternoonTime || '12:30',
      eveningTime: schedule.eveningTime || '17:30',
      nightTime: schedule.nightTime || '21:30',
      timezone: userTimezone,
      isActive: true,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem('lockin_push_sub', JSON.stringify(localSubRecord));

    // 6. Sync to FastAPI backend (if endpoint available)
    if (subJson?.endpoint && subJson?.keys?.p256dh && subJson?.keys?.auth) {
      try {
        await api.subscribePush({
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
          preferredTime: schedule.preferredTime || schedule.morningTime || '07:00',
          morningTime: schedule.morningTime || '07:00',
          afternoonTime: schedule.afternoonTime || '12:30',
          eveningTime: schedule.eveningTime || '17:30',
          nightTime: schedule.nightTime || '21:30',
          notifyMorning: schedule.notifyMorning,
          notifyAfternoon: schedule.notifyAfternoon,
          notifyEvening: schedule.notifyEvening,
          notifyNight: schedule.notifyNight,
          timezone: userTimezone,
        });
      } catch (err) {
        console.warn('Backend push sync notice:', err);
      }
    }

    // Start local background ticker immediately
    initLocalNotificationScheduler();

    return { success: true };
  } catch (err: any) {
    console.error('Failed to subscribe to notifications:', err);
    return { success: false, error: err?.message || 'Failed to enable notifications on this device.' };
  }
}

// ---------------------------------------------------------------------------
// Client-Side In-App Notification Scheduler (Dual Reliability Ticker)
// ---------------------------------------------------------------------------
let localSchedulerInterval: any = null;
let listenersInitialized = false;

function timeToMinutes(timeStr: string): number {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function evaluateAndDispatchScheduledAlerts(): void {
  try {
    if (getNotificationPermissionState() !== 'granted') return;

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const todayDateStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

    const schedule = getLocalScheduleConfig();

    const morningMins = timeToMinutes(schedule.morningTime || schedule.preferredTime || '07:00');
    const afternoonMins = timeToMinutes(schedule.afternoonTime || '12:30');
    const eveningMins = timeToMinutes(schedule.eveningTime || '17:30');
    const nightMins = timeToMinutes(schedule.nightTime || '21:30');

    const blocksToCheck = [
      {
        block: 'morning',
        enabled: schedule.notifyMorning !== false,
        targetMins: morningMins,
      },
      {
        block: 'afternoon',
        enabled: schedule.notifyAfternoon !== false,
        targetMins: afternoonMins,
      },
      {
        block: 'evening',
        enabled: schedule.notifyEvening !== false,
        targetMins: eveningMins,
      },
      {
        block: 'night',
        enabled: schedule.notifyNight !== false,
        targetMins: nightMins,
      },
    ];

    for (const item of blocksToCheck) {
      if (!item.enabled) continue;

      const sentKey = `lockin_local_sent_${item.block}_${todayDateStr}`;
      const isAlreadySent = localStorage.getItem(sentKey) === 'true';
      if (isAlreadySent) continue;

      // Only dispatch if current time is within 1 minute of the exact scheduled target time
      const isExactTargetMinute = Math.abs(currentMins - item.targetMins) <= 1;

      // If user opened the app well past the scheduled time (e.g. >5 mins later), mark as past/handled without blasting a notification
      if (currentMins > item.targetMins + 5) {
        localStorage.setItem(sentKey, 'true');
        continue;
      }

      // If the app is currently in the foreground (user is actively using it), don't show an OS popup
      const isAppInForeground = typeof document !== 'undefined' && document.visibilityState === 'visible';

      if (isExactTargetMinute && !isAppInForeground) {
        localStorage.setItem(sentKey, 'true');
        testTimeBlockNotification(item.block);
      }
    }
  } catch (e) {
    console.warn('Local notification check notice:', e);
  }
}

export function initLocalNotificationScheduler(): void {
  if (typeof window === 'undefined') return;

  if (!localSchedulerInterval) {
    // Check every 30 seconds for scheduled target time match
    localSchedulerInterval = setInterval(evaluateAndDispatchScheduledAlerts, 30000);
  }

  if (!listenersInitialized) {
    listenersInitialized = true;

    // Listen for push subscription renewal from ServiceWorker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') {
          ensurePushSubscriptionActive().catch(() => {});
        }
      });
    }
  }
}

export interface CustomNotificationOptions extends NotificationOptions {
  renotify?: boolean;
  vibrate?: number[];
}

/**
 * Universal Notification Dispatcher (Service Worker + In-App Fallback)
 */
async function showNotificationSafely(title: string, options: CustomNotificationOptions): Promise<boolean> {
  try {
    if ('serviceWorker' in navigator) {
      let reg = await navigator.serviceWorker.ready.catch(() => null);
      if (!reg) {
        reg = await getServiceWorkerRegistration();
      }
      if (reg && 'showNotification' in reg) {
        // Sanitize options for iOS WebKit
        const cleanOpts: any = {
          body: options.body || '',
          icon: options.icon || '/icon-192.png',
          badge: options.badge || '/icon-192.png',
          tag: options.tag || `lockin-${Date.now()}`,
          renotify: options.renotify !== false,
          data: options.data || {},
        };

        if ('vibrate' in navigator && options.vibrate) {
          cleanOpts.vibrate = options.vibrate;
        }

        await reg.showNotification(title, cleanOpts);
        return true;
      }
    }

    // Fallback if service worker is not ready on desktop browsers
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: options.body,
          icon: options.icon || '/icon-192.png',
        });
        return true;
      } catch (e) {}
    }
    return false;
  } catch (err) {
    console.warn('showNotificationSafely notice:', err);
    return false;
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

    await showNotificationSafely(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'daily-protocol-briefing',
      renotify: true,
      data: { url: '/', dayNumber: dayNum },
    });

    api.sendTestPushNotification().catch(() => {});
    return { success: true, message: '⚡ Daily Briefing delivered to your device lockscreen!' };
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
        : `🥩 Protein: ${totalProtein}g/${proteinGoal}g (${remProtein}g left — dinner/shake)`;
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

    await showNotificationSafely(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `block-briefing-${timeBlock}`,
      renotify: true,
      data: { url: '/', dayNumber: dayNum, timeBlock },
    });

    // Also attempt backend dispatch (non-blocking)
    api.sendTestBlockPushNotification(timeBlock).catch(() => {});

    return { success: true, message: `${meta.icon} ${meta.name} briefing sent to your device!` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed sending time-block notification.' };
  }
}
