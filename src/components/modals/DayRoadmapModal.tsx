import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  Calendar,
  Flame,
  Trophy,
  CheckCircle2,
  Lock,
  X,
  ChevronRight,
  Zap,
  Sparkles,
  Award,
} from 'lucide-react';

interface DayItem {
  dayNumber: number;
  date: string;
  status: 'completed' | 'active' | 'partial' | 'missed' | 'upcoming';
  completedCount: number;
  totalCount: number;
  points: number;
  isCurrent: boolean;
  isPast: boolean;
}

export const DayRoadmapModal: React.FC = () => {
  const { isDayRoadmapModalOpen, setIsDayRoadmapModalOpen, tasks } = useApp();
  const { user } = useAuth();

  const [daysData, setDaysData] = useState<DayItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayItem | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'current_week' | 'milestones'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const currentDayNum = user?.dayNumber || 1;
  const totalDaysGoal = user?.totalDaysGoal || 90;

  useEffect(() => {
    if (!isDayRoadmapModalOpen) return;
    setIsLoading(true);

    api.getDaysHistory()
      .then((res) => {
        if (res?.days) {
          setDaysData(res.days);
          const activeOrCurrent = res.days.find((d: DayItem) => d.isCurrent) || res.days[0];
          setSelectedDay(activeOrCurrent || null);
        }
      })
      .catch((err) => {
        console.warn('Failed loading day history from backend, generating client fallback:', err);
        // Generate client-side fallback days
        const fallbackDays: DayItem[] = Array.from({ length: totalDaysGoal }, (_, i) => {
          const dayNum = i + 1;
          const isCurr = dayNum === currentDayNum;
          const isP = dayNum < currentDayNum;
          return {
            dayNumber: dayNum,
            date: `Day ${dayNum}`,
            status: isCurr ? 'active' : isP ? 'completed' : 'upcoming',
            completedCount: isCurr ? tasks.filter((t) => t.completed).length : isP ? 3 : 0,
            totalCount: tasks.length || 3,
            points: isCurr ? tasks.filter((t) => t.completed).length * 50 : isP ? 150 : 0,
            isCurrent: isCurr,
            isPast: isP,
          };
        });
        setDaysData(fallbackDays);
        setSelectedDay(fallbackDays.find((d) => d.isCurrent) || fallbackDays[0]);
      })
      .finally(() => setIsLoading(false));
  }, [isDayRoadmapModalOpen, currentDayNum, totalDaysGoal, tasks]);

  if (!isDayRoadmapModalOpen) return null;

  const filteredDays = daysData.filter((d) => {
    if (selectedFilter === 'milestones') {
      return [1, 7, 14, 21, 30, 45, 60, 75, 90].includes(d.dayNumber);
    }
    if (selectedFilter === 'current_week') {
      const weekStart = Math.max(1, Math.floor((currentDayNum - 1) / 7) * 7 + 1);
      return d.dayNumber >= weekStart && d.dayNumber < weekStart + 7;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0F1512] border border-[#26332C] rounded-3xl p-5 sm:p-6 text-[#F4F6F5] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Ambient background glow */}
        <div className="absolute -top-16 -left-16 w-40 h-40 bg-[#3ECF8E]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#26332C]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#3ECF8E]/15 border border-[#3ECF8E]/30 flex items-center justify-center text-[#3ECF8E]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-space font-bold text-lg text-[#F4F6F5] flex items-center gap-2">
                90-Day Protocol Roadmap
                <span className="font-mono-code text-xs px-2 py-0.5 bg-[#3ECF8E]/10 border border-[#3ECF8E]/30 text-[#3ECF8E] rounded-full">
                  Day {currentDayNum} of {totalDaysGoal}
                </span>
              </h2>
              <p className="font-mono-code text-[11px] text-[#8A9891]">
                Day-by-day progression, completion history & milestones
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsDayRoadmapModalOpen(false)}
            className="text-[#8A9891] hover:text-[#F4F6F5] p-1.5 rounded-xl hover:bg-[#16201B] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Navigation */}
        <div className="flex items-center gap-2 pt-3 pb-2 text-xs font-mono-code">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
              selectedFilter === 'all'
                ? 'bg-[#3ECF8E] text-[#0B1510] font-bold border-[#3ECF8E]'
                : 'bg-[#16201B] text-[#8A9891] border-[#26332C] hover:border-[#3ECF8E]/30'
            }`}
          >
            All 90 Days
          </button>
          <button
            onClick={() => setSelectedFilter('current_week')}
            className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
              selectedFilter === 'current_week'
                ? 'bg-[#3ECF8E] text-[#0B1510] font-bold border-[#3ECF8E]'
                : 'bg-[#16201B] text-[#8A9891] border-[#26332C] hover:border-[#3ECF8E]/30'
            }`}
          >
            Current Week
          </button>
          <button
            onClick={() => setSelectedFilter('milestones')}
            className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
              selectedFilter === 'milestones'
                ? 'bg-[#3ECF8E] text-[#0B1510] font-bold border-[#3ECF8E]'
                : 'bg-[#16201B] text-[#8A9891] border-[#26332C] hover:border-[#3ECF8E]/30'
            }`}
          >
            🏆 Key Milestones
          </button>
        </div>

        {/* Selected Day Inspector Banner */}
        {selectedDay && (
          <div className="my-3 p-4 bg-[#16201B] border border-[#3ECF8E]/40 rounded-2xl flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-space font-bold text-base ${
                  selectedDay.isCurrent
                    ? 'bg-[#3ECF8E] text-[#0B1510] shadow-[0_0_15px_rgba(62,207,142,0.4)]'
                    : selectedDay.status === 'completed'
                    ? 'bg-[#3ECF8E]/20 text-[#3ECF8E] border border-[#3ECF8E]/40'
                    : 'bg-[#1D2922] text-[#8A9891] border border-[#26332C]'
                }`}
              >
                D{selectedDay.dayNumber}
              </div>
              <div>
                <div className="font-space font-bold text-sm text-[#F4F6F5] flex items-center gap-2">
                  <span>Day {selectedDay.dayNumber}</span>
                  {selectedDay.isCurrent && (
                    <span className="text-[10px] bg-[#3ECF8E] text-[#0B1510] px-2 py-0.5 rounded-full font-mono-code font-bold animate-pulse">
                      TODAY
                    </span>
                  )}
                  {selectedDay.dayNumber === 90 && (
                    <span className="text-[10px] bg-[#F5A623] text-[#0B1510] px-2 py-0.5 rounded-full font-mono-code font-bold">
                      🏆 MASTER
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono-code text-[#8A9891] mt-0.5">
                  {selectedDay.date} • {selectedDay.completedCount} / {selectedDay.totalCount} Tasks Completed
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="font-mono-code text-xs text-[#3ECF8E] font-bold">
                +{selectedDay.points} pts
              </div>
              <div className="text-[10px] font-mono-code text-[#8A9891] capitalize">
                {selectedDay.status}
              </div>
            </div>
          </div>
        )}

        {/* 90-Day Grid */}
        <div className="flex-1 overflow-y-auto pr-1 py-2">
          {isLoading ? (
            <div className="py-12 text-center font-mono-code text-xs text-[#3ECF8E] animate-pulse">
              Loading 90-Day Protocol Roadmap...
            </div>
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {filteredDays.map((d) => {
                const isSelected = selectedDay?.dayNumber === d.dayNumber;
                let bgClass = 'bg-[#16201B] border-[#26332C] text-[#8A9891] hover:border-[#3ECF8E]/40';

                if (d.isCurrent) {
                  bgClass = 'bg-[#3ECF8E]/25 border-[#3ECF8E] text-[#3ECF8E] shadow-[0_0_10px_rgba(62,207,142,0.3)] font-bold';
                } else if (d.status === 'completed') {
                  bgClass = 'bg-[#3ECF8E]/15 border-[#3ECF8E]/40 text-[#3ECF8E]';
                } else if (d.status === 'partial') {
                  bgClass = 'bg-[#F5A623]/15 border-[#F5A623]/40 text-[#F5A623]';
                } else if (d.isPast) {
                  bgClass = 'bg-[#16201B] border-[#26332C] text-[#5E6D66] opacity-60';
                }

                if (isSelected) {
                  bgClass += ' ring-2 ring-[#3ECF8E] scale-105';
                }

                return (
                  <button
                    key={d.dayNumber}
                    onClick={() => setSelectedDay(d)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer text-center relative ${bgClass}`}
                  >
                    <span className="font-space font-bold text-xs">{d.dayNumber}</span>
                    <span className="text-[9px] font-mono-code mt-0.5">
                      {d.isCurrent ? '⚡' : d.status === 'completed' ? '✓' : d.isPast ? '•' : '🔒'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Legend */}
        <div className="pt-3 border-t border-[#26332C] flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono-code text-[#8A9891]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#3ECF8E]" /> Completed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#3ECF8E] animate-pulse" /> Today
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#F5A623]" /> Partial
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#26332C]" /> Locked
            </span>
          </div>

          <button
            onClick={() => setIsDayRoadmapModalOpen(false)}
            className="bg-[#16201B] hover:bg-[#1D2922] border border-[#26332C] text-[#F4F6F5] font-space text-xs py-1.5 px-4 rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
