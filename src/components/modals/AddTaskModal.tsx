import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TimeBlock, RepeatFrequency } from '../../types';
import { X, Check } from 'lucide-react';

export const AddTaskModal: React.FC = () => {
  const { pillars, createTask, isAddTaskOpen, setIsAddTaskOpen } = useApp();

  const [name, setName] = useState<string>('');
  const [selectedPillarId, setSelectedPillarId] = useState<string>(pillars[0]?.id || '');
  const [selectedTimeBlock, setSelectedTimeBlock] = useState<TimeBlock>('morning');
  const [selectedFreq, setSelectedFreq] = useState<RepeatFrequency>('daily');
  const [points, setPoints] = useState<number>(15);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isAddTaskOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    const targetPillarId = selectedPillarId || pillars[0]?.id || 'pil_fit';

    await createTask({
      pillarId: targetPillarId,
      timeBlock: selectedTimeBlock,
      name: name.trim(),
      points,
      repeatFrequency: selectedFreq,
    });

    setIsSubmitting(false);
    setName('');
    setIsAddTaskOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-[#16201B] border border-[#26332C] rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#26332C] mb-5">
          <h3 className="font-space font-bold text-xl text-[#F4F6F5]">
            New Task
          </h3>
          <button
            onClick={() => setIsAddTaskOpen(false)}
            className="p-1.5 rounded-lg text-[#8A9891] hover:text-[#F4F6F5] hover:bg-[#1D2922]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Task Name */}
          <div>
            <label className="font-mono-code text-[11px] text-[#8A9891] uppercase tracking-wider block mb-2">
              Task Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dead hangs 3×30s or 500ml water"
              required
              className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl px-4 py-3 text-sm text-[#F4F6F5] placeholder:text-[#5E6D66] focus:outline-none focus:border-[#3ECF8E]"
            />
          </div>

          {/* Pillar Selector */}
          <div>
            <label className="font-mono-code text-[11px] text-[#8A9891] uppercase tracking-wider block mb-2">
              Pillar Category
            </label>
            <div className="flex gap-2 flex-wrap">
              {pillars.map((pillar) => {
                const isSelected = (selectedPillarId || pillars[0]?.id) === pillar.id;
                return (
                  <button
                    key={pillar.id}
                    type="button"
                    onClick={() => setSelectedPillarId(pillar.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#3ECF8E]/15 border-[#3ECF8E] text-[#3ECF8E]'
                        : 'bg-[#1D2922] border-[#26332C] text-[#8A9891] hover:text-[#F4F6F5]'
                    }`}
                  >
                    <span>{pillar.icon}</span>
                    <span>{pillar.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Block Selector */}
          <div>
            <label className="font-mono-code text-[11px] text-[#8A9891] uppercase tracking-wider block mb-2">
              Time Block
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'morning', label: '☀️ Morning', sub: '06:00 - 12:00' },
                { id: 'afternoon', label: '✨ Afternoon', sub: '12:00 - 17:00' },
                { id: 'evening', label: '🌇 Evening', sub: '17:00 - 22:00' },
                { id: 'night', label: '🌙 Night', sub: '22:00 - 06:00' },
              ].map((tb) => {
                const isSelected = selectedTimeBlock === tb.id;
                return (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => setSelectedTimeBlock(tb.id as TimeBlock)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#3ECF8E]/15 border-[#3ECF8E] text-[#3ECF8E]'
                        : 'bg-[#1D2922] border-[#26332C] text-[#8A9891] hover:text-[#F4F6F5]'
                    }`}
                  >
                    <span className="text-xs font-semibold">{tb.label}</span>
                    <span className="font-mono-code text-[9px] text-[#5E6D66]">{tb.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Repeat Frequency */}
          <div>
            <label className="font-mono-code text-[11px] text-[#8A9891] uppercase tracking-wider block mb-2">
              Repeats
            </label>
            <div className="flex bg-[#1D2922] border border-[#26332C] rounded-xl p-1">
              {[
                { id: 'today', label: 'Just Today' },
                { id: 'daily', label: 'Daily' },
                { id: 'weekdays', label: 'Weekdays' },
              ].map((freq) => {
                const isSelected = selectedFreq === freq.id;
                return (
                  <button
                    key={freq.id}
                    type="button"
                    onClick={() => setSelectedFreq(freq.id as RepeatFrequency)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      isSelected ? 'bg-[#3ECF8E] text-[#0B1510]' : 'text-[#8A9891] hover:text-[#F4F6F5]'
                    }`}
                  >
                    {freq.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="w-full bg-[#3ECF8E] hover:bg-[#32B87C] text-[#0B1510] font-space font-bold text-base py-3.5 rounded-xl transition-all cursor-pointer shadow-lg disabled:opacity-50 mt-2"
          >
            {isSubmitting ? 'Saving Task...' : 'Save Task Protocol'}
          </button>
        </form>
      </div>
    </div>
  );
};
