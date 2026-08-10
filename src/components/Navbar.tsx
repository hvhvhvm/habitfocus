import React from 'react';
import { useApp } from '../context/AppContext';
import { Home, Target, Plus, Repeat, BarChart2, User } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, setIsAddTaskOpen } = useApp();

  return (
    <div className="sticky bottom-0 left-0 right-0 z-40 bg-[#0C110D]/95 backdrop-blur-md border-t border-[#26332C] px-3 py-2.5 -mx-3.5 sm:-mx-5 -mb-3.5 sm:-mb-5 mt-6 rounded-b-[28px] sm:rounded-b-[32px] shadow-2xl">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Home */}
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 font-mono-code text-[9px] tracking-wider uppercase transition-all cursor-pointer ${
            activeTab === 'home' ? 'text-[#3ECF8E]' : 'text-[#5E6D66] hover:text-[#8A9891]'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </button>

        {/* Pillars */}
        <button
          onClick={() => setActiveTab('pillars')}
          className={`flex flex-col items-center gap-1 font-mono-code text-[9px] tracking-wider uppercase transition-all cursor-pointer ${
            activeTab === 'pillars' ? 'text-[#3ECF8E]' : 'text-[#5E6D66] hover:text-[#8A9891]'
          }`}
        >
          <Target className="w-5 h-5" />
          <span>Pillars</span>
        </button>

        {/* Quick Add Button */}
        <button
          onClick={() => setIsAddTaskOpen(true)}
          className="w-12 h-12 rounded-full bg-[#3ECF8E] hover:bg-[#32B87C] active:scale-95 flex items-center justify-center text-[#0B1510] text-2xl font-bold -mt-5 shadow-lg shadow-[#3ECF8E]/30 transition-all cursor-pointer"
          title="Add Task Protocol"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* Routines */}
        <button
          onClick={() => setActiveTab('routines')}
          className={`flex flex-col items-center gap-1 font-mono-code text-[9px] tracking-wider uppercase transition-all cursor-pointer ${
            activeTab === 'routines' ? 'text-[#3ECF8E]' : 'text-[#5E6D66] hover:text-[#8A9891]'
          }`}
        >
          <Repeat className="w-5 h-5" />
          <span>Routines</span>
        </button>

        {/* Progress / Stats */}
        <button
          onClick={() => setActiveTab('progress')}
          className={`flex flex-col items-center gap-1 font-mono-code text-[9px] tracking-wider uppercase transition-all cursor-pointer ${
            activeTab === 'progress' ? 'text-[#3ECF8E]' : 'text-[#5E6D66] hover:text-[#8A9891]'
          }`}
        >
          <BarChart2 className="w-5 h-5" />
          <span>Stats</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 font-mono-code text-[9px] tracking-wider uppercase transition-all cursor-pointer ${
            activeTab === 'profile' ? 'text-[#3ECF8E]' : 'text-[#5E6D66] hover:text-[#8A9891]'
          }`}
        >
          <User className="w-5 h-5" />
          <span>Profile</span>
        </button>
      </div>
    </div>
  );
};
