import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import {
  User,
  LogOut,
  ShieldCheck,
  Zap,
  Lock,
  Key,
  RotateCcw,
  Flame,
  Award,
  Edit2,
  Check,
  Utensils,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

const AVATAR_OPTIONS = ['⚡', '🚀', '💪', '🧠', '🎯', '🔥', '🏆', '👑', '🦁', '🐺'];

export const ProfileView: React.FC = () => {
  const { user, logout, updateUserInContext } = useAuth();
  const { setIsAuthModalOpen, reset90DayProtocol, proteinData, updateProteinGoal } = useApp();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || 'Lock-In Operator');
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || '⚡');
  const [isEditingProtein, setIsEditingProtein] = useState(false);
  const [proteinInput, setProteinInput] = useState(proteinData?.goalGrams || 160);

  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSaveProfile = async () => {
    try {
      const res = await api.updateProfile({ name: nameInput, avatar: selectedAvatar });
      if (res.user) {
        updateUserInContext(res.user);
      }
      setIsEditingName(false);
      setSuccessMsg('Profile details updated!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      console.error('Failed to update profile:', e);
    }
  };

  const handleSaveProtein = async () => {
    try {
      await updateProteinGoal(proteinInput);
      setIsEditingProtein(false);
      setSuccessMsg('Daily protein goal updated!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      console.error('Failed to update protein goal:', e);
    }
  };

  const handleExecute90DayReset = async () => {
    setIsResetting(true);
    try {
      await reset90DayProtocol();
      setIsConfirmingReset(false);
      setSuccessMsg('Protocol successfully reset to Day 1! Ready to Lock-In.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e) {
      console.error('Failed 90-day reset:', e);
    } finally {
      setIsResetting(false);
    }
  };

  const dayNum = user?.dayNumber || 1;
  const totalDays = user?.totalDaysGoal || 90;
  const dayPercentage = Math.min(100, Math.round((dayNum / totalDays) * 100));

  return (
    <div className="pb-28 max-w-2xl mx-auto animate-in fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="font-mono-code text-[11px] tracking-widest uppercase text-[#8A9891] mb-1">
          Lock-In Account & Settings
        </div>
        <h2 className="font-space font-bold text-2xl text-[#F4F6F5]">
          Operator Profile
        </h2>
      </div>

      {successMsg && (
        <div className="mb-5 bg-[#3ECF8E]/15 border border-[#3ECF8E]/40 text-[#3ECF8E] p-3.5 rounded-2xl text-xs font-mono-code flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Profile Info Card */}
      <div className="bg-[#16201B] border border-[#26332C] rounded-3xl p-5 sm:p-6 mb-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#3ECF8E]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#26332C] mb-6">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-16 h-16 rounded-2xl bg-[#1D2922] border border-[#3ECF8E]/40 flex items-center justify-center text-3xl shadow-inner">
                {user?.avatar || '⚡'}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-space font-bold text-xl text-[#F4F6F5]">
                  {user?.name || 'Lock-In Operator'}
                </h3>
                <button
                  onClick={() => setIsEditingName(!isEditingName)}
                  className="text-[#8A9891] hover:text-[#3ECF8E] p-1 transition-colors cursor-pointer"
                  title="Edit Profile"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="font-mono-code text-xs text-[#8A9891]">
                {user?.email || 'demo@lockin.app'}
              </p>

              <div className="inline-flex items-center gap-1.5 bg-[#3ECF8E]/10 border border-[#3ECF8E]/30 text-[#3ECF8E] font-mono-code text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full mt-2">
                <ShieldCheck className="w-3 h-3" /> Authenticated Operator
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-[#1D2922] border border-[#26332C] rounded-2xl px-4 py-2.5 text-center">
              <span className="font-mono-code text-[10px] text-[#8A9891] uppercase block">Streak</span>
              <span className="font-space font-bold text-lg text-[#F5A623] flex items-center justify-center gap-1">
                <Flame className="w-4 h-4 fill-[#F5A623]/20" /> {user?.streakDays || 1} Days
              </span>
            </div>

            <div className="bg-[#1D2922] border border-[#26332C] rounded-2xl px-4 py-2.5 text-center">
              <span className="font-mono-code text-[10px] text-[#8A9891] uppercase block">Level</span>
              <span className="font-space font-bold text-lg text-[#3ECF8E] flex items-center justify-center gap-1">
                <Zap className="w-4 h-4 fill-[#3ECF8E]/20" /> Lvl {user?.currentLevel || 4}
              </span>
            </div>
          </div>
        </div>

        {/* Inline Name / Avatar Editor */}
        {isEditingName && (
          <div className="mb-6 p-4 bg-[#1D2922] border border-[#3ECF8E]/30 rounded-2xl space-y-3 animate-in fade-in">
            <span className="font-space font-semibold text-xs text-[#3ECF8E] uppercase tracking-wider block">
              Update Profile Details
            </span>

            <div>
              <label className="text-[10px] font-mono-code text-[#8A9891] block mb-1 uppercase">Full Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full bg-[#16201B] border border-[#26332C] rounded-xl px-3 py-2 text-sm text-[#F4F6F5] focus:outline-none focus:border-[#3ECF8E]"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono-code text-[#8A9891] block mb-1 uppercase">Avatar Icon</label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    key={av}
                    onClick={() => setSelectedAvatar(av)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all cursor-pointer ${
                      selectedAvatar === av
                        ? 'bg-[#3ECF8E]/20 border-2 border-[#3ECF8E]'
                        : 'bg-[#16201B] border border-[#26332C] hover:border-[#8A9891]'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveProfile}
                className="bg-[#3ECF8E] text-[#0B1510] font-space font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
              >
                Save Profile
              </button>
              <button
                onClick={() => setIsEditingName(false)}
                className="bg-[#16201B] text-[#8A9891] hover:text-[#F4F6F5] text-xs px-3 py-2 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* 90-DAY PROTOCOL CARD */}
        <div className="bg-[#1D2922] border border-[#26332C] rounded-2xl p-4 sm:p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#3ECF8E]" />
              <span className="font-space font-bold text-sm text-[#F4F6F5]">
                90-Day Lock-In Challenge
              </span>
            </div>
            <span className="font-mono-code text-xs text-[#3ECF8E] font-bold">
              Day {dayNum} of {totalDays}
            </span>
          </div>

          <div className="w-full bg-[#16201B] h-3 rounded-full overflow-hidden p-0.5 border border-[#26332C] mb-3">
            <div
              className="bg-gradient-to-r from-[#3ECF8E] to-[#6BA6FF] h-full rounded-full transition-all duration-500"
              style={{ width: `${dayPercentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-[#8A9891] font-mono-code">
            <span>Progress: {dayPercentage}% Completed</span>
            <span>{totalDays - dayNum} Days Remaining</span>
          </div>
        </div>

        {/* PROTEIN GOAL CARD */}
        <div className="bg-[#1D2922] border border-[#26332C] rounded-2xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F5A623]/10 border border-[#F5A623]/30 text-[#F5A623] rounded-xl">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <span className="font-space font-semibold text-xs text-[#F4F6F5] block">
                Daily Protein Target
              </span>
              <span className="font-mono-code text-xs text-[#8A9891]">
                Target: <strong className="text-[#F5A623]">{proteinData?.goalGrams || 160}g</strong> / day
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsEditingProtein(!isEditingProtein)}
            className="text-xs font-mono-code text-[#3ECF8E] hover:underline cursor-pointer"
          >
            {isEditingProtein ? 'Close' : 'Change Goal'}
          </button>
        </div>

        {isEditingProtein && (
          <div className="mb-6 p-4 bg-[#1D2922] border border-[#F5A623]/30 rounded-2xl space-y-2 animate-in fade-in">
            <label className="text-[11px] font-mono-code text-[#8A9891] block">Set Daily Protein Goal (g)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={proteinInput}
                onChange={(e) => setProteinInput(Number(e.target.value))}
                className="w-28 bg-[#16201B] border border-[#26332C] rounded-xl px-3 py-2 text-sm text-[#F4F6F5]"
              />
              <button
                onClick={handleSaveProtein}
                className="bg-[#F5A623] text-[#0B1510] font-space font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
              >
                Save Target
              </button>
            </div>
          </div>
        )}

        {/* DANGER ZONE: 90-DAY RESET BUTTON DAY 1 */}
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h4 className="font-space font-bold text-sm text-red-400 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" /> Reset Protocol to Day 1
              </h4>
              <p className="text-xs text-[#8A9891] mt-0.5 leading-relaxed">
                Start a fresh 90-day Lock-In cycle. Resets your day counter to Day 1 and clears today's completion status.
              </p>
            </div>
          </div>

          {!isConfirmingReset ? (
            <button
              onClick={() => setIsConfirmingReset(true)}
              className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-space font-bold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Reset to Day 1
            </button>
          ) : (
            <div className="p-3 bg-[#121B16] border border-red-500/40 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs text-red-300 font-semibold">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                Are you sure you want to reset your Lock-In protocol to Day 1?
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExecute90DayReset}
                  disabled={isResetting}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-space font-bold text-xs py-2 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {isResetting ? 'Resetting...' : 'Yes, Reset to Day 1'}
                </button>
                <button
                  onClick={() => setIsConfirmingReset(false)}
                  className="bg-[#1D2922] text-[#8A9891] hover:text-[#F4F6F5] text-xs px-3 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AUTH ACTIONS */}
        <div className="flex flex-col gap-2.5 pt-2 border-t border-[#26332C]">
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="w-full bg-[#1D2922] hover:bg-[#212D26] border border-[#26332C] text-[#F4F6F5] font-sans font-semibold text-xs py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Key className="w-4 h-4 text-[#3ECF8E]" /> Switch Account / Register New Account
          </button>

          <button
            onClick={logout}
            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-sans font-semibold text-xs py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Log Out
          </button>
        </div>
      </div>

      {/* Backend API Info */}
      <div className="bg-[#16201B] border border-[#26332C] rounded-2xl p-4 text-xs text-[#8A9891] leading-relaxed">
        <h4 className="font-space font-semibold text-sm text-[#F4F6F5] mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#3ECF8E]" /> System & Security
        </h4>
        <p className="mb-2">
          Your tasks, routines, pillars, and protein stats are safely synchronized with secure token-based user authentication.
        </p>
        <ul className="list-disc list-inside space-y-1 font-mono-code text-[11px] text-[#3ECF8E]">
          <li>Encrypted password hashing and JWT authorization</li>
          <li>RESTful API server endpoints (`/api/auth`, `/api/tasks`, `/api/routines`)</li>
          <li>Server-side Gemini AI integration for routine creation</li>
        </ul>
      </div>
    </div>
  );
};
