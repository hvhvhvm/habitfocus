import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Pillar } from '../types';
import { Plus, Flame, Target, Trash2, ChevronRight } from 'lucide-react';

export const PillarsView: React.FC = () => {
  const { pillars, tasks, setIsAddPillarOpen, deletePillar } = useApp();
  const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null);

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="mb-6">
        <div className="font-mono-code text-[11px] tracking-widest uppercase text-[#8A9891] mb-1">
          {pillars.length} Active Pillars
        </div>
        <div className="flex items-center justify-between">
          <h2 className="font-space font-bold text-2xl text-[#F4F6F5]">
            Core Pillars
          </h2>
          <button
            onClick={() => setIsAddPillarOpen(true)}
            className="flex items-center gap-1.5 bg-[#3ECF8E] hover:bg-[#32B87C] text-[#0B1510] font-sans font-bold text-xs px-3 py-2 rounded-xl transition-all cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" /> Add Pillar
          </button>
        </div>
      </div>

      {/* Pillars List */}
      <div className="flex flex-col gap-3">
        {pillars.length === 0 ? (
          <div className="bg-[#16201B] border border-[#26332C] rounded-2xl p-8 text-center">
            <p className="font-space font-semibold text-lg text-[#F4F6F5] mb-2">
              No Pillars Created
            </p>
            <p className="text-xs text-[#8A9891] mb-4">
              Pillars represent your fundamental life domains (e.g. Fitness, Mind, Sleep, Nutrition, Work).
            </p>
            <button
              onClick={() => setIsAddPillarOpen(true)}
              className="bg-[#3ECF8E] text-[#0B1510] font-bold text-xs px-4 py-2.5 rounded-xl"
            >
              + Create First Pillar
            </button>
          </div>
        ) : (
          pillars.map((pillar) => {
            const pillarTasks = tasks.filter((t) => t.pillarId === pillar.id);
            const completedCount = pillarTasks.filter((t) => t.completed).length;
            const totalCount = pillarTasks.length;
            const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

            const radius = 18;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = circumference - (pct / 100) * circumference;

            return (
              <div
                key={pillar.id}
                onClick={() => setSelectedPillar(pillar)}
                className="flex items-center gap-4 bg-[#16201B] hover:bg-[#1D2922] border border-[#26332C] rounded-2xl p-4 transition-all cursor-pointer group shadow-sm"
              >
                {/* Mini Ring Chart */}
                <div className="relative w-11 h-11 flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
                    <circle
                      cx="22"
                      cy="22"
                      r={radius}
                      fill="none"
                      stroke="#212D26"
                      strokeWidth="4"
                    />
                    <circle
                      cx="22"
                      cy="22"
                      r={radius}
                      fill="none"
                      stroke={pillar.color || '#3ECF8E'}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-base">
                    {pillar.icon}
                  </div>
                </div>

                {/* Pillar Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-space font-semibold text-base text-[#F4F6F5] truncate">
                    {pillar.name}
                  </div>
                  <div className="font-mono-code text-[11px] text-[#8A9891] flex items-center gap-2 mt-0.5">
                    <span>{completedCount}/{totalCount} tasks today</span>
                    <span className="text-[#5E6D66]">•</span>
                    <span className="text-[#F5A623] flex items-center gap-0.5">
                      <Flame className="w-3 h-3" /> {pillar.streakDays || 1}d streak
                    </span>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-[#5E6D66] group-hover:text-[#F4F6F5] group-hover:translate-x-0.5 transition-all" />
              </div>
            );
          })
        )}
      </div>

      {/* Pillar Detail Drawer / Modal */}
      {selectedPillar && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#16201B] border border-[#26332C] rounded-3xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-[#26332C] pb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 bg-[#1D2922] rounded-2xl border border-[#26332C]">
                  {selectedPillar.icon}
                </span>
                <div>
                  <h3 className="font-space font-bold text-xl text-[#F4F6F5]">
                    {selectedPillar.name}
                  </h3>
                  <p className="font-mono-code text-xs text-[#8A9891]">
                    {selectedPillar.dailyGoal || 'Daily domain focus'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPillar(null)}
                className="text-[#8A9891] hover:text-[#F4F6F5] font-mono-code text-xs"
              >
                ✕ Close
              </button>
            </div>

            {/* Pillar Stats */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-[#1D2922] border border-[#26332C] rounded-2xl p-3.5">
                <span className="font-mono-code text-[10px] text-[#8A9891] uppercase block mb-1">
                  Daily Streak
                </span>
                <span className="font-space font-bold text-xl text-[#F5A623] flex items-center gap-1">
                  <Flame className="w-4 h-4" /> {selectedPillar.streakDays || 1} Days
                </span>
              </div>
              <div className="bg-[#1D2922] border border-[#26332C] rounded-2xl p-3.5">
                <span className="font-mono-code text-[10px] text-[#8A9891] uppercase block mb-1">
                  Tasks Today
                </span>
                <span className="font-space font-bold text-xl text-[#3ECF8E] flex items-center gap-1">
                  <Target className="w-4 h-4" />{' '}
                  {tasks.filter((t) => t.pillarId === selectedPillar.id && t.completed).length}/
                  {tasks.filter((t) => t.pillarId === selectedPillar.id).length}
                </span>
              </div>
            </div>

            {/* Pillar Associated Tasks */}
            <div className="mb-6">
              <h4 className="font-mono-code text-xs text-[#8A9891] uppercase tracking-wider mb-2">
                Pillar Tasks
              </h4>
              <div className="flex flex-col gap-2">
                {tasks.filter((t) => t.pillarId === selectedPillar.id).length === 0 ? (
                  <p className="text-xs text-[#8A9891] italic py-2">No tasks assigned to this pillar yet.</p>
                ) : (
                  tasks
                    .filter((t) => t.pillarId === selectedPillar.id)
                    .map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between bg-[#1D2922] border border-[#26332C] rounded-xl px-3 py-2 text-xs"
                      >
                        <span className={t.completed ? 'line-through text-[#5E6D66]' : 'text-[#F4F6F5]'}>
                          {t.name}
                        </span>
                        <span className="font-mono-code text-[10px] text-[#8A9891] uppercase">
                          {t.timeBlock}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 border-t border-[#26332C] pt-4">
              <button
                onClick={() => {
                  deletePillar(selectedPillar.id);
                  setSelectedPillar(null);
                }}
                className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-2.5 rounded-xl font-sans text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Pillar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
