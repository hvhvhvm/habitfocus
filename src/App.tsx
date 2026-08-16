import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { TopHeader } from './components/TopHeader';
import { MomentumRing } from './components/MomentumRing';
import { HeroFocusCard } from './components/HeroFocusCard';
import { ProteinTrackerWidget } from './components/ProteinTrackerWidget';
import { TimeBlockCard } from './components/TimeBlockCard';
import { PillarsView } from './components/PillarsView';
import { RoutinesView } from './components/RoutinesView';
import { ProgressView } from './components/ProgressView';
import { ProfileView } from './components/ProfileView';
import { Navbar } from './components/Navbar';
import { AddTaskModal } from './components/modals/AddTaskModal';
import { AddPillarModal } from './components/modals/AddPillarModal';
import { AddRoutineModal } from './components/modals/AddRoutineModal';
import { AIRoutineModal } from './components/modals/AIRoutineModal';
import { AuthModal } from './components/modals/AuthModal';
import { NotificationSettingsModal } from './components/modals/NotificationSettingsModal';
import { DayRoadmapModal } from './components/modals/DayRoadmapModal';
import { Lock, ShieldAlert, Zap, KeyRound } from 'lucide-react';

const ProtectedGate: React.FC = () => {
  const { setIsAuthModalOpen } = useApp();

  return (
    <div className="min-h-screen bg-[#080B09] text-[#F4F6F5] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0F1512] border border-[#26332C] rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#3ECF8E]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="w-16 h-16 bg-[#16201B] border border-[#3ECF8E]/40 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#3ECF8E] shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        <div className="font-mono-code text-xs uppercase tracking-widest text-[#3ECF8E] font-bold mb-1">
          90-Day Lock-In Protocol
        </div>
        <h2 className="font-space font-bold text-2xl text-[#F4F6F5] mb-2">
          Protected Operator Portal
        </h2>
        <p className="text-xs text-[#8A9891] mb-6 leading-relaxed">
          Please log in or register your Supabase account to access your personal habits, 90-day progress, diet logs, and routines.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="w-full bg-[#3ECF8E] hover:bg-[#32B87C] text-[#0B1510] font-space font-bold text-sm py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg"
          >
            <KeyRound className="w-4 h-4" /> Sign In / Create Supabase Account
          </button>


        </div>

        <div className="mt-6 pt-4 border-t border-[#26332C] text-[10px] font-mono-code text-[#5E6D66] flex items-center justify-center gap-1">
          <ShieldAlert className="w-3 h-3 text-[#3ECF8E]" />
          <span>Secured via Supabase Auth & FastAPI Bearer Tokens</span>
        </div>
      </div>

      <AuthModal />
    </div>
  );
};

const MainContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { activeTab, viewMode, currentBlock } = useApp();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080B09] text-[#3ECF8E] flex flex-col items-center justify-center font-mono-code text-xs gap-3">
        <div className="w-8 h-8 border-2 border-[#3ECF8E] border-t-transparent rounded-full animate-spin" />
        <span>Authenticating Operator Session...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <ProtectedGate />;
  }

  return (
    <div className="min-h-screen bg-[#080B09] text-[#F4F6F5] flex flex-col items-center justify-start py-2 sm:py-4 px-2 sm:px-4 font-inter select-none">

      {/* Main Container: Phone Frame vs Desktop Dashboard */}
      <div
        className={`w-full transition-all duration-300 ${
          viewMode === 'mobile'
            ? 'max-w-[420px] bg-[#0F1512] rounded-[32px] sm:rounded-[36px] border border-[#1c2620] shadow-[0_30px_70px_rgba(0,0,0,0.8)] p-3.5 sm:p-5 relative overflow-hidden flex flex-col justify-between min-h-[820px]'
            : 'max-w-5xl bg-[#0F1512] rounded-3xl border border-[#1c2620] shadow-2xl p-5 sm:p-8 relative flex flex-col justify-between'
        }`}
      >
        <TopHeader />

        {/* Tab Views */}
        {activeTab === 'home' && (
          <div className="animate-in fade-in duration-200 space-y-4">
            <MomentumRing />
            <HeroFocusCard />
            <ProteinTrackerWidget variant="home" />

            <div className="font-mono-code text-[11px] tracking-widest uppercase text-[#8A9891] mb-2 flex items-center justify-between">
              <span>Full Day Time Blocks</span>
              <span className="text-[10px] text-[#5E6D66]">4 Blocks</span>
            </div>

            <TimeBlockCard
              timeBlock="morning"
              title="Morning"
              timeRange="06:00 – 12:00"
              icon="☀️"
              defaultOpen={currentBlock === 'morning'}
            />
            <TimeBlockCard
              timeBlock="afternoon"
              title="Afternoon"
              timeRange="12:00 – 17:00"
              icon="✨"
              defaultOpen={currentBlock === 'afternoon'}
            />
            <TimeBlockCard
              timeBlock="evening"
              title="Evening"
              timeRange="17:00 – 22:00"
              icon="🌇"
              defaultOpen={currentBlock === 'evening'}
            />
            <TimeBlockCard
              timeBlock="night"
              title="Night"
              timeRange="22:00 – 06:00"
              icon="🌙"
              defaultOpen={currentBlock === 'night'}
            />
          </div>
        )}

        {activeTab === 'pillars' && <PillarsView />}
        {activeTab === 'routines' && <RoutinesView />}
        {activeTab === 'progress' && <ProgressView />}
        {activeTab === 'profile' && <ProfileView />}

        {/* Bottom Navigation */}
        <Navbar />
      </div>

      {/* Global Modals */}
      <AddTaskModal />
      <AddPillarModal />
      <AddRoutineModal />
      <AIRoutineModal />
      <AuthModal />
      <NotificationSettingsModal />
      <DayRoadmapModal />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <MainContent />
      </AppProvider>
    </AuthProvider>
  );
}
