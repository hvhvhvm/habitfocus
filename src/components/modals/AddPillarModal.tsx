import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, AlertCircle, Sparkles } from 'lucide-react';

export const AddPillarModal: React.FC = () => {
  const { createPillar, isAddPillarOpen, setIsAddPillarOpen } = useApp();

  const [name, setName] = useState<string>('');
  const [selectedIcon, setSelectedIcon] = useState<string>('🧠');
  const [selectedColor, setSelectedColor] = useState<string>('#3ECF8E');
  const [dailyGoal, setDailyGoal] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isAddPillarOpen) return null;

  const emojis = ['💪', '🥗', '😴', '🧠', '📚', '💧', '💰', '🧘', '🎯', '🎨', '⚡', '🛠️'];
  const colors = ['#3ECF8E', '#F5A623', '#6BA6FF', '#E06B9F', '#B98CF0', '#4ADE80'];

  const presets = [
    { name: 'Physical Mastery', icon: '💪', color: '#3ECF8E', goal: 'Workout / 160g Protein' },
    { name: 'Deep Focus & Code', icon: '🧠', color: '#6BA6FF', goal: '4 Hours Deep Work' },
    { name: 'Nutrition & Macros', icon: '🥗', color: '#F5A623', goal: 'Hit Calorie & Protein Goal' },
    { name: 'Mindset & Discipline', icon: '🧘', color: '#B98CF0', goal: '15m Meditation / Journal' },
    { name: 'Rest & Recovery', icon: '😴', color: '#4ADE80', goal: '8 Hours Sleep' },
  ];

  const applyPreset = (preset: typeof presets[0]) => {
    setName(preset.name);
    setSelectedIcon(preset.icon);
    setSelectedColor(preset.color);
    setDailyGoal(preset.goal);
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a pillar domain name.');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      await createPillar({
        name: name.trim(),
        icon: selectedIcon,
        color: selectedColor,
        dailyGoal: dailyGoal.trim(),
      });

      setIsSubmitting(false);
      setName('');
      setDailyGoal('');
      setIsAddPillarOpen(false);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err?.message || 'Failed to create pillar. Please check connection and try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-[#16201B] border border-[#26332C] rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#26332C] mb-5">
          <div>
            <h3 className="font-space font-bold text-xl text-[#F4F6F5]">
              New Core Pillar
            </h3>
            <p className="font-mono-code text-xs text-[#8A9891]">
              Define a core domain of your 90-day protocol
            </p>
          </div>
          <button
            onClick={() => {
              setErrorMsg('');
              setIsAddPillarOpen(false);
            }}
            className="p-1.5 rounded-lg text-[#8A9891] hover:text-[#F4F6F5] hover:bg-[#1D2922] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Quick Presets */}
        <div className="mb-4">
          <label className="font-mono-code text-[11px] text-[#8A9891] uppercase tracking-wider block mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#3ECF8E]" /> Quick Presets
          </label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset)}
                className="bg-[#1D2922] hover:bg-[#3ECF8E]/10 border border-[#26332C] hover:border-[#3ECF8E]/40 text-xs px-2.5 py-1 rounded-lg text-[#F4F6F5] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>{preset.icon}</span>
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Pillar Name */}
          <div>
            <label className="font-mono-code text-[11px] text-[#8A9891] uppercase tracking-wider block mb-2">
              Pillar Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Reading, Deep Work, Hydration"
              required
              className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl px-4 py-3 text-sm text-[#F4F6F5] placeholder:text-[#5E6D66] focus:outline-none focus:border-[#3ECF8E]"
            />
          </div>

          {/* Emoji Grid */}
          <div>
            <label className="font-mono-code text-[11px] text-[#8A9891] uppercase tracking-wider block mb-2">
              Icon Emoji
            </label>
            <div className="grid grid-cols-6 gap-2">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedIcon(emoji)}
                  className={`aspect-square flex items-center justify-center text-xl rounded-xl border transition-all cursor-pointer ${
                    selectedIcon === emoji
                      ? 'bg-[#3ECF8E]/20 border-[#3ECF8E] scale-105 shadow-inner'
                      : 'bg-[#1D2922] border-[#26332C] hover:border-[#8A9891]'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="font-mono-code text-[11px] text-[#8A9891] uppercase tracking-wider block mb-2">
              Color Accent
            </label>
            <div className="flex items-center gap-3">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-9 h-9 rounded-full transition-all cursor-pointer border-2 ${
                    selectedColor === color ? 'border-white scale-110 shadow-md' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Daily Goal */}
          <div>
            <label className="font-mono-code text-[11px] text-[#8A9891] uppercase tracking-wider block mb-2">
              Daily Goal Target (Optional)
            </label>
            <input
              type="text"
              value={dailyGoal}
              onChange={(e) => setDailyGoal(e.target.value)}
              placeholder="e.g. 20 pages or 160g protein"
              className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl px-4 py-3 text-sm text-[#F4F6F5] placeholder:text-[#5E6D66] focus:outline-none focus:border-[#3ECF8E]"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="w-full bg-[#3ECF8E] hover:bg-[#32B87C] text-[#0B1510] font-space font-bold text-base py-3.5 rounded-xl transition-all cursor-pointer shadow-lg disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-[#0B1510] border-t-transparent rounded-full animate-spin" />
                <span>Creating Pillar...</span>
              </>
            ) : (
              'Create Pillar Domain'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
