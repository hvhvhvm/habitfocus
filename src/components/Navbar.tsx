import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Home, Target, Plus, Repeat, BarChart2, CheckSquare, Sparkles, X } from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    setIsAddTaskOpen,
    setIsAddPillarOpen,
    setIsAddRoutineOpen,
    setIsAIRoutineOpen,
  } = useApp();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close Quick-Action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'pillars', label: 'Pillars', icon: Target },
    { id: 'routines', label: 'Routines', icon: Repeat },
    { id: 'progress', label: 'Stats', icon: BarChart2 },
  ];

  return (
    <div className="sticky bottom-0 left-0 right-0 z-40 bg-[#0C110D]/90 backdrop-blur-xl border-t border-[#26332C]/80 px-3 py-2 -mx-3.5 sm:-mx-5 -mb-3.5 sm:-mb-5 mt-6 rounded-b-[28px] sm:rounded-b-[32px] shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
      
      {/* Central Quick Action Floating Popover Menu */}
      {isMenuOpen && (
        <div
          ref={menuRef}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 w-64 bg-[#16201B] border border-[#26332C] rounded-3xl p-3 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200 z-50 divide-y divide-[#26332C]/60"
        >
          <div className="flex items-center justify-between pb-2 px-2">
            <span className="font-mono-code text-[11px] uppercase tracking-wider text-[#3ECF8E] font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Quick Protocol Actions
            </span>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="text-[#8A9891] hover:text-[#F4F6F5] p-0.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="pt-2 space-y-1.5">
            <button
              onClick={() => {
                setIsMenuOpen(false);
                setIsAddTaskOpen(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-[#1D2922] hover:bg-[#3ECF8E]/15 hover:border-[#3ECF8E]/40 border border-transparent text-left transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-[#3ECF8E]/20 text-[#3ECF8E] flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div>
                <span className="font-space font-semibold text-xs text-[#F4F6F5] block">
                  Add Task Protocol
                </span>
                <span className="font-mono-code text-[10px] text-[#8A9891]">
                  Schedule task into time block
                </span>
              </div>
            </button>

            <button
              onClick={() => {
                setIsMenuOpen(false);
                setIsAddPillarOpen(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-[#1D2922] hover:bg-[#3ECF8E]/15 hover:border-[#3ECF8E]/40 border border-transparent text-left transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-[#6BA6FF]/20 text-[#6BA6FF] flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <span className="font-space font-semibold text-xs text-[#F4F6F5] block">
                  New Core Pillar
                </span>
                <span className="font-mono-code text-[10px] text-[#8A9891]">
                  Create fundamental domain
                </span>
              </div>
            </button>

            <button
              onClick={() => {
                setIsMenuOpen(false);
                setIsAddRoutineOpen(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-[#1D2922] hover:bg-[#3ECF8E]/15 hover:border-[#3ECF8E]/40 border border-transparent text-left transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-[#F5A623]/20 text-[#F5A623] flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                <Repeat className="w-4 h-4" />
              </div>
              <div>
                <span className="font-space font-semibold text-xs text-[#F4F6F5] block">
                  Build Custom Routine
                </span>
                <span className="font-mono-code text-[10px] text-[#8A9891]">
                  Multi-step habit protocol
                </span>
              </div>
            </button>

            <button
              onClick={() => {
                setIsMenuOpen(false);
                setIsAIRoutineOpen(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-gradient-to-r from-[#3ECF8E]/10 to-[#6BA6FF]/10 hover:from-[#3ECF8E]/20 hover:to-[#6BA6FF]/20 border border-[#3ECF8E]/30 text-left transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-[#3ECF8E] text-[#0B1510] flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="font-space font-bold text-xs text-[#3ECF8E] block">
                  AI Protocol Generator
                </span>
                <span className="font-mono-code text-[10px] text-[#8A9891]">
                  Smart habit optimization
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Main 5-Tab Dock Container */}
      <div className="max-w-md mx-auto flex items-center justify-around relative">
        {/* Home */}
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 font-mono-code text-[10px] tracking-wider uppercase transition-all cursor-pointer px-3 py-1 rounded-xl ${
            activeTab === 'home'
              ? 'text-[#3ECF8E] font-bold bg-[#3ECF8E]/10'
              : 'text-[#8A9891] hover:text-[#F4F6F5]'
          }`}
        >
          <Home className={`w-5 h-5 transition-transform ${activeTab === 'home' ? 'scale-110' : ''}`} />
          <span>Home</span>
        </button>

        {/* Pillars */}
        <button
          onClick={() => setActiveTab('pillars')}
          className={`flex flex-col items-center gap-1 font-mono-code text-[10px] tracking-wider uppercase transition-all cursor-pointer px-3 py-1 rounded-xl ${
            activeTab === 'pillars'
              ? 'text-[#3ECF8E] font-bold bg-[#3ECF8E]/10'
              : 'text-[#8A9891] hover:text-[#F4F6F5]'
          }`}
        >
          <Target className={`w-5 h-5 transition-transform ${activeTab === 'pillars' ? 'scale-110' : ''}`} />
          <span>Pillars</span>
        </button>

        {/* Central Pulse Quick-Action Button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`w-12 h-12 rounded-full bg-[#3ECF8E] hover:bg-[#32B87C] active:scale-95 flex items-center justify-center text-[#0B1510] -mt-5 shadow-[0_0_20px_rgba(62,207,142,0.4)] border-2 border-[#0C110D] transition-all cursor-pointer ${
            isMenuOpen ? 'rotate-45 bg-red-400 text-white shadow-red-500/30' : 'hover:scale-105'
          }`}
          title="Quick Add Action Hub"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
        </button>

        {/* Routines */}
        <button
          onClick={() => setActiveTab('routines')}
          className={`flex flex-col items-center gap-1 font-mono-code text-[10px] tracking-wider uppercase transition-all cursor-pointer px-3 py-1 rounded-xl ${
            activeTab === 'routines'
              ? 'text-[#3ECF8E] font-bold bg-[#3ECF8E]/10'
              : 'text-[#8A9891] hover:text-[#F4F6F5]'
          }`}
        >
          <Repeat className={`w-5 h-5 transition-transform ${activeTab === 'routines' ? 'scale-110' : ''}`} />
          <span>Routines</span>
        </button>

        {/* Progress / Stats */}
        <button
          onClick={() => setActiveTab('progress')}
          className={`flex flex-col items-center gap-1 font-mono-code text-[10px] tracking-wider uppercase transition-all cursor-pointer px-3 py-1 rounded-xl ${
            activeTab === 'progress'
              ? 'text-[#3ECF8E] font-bold bg-[#3ECF8E]/10'
              : 'text-[#8A9891] hover:text-[#F4F6F5]'
          }`}
        >
          <BarChart2 className={`w-5 h-5 transition-transform ${activeTab === 'progress' ? 'scale-110' : ''}`} />
          <span>Stats</span>
        </button>
      </div>
    </div>
  );
};
