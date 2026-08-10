import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Plus, CheckCircle2, Check, Trash2, ChevronDown, Award, Layers } from 'lucide-react';

export const RoutinesView: React.FC = () => {
  const {
    routines,
    setIsAIRoutineOpen,
    setIsAddRoutineOpen,
    toggleRoutineSubtask,
    toggleRoutineComplete,
    deleteRoutine,
    setActiveTab,
  } = useApp();

  const [expandedRoutines, setExpandedRoutines] = useState<Record<string, boolean>>({});

  // Display master catalog routines in Routines tab
  const catalogRoutines = routines.filter((r) => r.isMaster !== false);

  const toggleExpand = (id: string) => {
    setExpandedRoutines((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="pb-24">
      {/* AI & Custom Routine Header Callout */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#1B2A21] via-[#16201B] to-[#1D2922] border border-[#3ECF8E]/40 rounded-3xl p-5 sm:p-6 mb-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <span className="inline-flex items-center gap-1 bg-[#3ECF8E]/10 border border-[#3ECF8E]/30 text-[#3ECF8E] font-mono-code text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-2">
              <Sparkles className="w-3 h-3" /> Routine Catalog
            </span>
            <h2 className="font-space font-bold text-xl sm:text-2xl text-[#F4F6F5] mb-2 leading-tight">
              Routines & Protocols
            </h2>
            <p className="text-xs text-[#8A9891] mb-4 leading-relaxed">
              Create stretch routines, mobility protocols, and daily habits with sub-tasks. Pair them directly into your Home time blocks anytime!
            </p>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => setIsAddRoutineOpen(true)}
                className="bg-[#3ECF8E] hover:bg-[#32B87C] text-[#0B1510] font-space font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[3]" /> Create Routine
              </button>

              <button
                onClick={() => setIsAIRoutineOpen(true)}
                className="bg-[#1D2922] hover:bg-[#26332C] text-[#3ECF8E] border border-[#3ECF8E]/40 font-mono-code text-xs py-2.5 px-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" /> AI Generator
              </button>
            </div>
          </div>
          <div className="hidden sm:block text-5xl p-3 bg-[#16201B] rounded-2xl border border-[#26332C]">
            🧘
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-space font-bold text-lg text-[#F4F6F5]">
          All Saved Routines ({catalogRoutines.length})
        </h3>
        <button
          onClick={() => setIsAddRoutineOpen(true)}
          className="text-xs font-mono-code text-[#3ECF8E] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> New Routine
        </button>
      </div>

      {/* Routine Cards List */}
      <div className="flex flex-col gap-4">
        {catalogRoutines.length === 0 ? (
          <div className="bg-[#16201B] border border-[#26332C] rounded-2xl p-8 text-center">
            <p className="font-space font-semibold text-base text-[#F4F6F5] mb-2">
              No Routines Saved Yet
            </p>
            <p className="text-xs text-[#8A9891] mb-4">
              Tap 'Create Routine' to save stretch protocols, mobility checklists, or daily habit steps!
            </p>
            <button
              onClick={() => setIsAddRoutineOpen(true)}
              className="bg-[#3ECF8E] text-[#0B1510] font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
            >
              + Create Routine
            </button>
          </div>
        ) : (
          catalogRoutines.map((routine) => {
            const isExpanded = expandedRoutines[routine.id] ?? true;

            const subtasksList = routine.subtasks || (routine.tasks || []).map((t, idx) => ({
              id: `sub_${idx}`,
              name: t,
              completed: false,
            }));

            const completedCount = subtasksList.filter((s) => s.completed).length;
            const totalCount = subtasksList.length;
            const isAllDone = totalCount > 0 && completedCount === totalCount;

            return (
              <div
                key={routine.id}
                className={`bg-[#16201B] border rounded-2xl p-4 sm:p-5 shadow-sm transition-all ${
                  routine.completed || isAllDone
                    ? 'border-[#3ECF8E]/50 bg-[#16201B]/90'
                    : 'border-[#26332C] hover:border-[#3ECF8E]/30'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 bg-[#1D2922] rounded-xl border border-[#26332C]">
                      {routine.icon || '⚡'}
                    </span>
                    <div>
                      <span className="font-mono-code text-[10px] text-[#3ECF8E] uppercase tracking-wider block mb-0.5">
                        {routine.category || 'Routine Protocol'}
                      </span>
                      <h4 className="font-space font-semibold text-base text-[#F4F6F5]">
                        {routine.title}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono-code px-2.5 py-1 rounded-full border ${
                        routine.completed || isAllDone
                          ? 'bg-[#3ECF8E]/20 border-[#3ECF8E] text-[#3ECF8E]'
                          : 'bg-[#1D2922] border-[#26332C] text-[#8A9891]'
                      }`}
                    >
                      {completedCount}/{totalCount} Sub-tasks
                    </span>

                    <button
                      onClick={() => deleteRoutine(routine.id)}
                      className="text-[#5E6D66] hover:text-red-400 p-1 cursor-pointer transition-colors"
                      title="Delete Routine"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {routine.description && (
                  <p className="text-xs text-[#8A9891] mb-3 leading-relaxed">
                    {routine.description}
                  </p>
                )}

                {/* Toggle Expand Sub-tasks Header */}
                <div
                  onClick={() => toggleExpand(routine.id)}
                  className="flex items-center justify-between py-2 px-3 bg-[#1D2922] border border-[#26332C] rounded-xl cursor-pointer hover:bg-[#212D26] transition-colors mb-3"
                >
                  <span className="font-mono-code text-xs text-[#F4F6F5] flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#3ECF8E]" /> Sub-Tasks Checklist
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono-code text-[#8A9891]">
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#8A9891] transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 text-[#3ECF8E]' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Sub-tasks checklist items */}
                {isExpanded && subtasksList.length > 0 && (
                  <div className="space-y-2 mb-4 bg-[#0F1512]/60 border border-[#26332C] rounded-xl p-3">
                    {subtasksList.map((subtask) => (
                      <div
                        key={subtask.id}
                        onClick={() => toggleRoutineSubtask(routine.id, subtask.id)}
                        className="flex items-center gap-2.5 text-xs text-[#F4F6F5] cursor-pointer p-1.5 hover:bg-[#1D2922] rounded-lg transition-colors group"
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                            subtask.completed
                              ? 'bg-[#3ECF8E] border-[#3ECF8E] text-[#0B1510]'
                              : 'border-[#5E6D66] group-hover:border-[#3ECF8E]'
                          }`}
                        >
                          {subtask.completed && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        <span
                          className={`flex-1 transition-all ${
                            subtask.completed ? 'line-through text-[#5E6D66]' : 'text-[#F4F6F5]'
                          }`}
                        >
                          {subtask.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Complete Entire Routine & Pair to Home */}
                <div className="flex items-center justify-between pt-2 border-t border-[#26332C]">
                  <button
                    onClick={() => setActiveTab('home')}
                    className="text-xs font-mono-code text-[#8A9891] hover:text-[#3ECF8E] flex items-center gap-1 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-[#3ECF8E]" /> Pair to Home Time Block
                  </button>

                  <button
                    onClick={() => toggleRoutineComplete(routine.id)}
                    className={`font-space font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                      routine.completed || isAllDone
                        ? 'bg-[#3ECF8E]/20 text-[#3ECF8E] border border-[#3ECF8E]/40'
                        : 'bg-[#3ECF8E] text-[#0B1510] hover:bg-[#32B87C]'
                    }`}
                  >
                    <Award className="w-4 h-4" />
                    {routine.completed || isAllDone ? 'Completed ✓' : 'Complete (+30 pts)'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
