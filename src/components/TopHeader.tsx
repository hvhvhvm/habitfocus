import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Flame, Smartphone, Monitor, User as UserIcon, Lock, Sparkles } from 'lucide-react';

export const TopHeader: React.FC = () => {
  const { user } = useAuth();
  const { viewMode, setViewMode, setActiveTab, setIsAIRoutineOpen } = useApp();

  return (
    <div className="flex flex-col gap-3 pb-4 border-b border-[#26332C]/60 mb-5">
      {/* Top Banner Row */}
      <div className="flex items-center justify-between text-xs font-mono-code tracking-wider text-[#8A9891]">
        <div className="flex items-center gap-1.5 uppercase">
          <span className="inline-block w-2 h-2 rounded-full bg-[#3ECF8E] animate-pulse" />
          <span>Day {user?.dayNumber || 6} of {user?.totalDaysGoal || 90}</span>
          <span className="text-[#5E6D66]">•</span>
          <span className="text-[#3ECF8E] font-medium flex items-center gap-1">
            <Lock className="w-3 h-3 inline" /> Lock-In
          </span>
        </div>

        {/* View Mode Switcher + Profile */}
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

          <button
            onClick={() => setActiveTab('profile')}
            className="flex items-center gap-1.5 bg-[#16201B] hover:bg-[#1D2922] border border-[#26332C] px-2.5 py-1 rounded-full text-[#F4F6F5] transition-colors cursor-pointer"
          >
            <span className="text-sm">{user?.avatar || '⚡'}</span>
            <span className="text-xs font-sans font-medium hidden xs:inline">{user?.name ? user.name.split(' ')[0] : 'Account'}</span>
          </button>
        </div>
      </div>

      {/* Main Title & Points Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-space font-bold text-2xl sm:text-3xl text-[#F4F6F5] tracking-tight">
            Today
          </h1>
          <button
            onClick={() => setIsAIRoutineOpen(true)}
            className="flex items-center gap-1 bg-gradient-to-r from-[#3ECF8E]/20 to-[#6BA6FF]/20 border border-[#3ECF8E]/40 hover:border-[#3ECF8E] px-2.5 py-1 rounded-full text-xs font-mono-code text-[#3ECF8E] hover:scale-105 transition-all cursor-pointer"
          >
            <Sparkles className="w-3 h-3" /> AI Protocol
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-mono-code text-xs text-[#F5A623] bg-[#F5A623]/10 border border-[#F5A623]/30 px-3 py-1.5 rounded-full whitespace-nowrap shadow-sm">
            <Flame className="w-3.5 h-3.5 text-[#F5A623] fill-[#F5A623]/30" />
            <span className="font-semibold">{user?.totalPoints || 1593} pts</span>
            <span className="text-[#5E6D66] font-normal">| Lvl {user?.currentLevel || 4}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
