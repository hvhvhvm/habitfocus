import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { ProteinTrackerWidget } from './ProteinTrackerWidget';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Flame, Trophy, Target, Zap, ShieldAlert, Award } from 'lucide-react';

export const ProgressView: React.FC = () => {
  const { user } = useAuth();
  const { pillars, tasks, completionRate, setIsDayRoadmapModalOpen } = useApp();
  const [statsData, setStatsData] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await api.getStats();
        setStatsData(res);
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setIsLoadingStats(false);
      }
    }
    loadStats();
  }, [tasks]);

  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const weeklyData = statsData?.weeklyData || Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const isToday = i === 6;
    return {
      day: dayNames[d.getDay()],
      completed: isToday ? tasks.filter((t) => t.completed).length : 0,
      total: isToday ? (tasks.length || 5) : 5,
      points: isToday ? tasks.filter((t) => t.completed).length * 15 : 0,
    };
  });

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="mb-6">
        <div className="font-mono-code text-[11px] tracking-widest uppercase text-[#8A9891] mb-1">
          Lock-In Analytics
        </div>
        <h2 className="font-space font-bold text-2xl text-[#F4F6F5]">
          Momentum & Streaks
        </h2>
      </div>

      {/* Hero Stat Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#16201B] border border-[#26332C] rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-xs font-mono-code text-[#F5A623] mb-1">
            <Flame className="w-4 h-4 fill-[#F5A623]/20" /> Streak
          </div>
          <div className="font-space font-bold text-2xl text-[#F4F6F5]">
            {user?.streakDays || 6} <span className="text-xs text-[#8A9891] font-normal">Days</span>
          </div>
        </div>

        <div className="bg-[#16201B] border border-[#26332C] rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-xs font-mono-code text-[#3ECF8E] mb-1">
            <Zap className="w-4 h-4 fill-[#3ECF8E]/20" /> Total Points
          </div>
          <div className="font-space font-bold text-2xl text-[#F4F6F5]">
            {user?.totalPoints || 1593}
          </div>
        </div>

        <div className="bg-[#16201B] border border-[#26332C] rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-xs font-mono-code text-[#6BA6FF] mb-1">
            <Trophy className="w-4 h-4 fill-[#6BA6FF]/20" /> Level
          </div>
          <div className="font-space font-bold text-2xl text-[#F4F6F5]">
            Lvl {user?.currentLevel || 4}
          </div>
        </div>

        <div className="bg-[#16201B] border border-[#26332C] rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-xs font-mono-code text-[#B98CF0] mb-1">
            <Target className="w-4 h-4 fill-[#B98CF0]/20" /> Today Rate
          </div>
          <div className="font-space font-bold text-2xl text-[#F4F6F5]">
            {completionRate}%
          </div>
        </div>
      </div>

      {/* Protein Progress Tracker */}
      <ProteinTrackerWidget />

      {/* Weekly Momentum Bar Chart */}
      <div className="bg-[#16201B] border border-[#26332C] rounded-2xl p-5 mb-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-space font-semibold text-base text-[#F4F6F5]">
              Weekly Completion Curve
            </h3>
            <p className="font-mono-code text-xs text-[#8A9891]">
              Daily tasks finished over the last 7 days
            </p>
          </div>
          <span className="font-mono-code text-xs text-[#3ECF8E] bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 px-2.5 py-1 rounded-full">
            +15 pts / task
          </span>
        </div>

        <div className="h-48 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <XAxis
                dataKey="day"
                stroke="#8A9891"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#8A9891"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#16201B',
                  borderColor: '#26332C',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#F4F6F5',
                }}
                itemStyle={{ color: '#3ECF8E' }}
              />
              <Bar dataKey="completed" radius={[6, 6, 0, 0]}>
                {weeklyData.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === 6 ? '#3ECF8E' : '#212D26'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 90-Day Protocol Journey Timeline */}
      <div className="bg-[#16201B] border border-[#26332C] rounded-2xl p-5 mb-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-space font-semibold text-base text-[#F4F6F5] flex items-center gap-2">
              <Target className="w-5 h-5 text-[#3ECF8E]" /> 90-Day Protocol Journey
            </h3>
            <p className="font-mono-code text-xs text-[#8A9891]">
              Day {user?.dayNumber || 1} of {user?.totalDaysGoal || 90} completed
            </p>
          </div>
          <button
            onClick={() => setIsDayRoadmapModalOpen(true)}
            className="font-mono-code text-xs text-[#3ECF8E] hover:text-[#32B87C] bg-[#3ECF8E]/10 border border-[#3ECF8E]/25 hover:border-[#3ECF8E]/50 px-3 py-1.5 rounded-full transition-all cursor-pointer"
          >
            View Full Calendar ➔
          </button>
        </div>

        {/* Mini 30-Day Matrix Strip */}
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 mb-3">
          {Array.from({ length: Math.min(30, user?.totalDaysGoal || 90) }, (_, i) => {
            const dayNum = i + 1;
            const isCurr = dayNum === (user?.dayNumber || 1);
            const isPast = dayNum < (user?.dayNumber || 1);
            return (
              <button
                key={dayNum}
                onClick={() => setIsDayRoadmapModalOpen(true)}
                className={`py-2 px-1.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                  isCurr
                    ? 'bg-[#3ECF8E]/20 border-[#3ECF8E] text-[#3ECF8E] font-bold ring-1 ring-[#3ECF8E]'
                    : isPast
                    ? 'bg-[#3ECF8E]/10 border-[#3ECF8E]/30 text-[#3ECF8E]'
                    : 'bg-[#0F1512] border-[#26332C] text-[#5E6D66]'
                }`}
              >
                <span className="font-space text-xs font-bold">{dayNum}</span>
                <span className="text-[9px] font-mono-code mt-0.5">
                  {isCurr ? '⚡' : isPast ? '✓' : '🔒'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono-code text-[#8A9891] pt-2 border-t border-[#26332C]">
          <span>Days 1–30 Phase 1: Foundation</span>
          <span className="text-[#3ECF8E] font-semibold">{Math.round(((user?.dayNumber || 1) / (user?.totalDaysGoal || 90)) * 100)}% Protocol Completed</span>
        </div>
      </div>

      {/* Lock-In Level Milestones */}
      <div className="bg-[#16201B] border border-[#26332C] rounded-2xl p-5">
        <h3 className="font-space font-semibold text-base text-[#F4F6F5] mb-3 flex items-center gap-2">
          <Award className="w-5 h-5 text-[#F5A623]" /> 90-Day Lock-In Badges
        </h3>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3 p-3 bg-[#1D2922] border border-[#26332C] rounded-xl text-xs">
            <span className="text-xl">🔥</span>
            <div className="flex-1">
              <span className="font-semibold text-[#F4F6F5] block">7-Day Unbroken Streak</span>
              <span className="text-[11px] text-[#8A9891]">Maintain full momentum for 7 consecutive days</span>
            </div>
            <span className="font-mono-code text-[#3ECF8E] font-bold">Unlocked ✓</span>
          </div>

          <div className="flex items-center gap-3 p-3 bg-[#1D2922] border border-[#26332C] rounded-xl text-xs">
            <span className="text-xl">⚡</span>
            <div className="flex-1">
              <span className="font-semibold text-[#F4F6F5] block">Level 5 Titan</span>
              <span className="text-[11px] text-[#8A9891]">Reach 2,000 total momentum points</span>
            </div>
            <span className="font-mono-code text-[#F5A623]">In Progress</span>
          </div>

          <div className="flex items-center gap-3 p-3 bg-[#1D2922] border border-[#26332C] rounded-xl text-xs opacity-60">
            <span className="text-xl">👑</span>
            <div className="flex-1">
              <span className="font-semibold text-[#F4F6F5] block">90-Day Master Lock-In</span>
              <span className="text-[11px] text-[#8A9891]">Complete the full 90-day transformation block</span>
            </div>
            <span className="font-mono-code text-[#8A9891]">Locked</span>
          </div>
        </div>
      </div>
    </div>
  );
};
