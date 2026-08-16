import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  requestPushNotificationSubscription,
  testMobilePushNotification,
  getNotificationPermissionState,
} from '../../lib/notifications';
import {
  Bell,
  BellRing,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  X,
  Share2,
  PlusSquare,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export const NotificationSettingsModal: React.FC = () => {
  const { isNotificationModalOpen, setIsNotificationModalOpen, tasks } = useApp();
  const { user } = useAuth();

  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [preferredTime, setPreferredTime] = useState<string>('08:00');
  const [isEnabling, setIsEnabling] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testStatusMessage, setTestStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isNotificationModalOpen) return;
    setPermissionState(getNotificationPermissionState());

    api.getNotificationStatus()
      .then((res) => {
        setIsSubscribed(res.isSubscribed);
        if (res.preferredTime) setPreferredTime(res.preferredTime);
      })
      .catch(() => {});
  }, [isNotificationModalOpen]);

  if (!isNotificationModalOpen) return null;

  const handleEnablePush = async () => {
    setIsEnabling(true);
    setErrorMessage(null);
    setTestStatusMessage(null);

    const result = await requestPushNotificationSubscription(preferredTime);
    setIsEnabling(false);

    if (result.success) {
      setIsSubscribed(true);
      setPermissionState(getNotificationPermissionState());
      setTestStatusMessage('✅ Daily mobile notifications enabled successfully! Sending test briefing...');
      await handleSendTestPush();
    } else {
      setErrorMessage(result.error || 'Could not enable push notifications. Check browser permissions.');
    }
  };

  const handleSendTestPush = async () => {
    setIsTesting(true);
    setTestStatusMessage(null);
    setErrorMessage(null);

    const res = await testMobilePushNotification({
      dayNumber: user?.dayNumber || 1,
      totalDays: user?.totalDaysGoal || 90,
      streakDays: user?.streakDays || 1,
      tasks,
    });
    setIsTesting(false);

    if (res.success) {
      setTestStatusMessage(res.message || '⚡ Notification delivered to your phone!');
    } else {
      setErrorMessage(res.message || 'Failed delivering test notification.');
    }
  };

  const handleUnsubscribe = async () => {
    try {
      await api.unsubscribePush();
      setIsSubscribed(false);
      setTestStatusMessage('Unsubscribed from daily push notifications.');
    } catch (e) {
      console.error(e);
    }
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0F1512] border border-[#26332C] rounded-3xl p-5 sm:p-6 text-[#F4F6F5] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Ambient Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#3ECF8E]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#26332C]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#3ECF8E]/15 border border-[#3ECF8E]/30 flex items-center justify-center text-[#3ECF8E]">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-space font-bold text-lg text-[#F4F6F5]">
                Daily Mobile Push Notifications
              </h2>
              <p className="font-mono-code text-[11px] text-[#8A9891]">
                Day number & tasks briefings even when browser is closed
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsNotificationModalOpen(false)}
            className="text-[#8A9891] hover:text-[#F4F6F5] p-1.5 rounded-xl hover:bg-[#16201B] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1 text-xs">
          {/* Status Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              isSubscribed
                ? 'bg-[#3ECF8E]/10 border-[#3ECF8E]/30 text-[#3ECF8E]'
                : 'bg-[#16201B] border-[#26332C] text-[#8A9891]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  isSubscribed ? 'bg-[#3ECF8E] animate-ping' : 'bg-[#5E6D66]'
                }`}
              />
              <div>
                <div className="font-space font-bold text-sm text-[#F4F6F5]">
                  {isSubscribed ? 'Daily Phone Notifications Active' : 'Daily Notifications Inactive'}
                </div>
                <div className="text-[11px] font-mono-code text-[#8A9891]">
                  {isSubscribed
                    ? `Scheduled every morning at ${preferredTime} in your local timezone`
                    : 'Enable below to receive your daily morning protocol'}
                </div>
              </div>
            </div>

            {isSubscribed && (
              <button
                onClick={handleUnsubscribe}
                className="text-[11px] text-[#FF5B5B] hover:underline font-mono-code cursor-pointer"
              >
                Disable
              </button>
            )}
          </div>

          {/* iOS / PWA Installation Hint */}
          {isIOS && !isStandalone && (
            <div className="p-3.5 bg-[#16201B] border border-[#F5A623]/30 rounded-2xl text-xs space-y-2">
              <div className="flex items-center gap-2 text-[#F5A623] font-semibold font-space">
                <Smartphone className="w-4 h-4" /> iPhone Setup Required for Closed Browser Alerts
              </div>
              <p className="text-[11px] text-[#8A9891] leading-relaxed">
                Apple requires installing this app to your Home Screen to deliver push notifications when Safari is closed:
              </p>
              <div className="flex items-center gap-2 text-[11px] font-mono-code bg-[#0F1512] p-2 rounded-xl border border-[#26332C]">
                <span>1. Tap Safari Share <Share2 className="w-3.5 h-3.5 inline text-[#3ECF8E]" /></span>
                <span>➔</span>
                <span>2. Tap <PlusSquare className="w-3.5 h-3.5 inline text-[#3ECF8E]" /> "Add to Home Screen"</span>
              </div>
            </div>
          )}

          {/* Time Preference */}
          <div className="bg-[#16201B] border border-[#26332C] rounded-2xl p-4 space-y-3">
            <label className="font-space font-semibold text-sm text-[#F4F6F5] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#3ECF8E]" /> Daily Morning Delivery Time
            </label>
            <p className="text-[11px] text-[#8A9891]">
              Choose a specific morning time or select random morning time (between 06:30 AM – 09:00 AM) to receive your daily day number and task breakdown.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'random_morning', label: '🎲 Random Morning (6:30-9 AM)' },
                { id: '06:30', label: '06:30 AM' },
                { id: '07:00', label: '07:00 AM' },
                { id: '07:30', label: '07:30 AM' },
                { id: '08:00', label: '08:00 AM' },
                { id: '09:00', label: '09:00 AM' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setPreferredTime(opt.id)}
                  className={`py-2 px-2.5 rounded-xl font-mono-code text-xs text-center border transition-all cursor-pointer ${
                    preferredTime === opt.id
                      ? 'bg-[#3ECF8E] text-[#0B1510] font-bold border-[#3ECF8E]'
                      : 'bg-[#0F1512] text-[#8A9891] border-[#26332C] hover:border-[#3ECF8E]/40'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Notification Preview */}
          <div className="bg-[#16201B] border border-[#26332C] rounded-2xl p-4 space-y-2.5">
            <div className="font-mono-code text-[11px] uppercase tracking-wider text-[#8A9891] flex items-center justify-between">
              <span>Preview Daily Phone Alert</span>
              <span className="text-[#3ECF8E]">Lockscreen Format</span>
            </div>

            <div className="bg-[#0F1512] border border-[#26332C] rounded-2xl p-3.5 shadow-inner">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#3ECF8E] text-[#0B1510] flex items-center justify-center font-bold text-sm shrink-0">
                  ⚡
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-space font-bold text-xs text-[#F4F6F5]">
                      Day {user?.dayNumber || 1} of {user?.totalDaysGoal || 90} Protocol
                    </span>
                    <span className="text-[10px] font-mono-code text-[#5E6D66]">
                      {preferredTime === 'random_morning' ? 'Random AM' : `${preferredTime} AM`}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#8A9891] mt-1.5 font-mono-code whitespace-pre-line leading-relaxed">
                    {`Day ${user?.dayNumber || 1}: You have ${tasks.filter((t) => !t.completed).length} tasks scheduled today:\n` +
                      `☀️ Morning: ${tasks.filter((t) => !t.completed && (t.timeBlock || 'morning').toLowerCase() === 'morning').length} tasks\n` +
                      `✨ Afternoon: ${tasks.filter((t) => !t.completed && (t.timeBlock || '').toLowerCase() === 'afternoon').length} tasks\n` +
                      `🌇 Evening: ${tasks.filter((t) => !t.completed && (t.timeBlock || '').toLowerCase() === 'evening').length} tasks\n` +
                      `🌙 Night: ${tasks.filter((t) => !t.completed && (t.timeBlock || '').toLowerCase() === 'night').length} tasks\n` +
                      `🔥 Streak: ${user?.streakDays || 1} days active. Time to lock in!`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback messages */}
          {testStatusMessage && (
            <div className="p-3 bg-[#3ECF8E]/10 border border-[#3ECF8E]/30 rounded-xl text-xs text-[#3ECF8E] font-mono-code flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{testStatusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-[#FF5B5B]/10 border border-[#FF5B5B]/30 rounded-xl text-xs text-[#FF5B5B] font-mono-code flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Action Buttons */}
        <div className="pt-3 border-t border-[#26332C] flex flex-col sm:flex-row gap-2">
          {!isSubscribed ? (
            <button
              onClick={handleEnablePush}
              disabled={isEnabling}
              className="flex-1 bg-[#3ECF8E] hover:bg-[#32B87C] text-[#0B1510] font-space font-bold text-sm py-3 px-4 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              <Bell className="w-4 h-4" />
              {isEnabling ? 'Enabling Daily Alerts...' : 'Enable Daily Mobile Notifications'}
            </button>
          ) : (
            <button
              onClick={handleSendTestPush}
              disabled={isTesting}
              className="flex-1 bg-[#3ECF8E] hover:bg-[#32B87C] text-[#0B1510] font-space font-bold text-sm py-3 px-4 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isTesting ? 'Sending Notification to Phone...' : '📲 Send Test Notification to Phone'}
            </button>
          )}

          <button
            onClick={() => setIsNotificationModalOpen(false)}
            className="bg-[#16201B] hover:bg-[#1D2922] border border-[#26332C] text-[#F4F6F5] font-space text-xs py-3 px-4 rounded-2xl transition-colors cursor-pointer text-center"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
