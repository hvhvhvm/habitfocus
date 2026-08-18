import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  requestPushNotificationSubscription,
  ensurePushSubscriptionActive,
  testMobilePushNotification,
  testTimeBlockNotification,
  getNotificationPermissionState,
  getLocalScheduleConfig,
  saveLocalScheduleConfig,
  NotificationScheduleConfig,
  isIOSDevice,
  isStandalonePWA,
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
  Globe,
  Save,
  Sparkles,
} from 'lucide-react';

export const NotificationSettingsModal: React.FC = () => {
  const { isNotificationModalOpen, setIsNotificationModalOpen, tasks } = useApp();
  const { user } = useAuth();

  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [scheduleConfig, setScheduleConfig] = useState<NotificationScheduleConfig>(getLocalScheduleConfig());
  const [isEnabling, setIsEnabling] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testingBlock, setTestingBlock] = useState<string | null>(null);
  const [testStatusMessage, setTestStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const isIOS = isIOSDevice();
  const isStandalone = isStandalonePWA();

  useEffect(() => {
    if (!isNotificationModalOpen) return;
    const perm = getNotificationPermissionState();
    setPermissionState(perm);

    const localConfig = getLocalScheduleConfig();
    setScheduleConfig(localConfig);

    let localActive = false;
    try {
      const saved = localStorage.getItem('lockin_push_sub');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.isActive) localActive = true;
      }
    } catch (e) {}

    if (perm === 'granted' || localActive) {
      setIsSubscribed(true);
      ensurePushSubscriptionActive().catch(() => {});
    }

    api.getNotificationStatus()
      .then((res) => {
        if (res.isSubscribed) {
          setIsSubscribed(true);
        } else if (perm === 'granted' || localActive) {
          ensurePushSubscriptionActive().then((synced) => {
            if (synced) setIsSubscribed(true);
          });
        }
        if (res.morningTime || res.preferredTime) {
          const updated = saveLocalScheduleConfig({
            preferredTime: res.morningTime || res.preferredTime || localConfig.morningTime,
            morningTime: res.morningTime || localConfig.morningTime,
            afternoonTime: res.afternoonTime || localConfig.afternoonTime,
            eveningTime: res.eveningTime || localConfig.eveningTime,
            nightTime: res.nightTime || localConfig.nightTime,
            notifyMorning: res.notifyMorning !== undefined ? res.notifyMorning : localConfig.notifyMorning,
            notifyAfternoon: res.notifyAfternoon !== undefined ? res.notifyAfternoon : localConfig.notifyAfternoon,
            notifyEvening: res.notifyEvening !== undefined ? res.notifyEvening : localConfig.notifyEvening,
            notifyNight: res.notifyNight !== undefined ? res.notifyNight : localConfig.notifyNight,
          });
          setScheduleConfig(updated);
        }
      })
      .catch(() => {
        if (perm === 'granted' || localActive) {
          setIsSubscribed(true);
        }
      });
  }, [isNotificationModalOpen]);

  if (!isNotificationModalOpen) return null;

  const handleEnablePush = async () => {
    setIsEnabling(true);
    setErrorMessage(null);
    setTestStatusMessage(null);

    const result = await requestPushNotificationSubscription(scheduleConfig);
    setIsEnabling(false);

    if (result.success) {
      setIsSubscribed(true);
      setPermissionState(getNotificationPermissionState());
      setTestStatusMessage('✅ Scheduled notifications activated successfully! Sending immediate test briefing...');
      await handleSendTestPush();
    } else {
      setErrorMessage(result.error || 'Could not enable notifications. Check browser permissions.');
    }
  };

  const handleSaveSchedule = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setTestStatusMessage(null);

    saveLocalScheduleConfig(scheduleConfig);

    try {
      await api.updateNotificationPreferences({
        preferredTime: scheduleConfig.morningTime,
        morningTime: scheduleConfig.morningTime,
        afternoonTime: scheduleConfig.afternoonTime,
        eveningTime: scheduleConfig.eveningTime,
        nightTime: scheduleConfig.nightTime,
        notifyMorning: scheduleConfig.notifyMorning,
        notifyAfternoon: scheduleConfig.notifyAfternoon,
        notifyEvening: scheduleConfig.notifyEvening,
        notifyNight: scheduleConfig.notifyNight,
        timezone: detectedTimezone,
      });
      setTestStatusMessage(`✅ Notification schedule saved! Alerts set to your local timezone (${detectedTimezone}).`);
    } catch (e: any) {
      setTestStatusMessage('Schedule saved locally on device.');
    } finally {
      setIsSaving(false);
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
      setTestStatusMessage(res.message || '⚡ Notification delivered to your device!');
    } else {
      setErrorMessage(res.message || 'Failed delivering test notification.');
    }
  };

  const handleTestBlock = async (block: string) => {
    setTestingBlock(block);
    setTestStatusMessage(null);
    setErrorMessage(null);
    const res = await testTimeBlockNotification(block, {
      dayNumber: user?.dayNumber || 1,
      totalDays: user?.totalDaysGoal || 90,
      streakDays: user?.streakDays || 1,
      tasks,
    });
    setTestingBlock(null);
    if (res.success) {
      setTestStatusMessage(res.message || '⚡ Block notification delivered!');
    } else {
      setErrorMessage(res.message || 'Failed sending block notification.');
    }
  };

  const handleUnsubscribe = async () => {
    try {
      await api.unsubscribePush().catch(() => {});
      setIsSubscribed(false);
      localStorage.removeItem('lockin_push_sub');
      setTestStatusMessage('Unsubscribed from scheduled push notifications.');
    } catch (e) {
      console.error(e);
    }
  };

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
                Scheduled Tasks & Protocol Alerts
              </h2>
              <p className="font-mono-code text-[11px] text-[#8A9891]">
                Time-block briefings delivered at your scheduled hours
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
                <div className="font-space font-bold text-sm text-[#F4F6F5] flex items-center gap-2">
                  <span>{isSubscribed ? 'Scheduled Notifications Active' : 'Scheduled Notifications Inactive'}</span>
                  {isStandalone && (
                    <span className="font-mono-code text-[9px] bg-[#3ECF8E]/20 text-[#3ECF8E] px-1.5 py-0.5 rounded-full">
                      PWA Active
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono-code text-[#8A9891] flex items-center gap-1.5 mt-0.5">
                  <Globe className="w-3 h-3 text-[#3ECF8E]" />
                  <span>Timezone: {detectedTimezone}</span>
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

          {/* iOS / iPhone Installation Setup Guide */}
          {isIOS && !isStandalone && (
            <div className="p-4 bg-[#16201B] border border-[#F5A623]/40 rounded-2xl text-xs space-y-2.5 shadow-lg">
              <div className="flex items-center gap-2 text-[#F5A623] font-bold font-space">
                <Smartphone className="w-4 h-4" /> Required iPhone Step: Add to Home Screen
              </div>
              <p className="text-[11px] text-[#8A9891] leading-relaxed">
                iOS requires web apps to be added to your Home Screen so Apple can deliver notifications even when Safari is closed:
              </p>
              <div className="space-y-1.5 bg-[#0F1512] p-3 rounded-xl border border-[#26332C] text-[11px] font-mono-code text-[#F4F6F5]">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#3ECF8E]/20 text-[#3ECF8E] flex items-center justify-center text-[10px]">1</span>
                  <span>Tap Safari's <strong>Share</strong> button <Share2 className="w-3.5 h-3.5 inline text-[#3ECF8E]" /> at bottom</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#3ECF8E]/20 text-[#3ECF8E] flex items-center justify-center text-[10px]">2</span>
                  <span>Tap <strong>Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 inline text-[#3ECF8E]" /></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#3ECF8E]/20 text-[#3ECF8E] flex items-center justify-center text-[10px]">3</span>
                  <span>Open <strong>Lock-In</strong> from Home Screen & tap <strong>Enable</strong> below</span>
                </div>
              </div>
            </div>
          )}

          {/* Customizable Time Blocks Schedule */}
          <div className="space-y-3">
            <div className="font-mono-code text-[11px] uppercase tracking-widest text-[#8A9891] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#3ECF8E]" /> Scheduled Time Settings
              </span>
              <span className="text-[10px] text-[#5E6D66]">Customizable</span>
            </div>

            {[
              {
                block: 'morning',
                keyTime: 'morningTime' as const,
                keyNotify: 'notifyMorning' as const,
                icon: '☀️',
                label: 'Morning Lock-In',
                defaultTime: '07:00',
                desc: 'Morning protocol & scheduled habits briefing',
                color: '#F5A623',
                taskCount: tasks.filter((t) => !t.completed && (t.timeBlock || 'morning').toLowerCase() === 'morning').length,
              },
              {
                block: 'afternoon',
                keyTime: 'afternoonTime' as const,
                keyNotify: 'notifyAfternoon' as const,
                icon: '✨',
                label: 'Afternoon Momentum',
                defaultTime: '12:30',
                desc: 'Midday check-in, protein tracking & progress review',
                color: '#3ECF8E',
                taskCount: tasks.filter((t) => !t.completed && (t.timeBlock || '').toLowerCase() === 'afternoon').length,
              },
              {
                block: 'evening',
                keyTime: 'eveningTime' as const,
                keyNotify: 'notifyEvening' as const,
                icon: '🌇',
                label: 'Evening Surge',
                defaultTime: '17:30',
                desc: 'End of work: close open loops and finish tasks',
                color: '#6BA6FF',
                taskCount: tasks.filter((t) => !t.completed && (t.timeBlock || '').toLowerCase() === 'evening').length,
              },
              {
                block: 'night',
                keyTime: 'nightTime' as const,
                keyNotify: 'notifyNight' as const,
                icon: '🌙',
                label: 'Night Protocol',
                defaultTime: '21:30',
                desc: 'Recovery, night routine and sleep prep protocol',
                color: '#A06EFF',
                taskCount: tasks.filter((t) => !t.completed && (t.timeBlock || '').toLowerCase() === 'night').length,
              },
            ].map(({ block, keyTime, keyNotify, icon, label, desc, color, taskCount }) => (
              <div
                key={block}
                className="bg-[#0F1512] border border-[#26332C] rounded-2xl p-3.5 space-y-2.5 transition-all hover:border-[#3ECF8E]/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-sm border"
                      style={{ background: `${color}18`, borderColor: `${color}40` }}
                    >
                      {icon}
                    </div>
                    <div>
                      <div className="font-space font-bold text-xs text-[#F4F6F5] flex items-center gap-2">
                        <span>{label}</span>
                        <span
                          className="font-mono-code text-[9px] px-1.5 py-0.5 rounded-full"
                          style={{ background: `${color}20`, color }}
                        >
                          {taskCount} task{taskCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#8A9891] font-mono-code mt-0.5">{desc}</p>
                    </div>
                  </div>

                  {/* Toggle on/off */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleConfig[keyNotify] !== false}
                      onChange={(e) => {
                        const updated = { ...scheduleConfig, [keyNotify]: e.target.checked };
                        setScheduleConfig(updated);
                        saveLocalScheduleConfig(updated);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-[#26332C] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-[#3ECF8E]" />
                  </label>
                </div>

                {/* Scheduled Time Picker & Test Action */}
                <div className="flex items-center justify-between pt-2 border-t border-[#1F2B24] gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-code text-[10px] text-[#8A9891]">Alert Time:</span>
                    <input
                      type="time"
                      value={scheduleConfig[keyTime] || '07:00'}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = { ...scheduleConfig, [keyTime]: val };
                        setScheduleConfig(updated);
                        saveLocalScheduleConfig(updated);
                      }}
                      className="bg-[#16201B] border border-[#26332C] rounded-lg px-2 py-1 text-xs font-mono-code text-[#3ECF8E] focus:outline-none focus:border-[#3ECF8E]"
                    />
                  </div>

                  <button
                    onClick={() => handleTestBlock(block)}
                    disabled={testingBlock !== null}
                    title={`Send test ${label} alert`}
                    className="flex items-center gap-1.5 text-[10px] font-space font-bold px-2.5 py-1 rounded-xl border border-[#26332C] bg-[#16201B] text-[#3ECF8E] hover:border-[#3ECF8E]/50 hover:bg-[#3ECF8E]/10 transition-all cursor-pointer disabled:opacity-40"
                  >
                    <Send className="w-3 h-3" />
                    {testingBlock === block ? '...' : 'Test Alert'}
                  </button>
                </div>
              </div>
            ))}
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
              {isEnabling ? 'Activating Alerts...' : 'Enable Scheduled Notifications'}
            </button>
          ) : (
            <>
              <button
                onClick={handleSaveSchedule}
                disabled={isSaving}
                className="flex-1 bg-[#3ECF8E] hover:bg-[#32B87C] text-[#0B1510] font-space font-bold text-xs py-3 px-4 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Saving...' : 'Save & Sync Schedule'}
              </button>

              <button
                onClick={handleSendTestPush}
                disabled={isTesting}
                className="bg-[#16201B] hover:bg-[#1D2922] border border-[#26332C] text-[#3ECF8E] font-space font-bold text-xs py-3 px-3 rounded-2xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                {isTesting ? 'Sending...' : 'Test Full Briefing'}
              </button>
            </>
          )}

          <button
            onClick={() => setIsNotificationModalOpen(false)}
            className="bg-[#16201B] hover:bg-[#1D2922] border border-[#26332C] text-[#8A9891] hover:text-[#F4F6F5] font-space text-xs py-3 px-4 rounded-2xl transition-colors cursor-pointer text-center"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
