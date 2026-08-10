import React from 'react';
import { useApp } from '../context/AppContext';

export const MomentumRing: React.FC = () => {
  const { pillars, tasks, completionRate } = useApp();

  // Calculate SVG stroke offset for ring progress
  const radius = 42;
  const circumference = 2 * Math.PI * radius; // approx 263.89
  const strokeDashoffset = circumference - (completionRate / 100) * circumference;

  return (
    <div className="flex items-center gap-4 sm:gap-6 bg-[#16201B] border border-[#26332C] rounded-2xl p-4 sm:p-5 mb-5 shadow-lg">
      {/* Ring Chart Graphic */}
      <div className="relative w-22 h-22 sm:w-24 sm:h-24 flex-shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
          {/* Background Track */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="#212D26"
            strokeWidth="8"
          />
          {/* Progress Ring */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="#3ECF8E"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center Percentage Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-space font-bold text-lg sm:text-xl text-[#F4F6F5]">
            {completionRate}%
          </span>
          <span className="font-mono-code text-[9px] text-[#8A9891] tracking-wider uppercase">
            TODAY
          </span>
        </div>
      </div>

      {/* Momentum Legend by Pillar */}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {pillars.length === 0 ? (
          <div className="text-xs text-[#8A9891]">No pillars configured yet.</div>
        ) : (
          pillars.map((pillar) => {
            const pillarTasks = tasks.filter((t) => t.pillarId === pillar.id);
            const completedPillarTasks = pillarTasks.filter((t) => t.completed).length;
            const totalPillarTasks = pillarTasks.length;

            return (
              <div key={pillar.id} className="flex items-center gap-2 text-xs font-sans">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: pillar.color || '#3ECF8E' }}
                />
                <span className="flex-1 text-[#F4F6F5] font-medium truncate">
                  {pillar.icon} {pillar.name}
                </span>
                <span className="font-mono-code text-[11px] text-[#8A9891]">
                  {completedPillarTasks}/{totalPillarTasks}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
