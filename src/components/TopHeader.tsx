import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Flame, Smartphone, Monitor, User as UserIcon, Lock, Sparkles, Bell, Calendar } from 'lucide-react';

export const TopHeader: React.FC = () => {
  const { user } = useAuth();
  const { viewMode, setViewMode, setActiveTab, setIsNotificationModalOpen, setIsDayRoadmapModalOpen } = useApp();

  return (
    <div className="flex flex-col gap-3 pb-4 border-b border-[#26332C]/60 mb-5">
      {/* Top Banner Row */}
      <div className="flex items-center justify-between text-xs font-mono-code tracking-wider text-[#8A9891]">
        {/* Interactive Day Badge */}
        <button
          onClick={() => setIsDayRoadmapModalOpen(true)}
          className="flex items-center gap-1.5 uppercase hover:text-[#F4F6F5] bg-[#16201B] hover:bg-[#1D2922] border border-[#26332C] px-2.5 py-1 rounded-full transition-all cursor-pointer"
          title="View 90-Day Protocol Roadmap"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-[#3ECF8E] animate-pulse" />
          <span className="font-bold text-[#F4F6F5]">Day {user?.dayNumber || 1}</span>
          <span>of {user?.totalDaysGoal || 90}</span>
          <Calendar className="w-3 h-3 text-[#3ECF8E] ml-0.5" />
        </button>

        {/* View Mode Switcher + Notification Bell + Profile */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center bg-[#16201B] border border-[#26332C] rounded-lg p-0.5 text-xs font-sans">
            <button
              onClick={() => setViewMode('mobile')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                viewMode === 'mobile' ? 'bg-[#3ECF8E] text-[#0B1510] font-semibold' : 'text-[#8A9891] hover:text-[#F4F6F5]'
              }`}
              title="Mobile Phone View"
            >
              <Smartphone className="w-3.5 h-3.5" /> Phone
            </button>
            <button
              onClick={() => setViewMode('desktop')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                viewMode === 'desktop' ? 'bg-[#3ECF8E] text-[#0B1510] font-semibold' : 'text-[#8A9891] hover:text-[#F4F6F5]'
              }`}
              title="Desktop Full Dashboard"
            >
              <Monitor className="w-3.5 h-3.5" /> Desktop
            </button>
          </div>

          {/* Daily Phone Push Notification Quick Opener */}
          <button
            onClick={() => setIsNotificationModalOpen(true)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-[#16201B] hover:bg-[#1D2922] border border-[#26332C] hover:border-[#3ECF8E]/40 text-[#3ECF8E] transition-all cursor-pointer relative"
            title="Configure Daily Phone Push Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#3ECF8E] animate-ping" />
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className="flex items-center gap-1.5 bg-[#16201B] hover:bg-[#1D2922] border border-[#26332C] px-2.5 py-1 rounded-full text-[#F4F6F5] transition-colors cursor-pointer"
          >
            <span className="text-sm">{user?.avatar || '⚡'}</span>
            <span className="text-xs font-sans font-medium hidden xs:inline">{user?.name ? user.name.split(' ')[0] : 'Account'}</span>
          </button>
        </div>
      </div>

      {/* Main Title & Streaks Row */}
      <div className="flex items-center justify-between">
        <h1 className="font-space font-bold text-2xl sm:text-3xl text-[#F4F6F5] tracking-tight">
          Today
        </h1>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 font-mono-code text-xs text-[#F5A623] bg-gradient-to-r from-[#F5A623]/15 to-[#3ECF8E]/10 border border-[#F5A623]/35 px-3.5 py-1.5 rounded-full whitespace-nowrap shadow-sm">
            <Flame className="w-4 h-4 text-[#F5A623] fill-[#F5A623]/40 animate-pulse" />
            <span className="font-bold font-space text-sm text-[#F4F6F5]">{user?.streakDays || 6}</span>
            <span className="font-semibold text-[#F5A623]">Day Streak 🔥</span>
          </div>
        </div>
      </div>
    </div>
  );
};
