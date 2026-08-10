import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { AIRoutineResponse } from '../../types';
import { Sparkles, X, Check, Loader2, Zap } from 'lucide-react';

export const AIRoutineModal: React.FC = () => {
  const { isAIRoutineOpen, setIsAIRoutineOpen, importAIRoutine } = useApp();

  const [goal, setGoal] = useState<string>('Lock in for 90 days: Peak physical condition and extreme focus');
  const [timeCommitment, setTimeCommitment] = useState<string>('60 minutes daily');
  const [selectedPillars, setSelectedPillars] = useState<string[]>(['Fitness', 'Mind', 'Nutrition', 'Sleep']);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generatedResult, setGeneratedResult] = useState<AIRoutineResponse | null>(null);

  if (!isAIRoutineOpen) return null;

  const togglePillarSelection = (pillarName: string) => {
    if (selectedPillars.includes(pillarName)) {
      setSelectedPillars(selectedPillars.filter((p) => p !== pillarName));
    } else {
      setSelectedPillars([...selectedPillars, pillarName]);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setGeneratedResult(null);

    try {
      const result = await api.suggestAIRoutine({
        goal,
        timeCommitment,
        focusPillars: selectedPillars,
      });
      setGeneratedResult(result);
    } catch (err) {
      console.error('Failed generating AI routine:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!generatedResult) return;
    await importAIRoutine(generatedResult);
    setIsAIRoutineOpen(false);
    setGeneratedResult(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#16201B] border border-[#26332C] rounded-3xl p-6 w-full max-w-xl max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#26332C] mb-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#3ECF8E]" />
            <h3 className="font-space font-bold text-xl text-[#F4F6F5]">
              AI Routine Studio
            </h3>
          </div>
          <button
            onClick={() => setIsAIRoutineOpen(false)}
            className="p-1.5 rounded-lg text-[#8A9891] hover:text-[#F4F6F5] hover:bg-[#1D2922]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!generatedResult ? (
          <form onSubmit={handleGenerate} className="flex flex-col gap-5">
            <div>
              <label className="font-mono-code text-[11px] text-[#8A9891] uppercase tracking-wider block mb-2">
                Primary Lock-In Goal
              </label>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Build lean muscle, 200g protein, and 3 hours deep work per day"
                rows={2}
                required
                className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl p-3 text-sm text-[#F4F6F5] focus:outline-none focus:border-[#3ECF8E]"
              />
            </div>

            <div>
              <label className="font-mono-code text-[11px] text-[#8A9891] uppercase tracking-wider block mb-2">
                Target Daily Time Commitment
              </label>
              <input
                type="text"
                value={timeCommitment}
                onChange={(e) => setTimeCommitment(e.target.value)}
                placeholder="e.g. 45-60 minutes total routine time"
                className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl px-4 py-3 text-sm text-[#F4F6F5] focus:outline-none focus:border-[#3ECF8E]"
              />
            </div>

            <div>
              <label className="font-mono-code text-[11px] text-[#8A9891] uppercase tracking-wider block mb-2">
                Focus Pillars To Target
              </label>
              <div className="flex gap-2 flex-wrap">
                {['Fitness', 'Nutrition', 'Sleep', 'Mind', 'Deep Work', 'Hydration'].map((p) => {
                  const isSelected = selectedPillars.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePillarSelection(p)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#3ECF8E]/20 border-[#3ECF8E] text-[#3ECF8E]'
                          : 'bg-[#1D2922] border-[#26332C] text-[#8A9891]'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '} {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#3ECF8E] hover:bg-[#32B87C] text-[#0B1510] font-space font-bold text-base py-3.5 rounded-xl transition-all cursor-pointer shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Synthesizing Gemini Protocol...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" /> Generate Gemini Protocol
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-4 animate-in fade-in">
            <div className="bg-[#1D2922] border border-[#3ECF8E]/40 rounded-2xl p-4">
              <span className="font-mono-code text-[10px] text-[#3ECF8E] uppercase tracking-wider block mb-1">
                Generated Protocol
              </span>
              <h4 className="font-space font-bold text-lg text-[#F4F6F5] mb-1">
                {generatedResult.routineTitle}
              </h4>
              <p className="text-xs text-[#8A9891]">{generatedResult.summary}</p>
            </div>

            {/* Generated Time Blocks */}
            <div className="flex flex-col gap-3">
              {generatedResult.timeBlocks?.map((tb, idx) => (
                <div key={idx} className="bg-[#1D2922] border border-[#26332C] rounded-xl p-3">
                  <div className="font-mono-code text-[11px] text-[#3ECF8E] uppercase mb-2">
                    {tb.timeBlock} Block
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {tb.tasks?.map((t, tIdx) => (
                      <div key={tIdx} className="flex items-center justify-between text-xs text-[#F4F6F5]">
                        <span>• {t.name}</span>
                        <span className="font-mono-code text-[10px] text-[#F5A623]">+{t.points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-[#26332C]">
              <button
                type="button"
                onClick={() => setGeneratedResult(null)}
                className="flex-1 bg-[#1D2922] hover:bg-[#212D26] text-[#8A9891] hover:text-[#F4F6F5] font-sans font-semibold text-xs py-3 rounded-xl"
              >
                ← Regenerate
              </button>
              <button
                type="button"
                onClick={handleImport}
                className="flex-2 bg-[#3ECF8E] hover:bg-[#32B87C] text-[#0B1510] font-space font-bold text-xs py-3 rounded-xl shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" /> Import Protocol To Tasks
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
