import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Clock, CheckCircle2, FastForward, Zap, ArrowRight, Sparkles } from 'lucide-react';

export const HeroFocusCard: React.FC = () => {
  const { heroFocusTask, nextFocusTask, currentBlock, toggleTask, pillars, routines } = useApp();
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isDoneBtnLoading, setIsDoneBtnLoading] = useState<boolean>(false);

  // Dynamic countdown timer based on current active block transition
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const currentHour = now.getHours();

      let targetHour = 12; // Morning ends at 12pm
      if (currentHour >= 12 && currentHour < 17) targetHour = 17; // Afternoon ends at 5pm
      else if (currentHour >= 17 && currentHour < 21) targetHour = 21; // Evening ends at 9pm
      else if (currentHour >= 21 || currentHour < 5) targetHour = 5; // Night ends at 5am

      const targetDate = new Date();
      if (targetHour <= currentHour && currentHour >= 21) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      targetDate.setHours(targetHour, 0, 0, 0);

      const diffMs = Math.max(0, targetDate.getTime() - now.getTime());
      const diffMins = Math.floor(diffMs / 60000);
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;

      setTimeLeft(hours > 0 ? `${hours}h ${mins}m` : `${mins}m`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 30000);
    return () => clearInterval(interval);
  }, [currentBlock]);

  const matchedPillar = pillars.find((p) => p.id === heroFocusTask?.pillarId);
  const nextMatchedPillar = pillars.find((p) => p.id === nextFocusTask?.pillarId);

  // Current time block routines summary
  const currentBlockRoutines = routines.filter((r) => r.timeBlock === currentBlock);

  const handleMarkDone = async () => {
    if (!heroFocusTask) return;
    setIsDoneBtnLoading(true);
    await toggleTask(heroFocusTask.id);
    setIsDoneBtnLoading(false);
  };

  const blockLabels: Record<string, string> = {
    morning: '🌅 Morning',
    afternoon: '☀️ Afternoon',
    evening: '🌆 Evening',
    night: '🌙 Night',
  };

  return (
    <div className="mb-5">
      {/* Top Header Bar */}
      <div className="font-mono-code text-[11px] tracking-widest uppercase text-[#8A9891] mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3ECF8E] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3ECF8E]"></span>
          </span>
          <span className="text-[#F4F6F5] font-semibold">RIGHT NOW</span>
          <span className="text-[#5E6D66]">•</span>
          <span className="text-[#3ECF8E]">{blockLabels[currentBlock] || currentBlock}</span>
        </div>

        {timeLeft && (
          <span className="text-[#8A9891] flex items-center gap-1 text-[10px]">
            <Clock className="w-3 h-3 text-[#3ECF8E]" /> ends in {timeLeft}
          </span>
        )}
      </div>

      {/* Hero Focus Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1B2A21] via-[#16201B] to-[#131B17] border border-[#3ECF8E]/30 border-l-4 border-l-[#3ECF8E] rounded-2xl p-4 sm:p-5 shadow-xl transition-all">
        {heroFocusTask ? (
          <>
            {/* Meta Row */}
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono-code text-[11px] text-[#3ECF8E] uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <span>{matchedPillar?.icon || '⚡'}</span>
                <span>{matchedPillar?.name || 'CORE FOCUS'}</span>
                {heroFocusTask.timeBlock === currentBlock && (
                  <>
                    <span className="text-[#5E6D66]">•</span>
                    <span className="text-[#8A9891]">Active Block</span>
                  </>
                )}
              </span>
              <span className="font-mono-code text-[10px] text-[#F5A623] bg-[#F5A623]/10 border border-[#F5A623]/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Zap className="w-2.5 h-2.5" /> +{heroFocusTask.points || 15} pts
              </span>
            </div>

            {/* Task Title */}
            <h3 className="font-space font-semibold text-lg sm:text-xl text-[#F4F6F5] mb-4 leading-tight">
              {heroFocusTask.name}
            </h3>

            {/* Primary Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkDone}
                disabled={isDoneBtnLoading}
                className="flex-1 bg-[#3ECF8E] hover:bg-[#32B87C] active:scale-[0.98] text-[#0B1510] font-space font-bold text-sm py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {heroFocusTask.completed ? 'Done ✓' : 'Mark done'}
              </button>

              <button
                onClick={() => {
                  if (heroFocusTask) toggleTask(heroFocusTask.id);
                }}
                className="bg-[#1D2922] hover:bg-[#26332C] border border-[#26332C] text-[#8A9891] hover:text-[#F4F6F5] font-mono-code text-xs px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                title="Skip to next task"
              >
                <FastForward className="w-3.5 h-3.5" /> Skip
              </button>
            </div>
          </>
        ) : (
          <div className="py-3 text-center">
            <span className="inline-block p-2 bg-[#3ECF8E]/10 rounded-full text-xl mb-2">🎉</span>
            <p className="font-space font-semibold text-base text-[#3ECF8E] mb-1">
              All tasks in {currentBlock} completed!
            </p>
            <p className="text-xs text-[#8A9891]">
              Great job maintaining momentum. Check your time blocks below to prepare for your next focus session.
            </p>
          </div>
        )}

        {/* Routines Summary Pill if active routines exist in this block */}
        {currentBlockRoutines.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#26332C]/80 flex items-center justify-between text-xs text-[#8A9891]">
            <span className="flex items-center gap-1.5 font-mono-code text-[11px] text-[#3ECF8E]">
              <Sparkles className="w-3 h-3" /> {currentBlockRoutines.length} Routine{currentBlockRoutines.length > 1 ? 's' : ''} in {currentBlock}
            </span>
            <span className="text-[10px] text-[#8A9891]">
              See time block below
            </span>
          </div>
        )}
      </div>

      {/* Up Next Preview ("In a few minutes") */}
      {nextFocusTask && (
        <div className="mt-2.5 bg-[#16201B] border border-[#26332C] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 shadow-sm hover:border-[#3ECF8E]/30 transition-all">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono-code text-[10px] text-[#3ECF8E] bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 px-2 py-0.5 rounded-md flex-shrink-0 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> Up Next
            </span>
            <span className="text-xs font-space font-medium text-[#F4F6F5] truncate">
              {nextFocusTask.name}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {nextMatchedPillar && (
              <span className="text-xs text-[#8A9891] hidden sm:inline-block">
                {nextMatchedPillar.icon} {nextMatchedPillar.name}
              </span>
            )}
            <span className="font-mono-code text-[10px] text-[#F5A623]">
              +{nextFocusTask.points || 15} pts
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-[#5E6D66]" />
          </div>
        </div>
      )}
    </div>
  );
};
