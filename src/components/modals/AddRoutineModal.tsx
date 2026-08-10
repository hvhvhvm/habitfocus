import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Plus, Trash2, Sparkles } from 'lucide-react';

export const AddRoutineModal: React.FC = () => {
  const { isAddRoutineOpen, setIsAddRoutineOpen, createRoutine, pillars, routineDefaultTimeBlock } = useApp();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Stretch Routine');
  const [icon, setIcon] = useState('🧘');
  const [description, setDescription] = useState('');
  
  const [subtasks, setSubtasks] = useState<string[]>([
    'Hamstring & Quad Stretch (60s)',
    'Hip Opener Pigeon Pose (60s)',
  ]);
  const [newSubtaskName, setNewSubtaskName] = useState('');

  if (!isAddRoutineOpen) return null;

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskName.trim()) return;
    setSubtasks([...subtasks, newSubtaskName.trim()]);
    setNewSubtaskName('');
  };

  const handleRemoveSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const defaultPillar = pillars[0]?.id;

    await createRoutine({
      title: title.trim(),
      category: category.trim() || 'Daily Routine',
      pillarId: defaultPillar,
      timeBlock: '',
      frequency: 'daily',
      icon,
      description: description.trim(),
      subtasks: subtasks.map((name, idx) => ({
        id: `sub_${Date.now()}_${idx}`,
        name,
        completed: false,
      })),
      isMaster: true,
    });

    // Reset & Close
    setTitle('');
    setDescription('');
    setSubtasks(['Hamstring & Quad Stretch (60s)', 'Hip Opener Pigeon Pose (60s)']);
    setIsAddRoutineOpen(false);
  };

  const iconOptions = ['🧘', '☀️', '🥗', '⚡', '🧠', '🏋️', '💧', '🌙', '🔥'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#16201B] border border-[#26332C] w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={() => setIsAddRoutineOpen(false)}
          className="absolute top-4 right-4 text-[#8A9891] hover:text-[#F4F6F5] p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <span className="p-2.5 bg-[#3ECF8E]/10 text-[#3ECF8E] rounded-xl border border-[#3ECF8E]/20 text-2xl">
            {icon}
          </span>
          <div>
            <h3 className="font-space font-bold text-xl text-[#F4F6F5]">
              Create Routine
            </h3>
            <p className="font-mono-code text-xs text-[#8A9891]">
              Define routine name, category, icon, description & sub-tasks
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Routine Name */}
          <div>
            <label className="block font-mono-code text-xs text-[#8A9891] uppercase mb-1">
              Routine Name *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Post-Workout Stretch & Mobility"
              className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl px-3.5 py-2.5 text-sm text-[#F4F6F5] focus:outline-none focus:border-[#3ECF8E]"
            />
          </div>

          {/* Icon & Category Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono-code text-xs text-[#8A9891] uppercase mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl px-3 py-2 text-xs text-[#F4F6F5] focus:outline-none focus:border-[#3ECF8E]"
              >
                <option value="Stretch Routine">Stretch Routine</option>
                <option value="Morning Routine">Morning Routine</option>
                <option value="Mobility">Mobility & Rehab</option>
                <option value="Nutrition">Nutrition</option>
                <option value="Evening Protocol">Evening Protocol</option>
                <option value="Deep Work">Deep Work</option>
              </select>
            </div>

            <div>
              <label className="block font-mono-code text-xs text-[#8A9891] uppercase mb-1">
                Icon
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {iconOptions.map((ic) => (
                  <button
                    type="button"
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={`p-1.5 rounded-lg text-base transition-all cursor-pointer ${
                      icon === ic
                        ? 'bg-[#3ECF8E] text-[#0B1510] font-bold scale-110'
                        : 'bg-[#1D2922] border border-[#26332C] hover:border-[#3ECF8E]/50'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-mono-code text-xs text-[#8A9891] uppercase mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 10-minute hip and hamstring relief protocol"
              className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl px-3.5 py-2 text-xs text-[#F4F6F5] focus:outline-none focus:border-[#3ECF8E]"
            />
          </div>

          {/* Sub-tasks Section */}
          <div className="pt-2 border-t border-[#26332C]">
            <label className="block font-mono-code text-xs text-[#3ECF8E] uppercase mb-2">
              Routine Sub-Tasks ({subtasks.length})
            </label>

            <div className="space-y-2 mb-3 max-h-36 overflow-y-auto pr-1">
              {subtasks.map((st, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 bg-[#1D2922] border border-[#26332C] rounded-xl px-3 py-2 text-xs text-[#F4F6F5]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E]" />
                    <span className="truncate">{st}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubtask(idx)}
                    className="text-[#8A9891] hover:text-red-400 p-0.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Subtask Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskName}
                onChange={(e) => setNewSubtaskName(e.target.value)}
                placeholder="Add subtask (e.g. Quad Stretch 45s)"
                className="flex-1 bg-[#1D2922] border border-[#26332C] rounded-xl px-3 py-2 text-xs text-[#F4F6F5] focus:outline-none focus:border-[#3ECF8E]"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="bg-[#26332C] hover:bg-[#32B87C] hover:text-[#0B1510] text-[#3ECF8E] font-mono-code text-xs px-3 py-2 rounded-xl border border-[#3ECF8E]/30 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddRoutineOpen(false)}
              className="px-4 py-2 text-xs text-[#8A9891] hover:text-[#F4F6F5] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-[#3ECF8E] hover:bg-[#32B87C] text-[#0B1510] font-space font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Save Routine
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
