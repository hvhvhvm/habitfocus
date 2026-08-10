import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Trash2, Edit2, Utensils, Check, Bookmark, Star, X, Sparkles, Target, History } from 'lucide-react';

interface CustomPreset {
  id: string;
  name: string;
  grams: number;
  icon?: string;
}

const DEFAULT_CUSTOM_PRESETS: CustomPreset[] = [
  { id: 'cp1', name: 'Protein Bar', grams: 20, icon: '🍫' },
  { id: 'cp2', name: 'Peanut Butter (2 tbsp)', grams: 10, icon: '🥜' },
];

interface ProteinTrackerWidgetProps {
  variant?: 'home' | 'full';
}

export const ProteinTrackerWidget: React.FC<ProteinTrackerWidgetProps> = ({ variant = 'full' }) => {
  const { proteinData, addProteinEntry, deleteProteinEntry, updateProteinGoal } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'presets' | 'custom' | 'history'>('presets');
  const [saveAsPreset, setSaveAsPreset] = useState(true);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [justLoggedItem, setJustLoggedItem] = useState<string | null>(null);

  const [customFoodName, setCustomFoodName] = useState('');
  const [customGrams, setCustomGrams] = useState<number | ''>(25);
  const [goalInput, setGoalInput] = useState<number>(proteinData?.goalGrams || 160);

  // Load custom saved presets from localStorage
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(() => {
    try {
      const saved = localStorage.getItem('lockin_custom_protein_presets');
      return saved ? JSON.parse(saved) : DEFAULT_CUSTOM_PRESETS;
    } catch {
      return DEFAULT_CUSTOM_PRESETS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('lockin_custom_protein_presets', JSON.stringify(customPresets));
    } catch (e) {
      console.error('Failed to save custom presets', e);
    }
  }, [customPresets]);

  const goalGrams = proteinData?.goalGrams || 160;
  const totalLogged = proteinData?.totalLogged || 0;
  const entries = proteinData?.entries || [];

  const percentage = Math.min(100, Math.round((totalLogged / goalGrams) * 100));
  const remaining = Math.max(0, goalGrams - totalLogged);

  const handleQuickAdd = (preset: { name: string; grams: number }) => {
    addProteinEntry(preset.name, preset.grams);
    setJustLoggedItem(`${preset.name} (+${preset.grams}g)`);
    setTimeout(() => setJustLoggedItem(null), 2500);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFoodName.trim() || !customGrams) return;
    const name = customFoodName.trim();
    const grams = Number(customGrams);

    addProteinEntry(name, grams);

    if (saveAsPreset) {
      const exists = customPresets.some(
        (p) => p.name.toLowerCase() === name.toLowerCase() && p.grams === grams
      );
      if (!exists) {
        setCustomPresets((prev) => [
          ...prev,
          { id: `cp_${Date.now()}`, name, grams, icon: '⚡' },
        ]);
      }
    }

    setJustLoggedItem(`${name} (+${grams}g)`);
    setTimeout(() => setJustLoggedItem(null), 2500);
    setCustomFoodName('');
    setCustomGrams(25);
    setActiveTab('presets');
  };

  const handleDeleteCustomPreset = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomPresets((prev) => prev.filter((p) => p.id !== presetId));
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (goalInput > 0) {
      updateProteinGoal(goalInput);
      setIsEditingGoal(false);
    }
  };

  return (
    <>
      {/* HOME COMPACT CARD (Zero Scrolling, Fits Mobile Screen Perfectly) */}
      <div className="bg-[#16201B] border border-[#26332C] rounded-2xl p-3.5 sm:p-4 mb-4 shadow-lg relative overflow-hidden transition-all">
        {/* Accent Glow */}
        <div className="absolute top-0 right-0 w-28 h-28 bg-[#F5A623]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#F5A623]/10 border border-[#F5A623]/30 text-[#F5A623] rounded-xl flex items-center justify-center">
              <Utensils className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-space font-bold text-sm text-[#F4F6F5] block leading-none">
                Daily Protein
              </span>
              <span className="text-[10px] text-[#8A9891]">
                {remaining > 0 ? `${remaining}g remaining` : 'Target achieved! 🎉'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono-code text-xs font-bold text-[#F5A623] bg-[#F5A623]/10 px-2 py-0.5 rounded-lg border border-[#F5A623]/20">
              {totalLogged} / {goalGrams}g
            </span>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-[#F5A623] hover:bg-[#E0961F] text-[#0B1510] font-space font-bold text-xs px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" /> Log
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#1D2922] h-2.5 rounded-full overflow-hidden p-0.5 border border-[#26332C] mb-3">
          <div
            className="bg-gradient-to-r from-[#F5A623] via-[#E59218] to-[#3ECF8E] h-full rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Toast feedback when logged */}
        {justLoggedItem && (
          <div className="mb-2 bg-[#3ECF8E]/15 border border-[#3ECF8E]/30 text-[#3ECF8E] px-2.5 py-1 rounded-xl text-xs font-mono-code flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-1 truncate">
              <Check className="w-3.5 h-3.5 flex-shrink-0" /> Logged {justLoggedItem}
            </span>
            <span className="text-[10px] text-[#8A9891] flex-shrink-0">Added!</span>
          </div>
        )}

        {/* Custom Presets / Quick Actions (Grid format) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {customPresets.length > 0 ? (
            customPresets.slice(0, 3).map((p) => (
              <button
                key={p.id}
                onClick={() => handleQuickAdd(p)}
                className="bg-[#1D2922] hover:bg-[#F5A623]/20 active:scale-95 border border-[#26332C] hover:border-[#F5A623]/40 rounded-xl py-1.5 px-2 text-center transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0"
              >
                <span className="text-xs">{p.icon || '⚡'}</span>
                <span className="font-space font-medium text-[11px] text-[#F4F6F5] truncate">
                  {p.name.split(' ')[0]}
                </span>
                <span className="font-mono-code text-[10px] text-[#F5A623] font-bold">
                  +{p.grams}g
                </span>
              </button>
            ))
          ) : (
            <button
              onClick={() => {
                setActiveTab('custom');
                setIsModalOpen(true);
              }}
              className="col-span-3 bg-[#1D2922] hover:bg-[#212D26] border border-[#26332C] text-[#F5A623] font-mono-code text-xs py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Log Custom Protein Meal
            </button>
          )}
        </div>
      </div>

      {/* POPUP MODAL FOR PROTEIN LOGGING & SAVING */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-[#121B16] border border-[#26332C] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#26332C] flex items-center justify-between bg-[#16201B]">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#F5A623]/10 border border-[#F5A623]/30 text-[#F5A623] rounded-xl">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-space font-bold text-base text-[#F4F6F5]">
                    Protein Tracker
                  </h3>
                  <span className="text-xs text-[#8A9891]">
                    Today: <strong className="text-[#F5A623]">{totalLogged}g</strong> of {goalGrams}g ({percentage}%)
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#8A9891] hover:text-[#F4F6F5] p-1.5 hover:bg-[#1D2922] rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Progress Summary */}
            <div className="px-4 py-3 bg-[#16201B]/50 border-b border-[#26332C]">
              <div className="w-full bg-[#1D2922] h-2.5 rounded-full overflow-hidden p-0.5 border border-[#26332C] mb-1.5">
                <div
                  className="bg-gradient-to-r from-[#F5A623] to-[#3ECF8E] h-full rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono-code text-[#8A9891]">
                <span>Logged: {totalLogged}g</span>
                <span>Remaining: {remaining}g</span>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-[#26332C] bg-[#121B16]">
              <button
                onClick={() => setActiveTab('presets')}
                className={`flex-1 py-2.5 text-xs font-mono-code font-semibold flex items-center justify-center gap-1.5 transition-all border-b-2 cursor-pointer ${
                  activeTab === 'presets'
                    ? 'border-[#F5A623] text-[#F5A623] bg-[#F5A623]/10'
                    : 'border-transparent text-[#8A9891] hover:text-[#F4F6F5]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> 1-Tap Presets
              </button>
              <button
                onClick={() => setActiveTab('custom')}
                className={`flex-1 py-2.5 text-xs font-mono-code font-semibold flex items-center justify-center gap-1.5 transition-all border-b-2 cursor-pointer ${
                  activeTab === 'custom'
                    ? 'border-[#F5A623] text-[#F5A623] bg-[#F5A623]/10'
                    : 'border-transparent text-[#8A9891] hover:text-[#F4F6F5]'
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> Log Custom
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-2.5 text-xs font-mono-code font-semibold flex items-center justify-center gap-1.5 transition-all border-b-2 cursor-pointer ${
                  activeTab === 'history'
                    ? 'border-[#F5A623] text-[#F5A623] bg-[#F5A623]/10'
                    : 'border-transparent text-[#8A9891] hover:text-[#F4F6F5]'
                }`}
              >
                <History className="w-3.5 h-3.5" /> Logged ({entries.length})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {/* TAB 1: PRESETS */}
              {activeTab === 'presets' && (
                <div className="space-y-4">
                  {/* Saved Custom Presets */}
                  <div>
                    <div className="text-[11px] font-mono-code uppercase text-[#F5A623] mb-2 font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3" /> My Saved Custom Presets ({customPresets.length})
                      </span>
                      <button
                        onClick={() => setActiveTab('custom')}
                        className="text-[10px] text-[#3ECF8E] hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Add New
                      </button>
                    </div>

                    {customPresets.length === 0 ? (
                      <div className="text-center py-6 bg-[#16201B] p-4 rounded-xl border border-[#26332C]">
                        <p className="text-xs text-[#8A9891] mb-3">
                          No custom presets saved yet. Create a custom meal and save it for 1-tap fast logging!
                        </p>
                        <button
                          onClick={() => setActiveTab('custom')}
                          className="bg-[#F5A623] hover:bg-[#E0961F] text-[#0B1510] font-space font-bold text-xs py-2 px-4 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" /> Log Custom Meal Now
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {customPresets.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleQuickAdd(p)}
                            className="bg-[#16201B] hover:bg-[#F5A623]/20 active:scale-95 border border-[#F5A623]/30 hover:border-[#F5A623] rounded-xl p-2.5 transition-all cursor-pointer flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm">{p.icon || '⚡'}</span>
                              <span className="font-space font-medium text-xs text-[#F4F6F5] truncate">
                                {p.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="font-mono-code text-xs text-[#F5A623] font-bold">
                                +{p.grams}g
                              </span>
                              <button
                                onClick={(e) => handleDeleteCustomPreset(p.id, e)}
                                className="text-[#8A9891] hover:text-red-400 text-xs ml-1 cursor-pointer"
                                title="Remove preset"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: LOG CUSTOM ITEM */}
              {activeTab === 'custom' && (
                <form onSubmit={handleCustomSubmit} className="space-y-3 bg-[#16201B] p-4 rounded-2xl border border-[#26332C]">
                  <div className="font-space font-semibold text-sm text-[#F4F6F5] flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-[#F5A623]" />
                    Log Custom Food / Meal
                  </div>

                  <div>
                    <label className="text-[11px] font-mono-code text-[#8A9891] block mb-1">
                      Food or Meal Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Protein Bar, Salmon Filet"
                      value={customFoodName}
                      onChange={(e) => setCustomFoodName(e.target.value)}
                      className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl px-3 py-2 text-sm text-[#F4F6F5] focus:outline-none focus:border-[#F5A623]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono-code text-[#8A9891] block mb-1">
                      Protein Content (Grams)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={300}
                      placeholder="e.g. 25"
                      value={customGrams}
                      onChange={(e) => setCustomGrams(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl px-3 py-2 text-sm text-[#F4F6F5] focus:outline-none focus:border-[#F5A623]"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs text-[#8A9891] pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAsPreset}
                      onChange={(e) => setSaveAsPreset(e.target.checked)}
                      className="rounded border-[#26332C] text-[#F5A623] focus:ring-0"
                    />
                    <span>Save to 1-tap quick presets for future logging</span>
                  </label>

                  <button
                    type="submit"
                    className="w-full bg-[#F5A623] hover:bg-[#E0961F] text-[#0B1510] font-space font-bold text-sm py-2.5 rounded-xl transition-all cursor-pointer mt-2"
                  >
                    + Log Entry
                  </button>
                </form>
              )}

              {/* TAB 3: TODAY'S HISTORY & GOAL */}
              {activeTab === 'history' && (
                <div className="space-y-3">
                  {/* Goal Editor */}
                  <div className="bg-[#16201B] border border-[#26332C] p-3 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-[#F5A623]" />
                      <span className="text-xs font-space font-medium text-[#F4F6F5]">
                        Daily Target Goal: <strong className="text-[#F5A623]">{goalGrams}g</strong>
                      </span>
                    </div>
                    <button
                      onClick={() => setIsEditingGoal(!isEditingGoal)}
                      className="text-xs font-mono-code text-[#F5A623] hover:underline cursor-pointer"
                    >
                      {isEditingGoal ? 'Cancel' : 'Edit Goal'}
                    </button>
                  </div>

                  {isEditingGoal && (
                    <form onSubmit={handleSaveGoal} className="p-3 bg-[#1D2922] border border-[#26332C] rounded-xl flex items-center gap-2">
                      <span className="text-xs text-[#8A9891] font-mono-code">New Goal (g):</span>
                      <input
                        type="number"
                        value={goalInput}
                        onChange={(e) => setGoalInput(Number(e.target.value))}
                        className="w-20 bg-[#16201B] border border-[#26332C] rounded-lg px-2 py-1 text-xs text-[#F4F6F5]"
                      />
                      <button
                        type="submit"
                        className="bg-[#F5A623] text-[#0B1510] font-bold text-xs px-3 py-1 rounded-lg cursor-pointer"
                      >
                        Save
                      </button>
                    </form>
                  )}

                  {/* Meals List */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono-code uppercase text-[#8A9891] font-semibold">
                      Today's Logged Meals
                    </div>

                    {entries.length === 0 ? (
                      <p className="text-xs text-[#8A9891] italic py-3 text-center">
                        No protein logged yet today.
                      </p>
                    ) : (
                      entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between bg-[#16201B] border border-[#26332C] rounded-xl p-2.5 text-xs"
                        >
                          <div>
                            <span className="text-[#F4F6F5] font-medium block">{entry.foodName}</span>
                            <span className="text-[10px] text-[#8A9891] font-mono-code">{entry.time}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#F5A623] font-space text-sm">
                              +{entry.proteinGrams}g
                            </span>
                            <button
                              onClick={() => deleteProteinEntry(entry.id)}
                              className="text-[#8A9891] hover:text-red-400 p-1 cursor-pointer"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#16201B] border-t border-[#26332C] flex items-center justify-between text-xs text-[#8A9891]">
              <span className="font-mono-code text-[11px]">
                {entries.length} meal{entries.length === 1 ? '' : 's'} logged today
              </span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="bg-[#1D2922] hover:bg-[#26332C] text-[#F4F6F5] font-mono-code px-3 py-1.5 rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
