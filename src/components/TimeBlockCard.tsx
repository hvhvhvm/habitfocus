import React, { useState } from 'react';
import { TimeBlock, Routine } from '../types';
import { useApp } from '../context/AppContext';
import { ChevronDown, Check, Plus, Trash2, ArrowRight, Sparkles, Calendar, Layers } from 'lucide-react';

interface TimeBlockCardProps {
  timeBlock: TimeBlock;
  title: string;
  timeRange: string;
  icon: string;
  defaultOpen?: boolean;
}

export const TimeBlockCard: React.FC<TimeBlockCardProps> = ({
  timeBlock,
  title,
  timeRange,
  icon,
  defaultOpen = false,
}) => {
  const {
    tasks,
    routines,
    pillars,
    toggleTask,
    deleteTask,
    createTask,
    toggleRoutineSubtask,
    toggleRoutineComplete,
    deleteRoutine,
    updateRoutine,
    openAddRoutineModalForBlock,
    createRoutine,
    setActiveTab,
  } = useApp();

  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const [isAddingInlineTask, setIsAddingInlineTask] = useState<boolean>(false);
  const [isAddingInlineRoutine, setIsAddingInlineRoutine] = useState<boolean>(false);
  
  const [quickTaskName, setQuickTaskName] = useState<string>('');
  const [selectedPillarId, setSelectedPillarId] = useState<string>('');
  const [expandedRoutines, setExpandedRoutines] = useState<Record<string, boolean>>({});

  const blockTasks = tasks.filter((t) => t.timeBlock === timeBlock);
  const blockRoutines = routines.filter((r) => r.timeBlock === timeBlock);

  // Master catalog routines that can be added into home time blocks
  const catalogRoutines = routines.filter((r) => r.isMaster !== false);
  const availableRoutines = catalogRoutines.filter((cat) => {
    return !blockRoutines.some(
      (br) => br.id === cat.id || br.masterId === cat.id || br.title.toLowerCase() === cat.title.toLowerCase()
    );
  });

  // Group tasks by Pillar for top summary row
  const activePillarIds = Array.from(
    new Set([
      ...blockTasks.map((t) => t.pillarId).filter(Boolean),
      ...blockRoutines.map((r) => r.pillarId).filter(Boolean),
    ])
  );

  const toggleRoutineExpand = (rId: string) => {
    setExpandedRoutines((prev) => ({ ...prev, [rId]: !prev[rId] }));
  };

  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskName.trim()) return;

    const targetPillarId = selectedPillarId || pillars[0]?.id;
    await createTask({
      pillarId: targetPillarId,
      timeBlock,
      name: quickTaskName.trim(),
      points: 15,
      repeatFrequency: 'daily',
    });

    setQuickTaskName('');
    setIsAddingInlineTask(false);
  };

  const handleRemoveRoutineFromBlock = async (routine: Routine) => {
    if (routine.isMaster) {
      // Unassign timeBlock from master routine so it leaves Home but stays in Routines catalog tab
      await updateRoutine(routine.id, { timeBlock: '' });
    } else {
      // Delete the scheduled block instance routine
      await deleteRoutine(routine.id);
    }
  };

  const handleAttachExistingRoutine = async (existingRoutine: Routine) => {
    await createRoutine({
      title: existingRoutine.title,
      category: existingRoutine.category,
      pillarId: existingRoutine.pillarId,
      timeBlock: timeBlock,
      icon: existingRoutine.icon,
      description: existingRoutine.description,
      subtasks: (existingRoutine.subtasks || []).map((s) => ({
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        name: s.name,
        completed: false,
      })),
      isMaster: false,
      masterId: existingRoutine.id,
    });
    setIsAddingInlineRoutine(false);
  };

  return (
    <div className="bg-[#16201B] border border-[#26332C] rounded-2xl mb-3 overflow-hidden transition-all shadow-md">
      {/* Header Row */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer hover:bg-[#1D2922]/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{icon}</span>
          <div>
            <div className="font-space font-semibold text-base text-[#F4F6F5]">
              {title}
            </div>
            <div className="font-mono-code text-[11px] text-[#8A9891]">
              {timeRange}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {blockRoutines.length > 0 && (
            <span className="font-mono-code text-[10px] text-[#F5A623] bg-[#F5A623]/10 border border-[#F5A623]/20 px-2 py-0.5 rounded-full hidden sm:inline-block">
              ⚡ {blockRoutines.length} {blockRoutines.length === 1 ? 'Routine' : 'Routines'}
            </span>
          )}
          <span className="font-mono-code text-xs text-[#3ECF8E] bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 px-2.5 py-0.5 rounded-full">
            {blockTasks.filter((t) => t.completed).length}/{blockTasks.length} Tasks
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[#5E6D66] transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#3ECF8E]' : ''
            }`}
          />
        </div>
      </div>

      {/* Pillar Chips Summary Row */}
      {activePillarIds.length > 0 && (
        <div className="flex items-center gap-2 px-3.5 pb-3 overflow-x-auto no-scrollbar">
          {activePillarIds.map((pId) => {
            const pillar = pillars.find((p) => p.id === pId);
            if (!pillar) return null;

            const pTasks = blockTasks.filter((t) => t.pillarId === pId);
            const completedPTasks = pTasks.filter((t) => t.completed).length;

            return (
              <div
                key={pId}
                className="flex items-center gap-1.5 bg-[#1D2922] border border-[#26332C] rounded-lg px-2.5 py-1 text-xs whitespace-nowrap"
              >
                <span>{pillar.icon}</span>
                <span className="font-medium text-[#F4F6F5]">{pillar.name}</span>
                <span className="font-mono-code text-[10px] text-[#8A9891]">
                  {completedPTasks}/{pTasks.length}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Expandable Content Area */}
      {isOpen && (
        <div className="border-t border-[#26332C] bg-[#0F1512]/50 divide-y divide-[#26332C]/60">
          
          {/* Scheduled Routines in this Time Block */}
          {blockRoutines.length > 0 && (
            <div className="p-3 bg-[#131B17]">
              <div className="text-[10px] font-mono-code text-[#3ECF8E] uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#3ECF8E]" /> Routines in {title}
                </span>
                <button
                  onClick={() => setActiveTab('routines')}
                  className="hover:underline text-[10px] text-[#8A9891] flex items-center gap-1 cursor-pointer"
                >
                  Manage All Routines <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-2.5">
                {blockRoutines.map((routine) => {
                  const pillar = pillars.find((p) => p.id === routine.pillarId);
                  const isExpanded = expandedRoutines[routine.id] ?? false;

                  const subtasksList = routine.subtasks || (routine.tasks || []).map((t, idx) => ({
                    id: `sub_${idx}`,
                    name: t,
                    completed: false,
                  }));

                  const completedCount = subtasksList.filter((s) => s.completed).length;
                  const isDone = routine.completed || (subtasksList.length > 0 && completedCount === subtasksList.length);

                  return (
                    <div
                      key={routine.id}
                      className="bg-[#1D2922] border border-[#26332C] rounded-xl p-3 hover:border-[#3ECF8E]/40 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div
                          onClick={() => toggleRoutineExpand(routine.id)}
                          className="flex items-center gap-2.5 flex-1 cursor-pointer min-w-0"
                        >
                          <span className="text-xl p-1 bg-[#16201B] rounded-lg border border-[#26332C]">
                            {routine.icon || '🧘'}
                          </span>
                          <div className="truncate">
                            <span className="font-space font-semibold text-xs text-[#F4F6F5] block truncate">
                              {routine.title}
                            </span>
                            <span className="font-mono-code text-[10px] text-[#8A9891]">
                              {completedCount}/{subtasksList.length} subtasks • {routine.category}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => toggleRoutineComplete(routine.id)}
                            className={`px-2.5 py-1 text-[11px] font-mono-code font-bold rounded-lg transition-all cursor-pointer ${
                              isDone
                                ? 'bg-[#3ECF8E]/20 text-[#3ECF8E] border border-[#3ECF8E]/30'
                                : 'bg-[#3ECF8E] text-[#0B1510] hover:bg-[#32B87C]'
                            }`}
                          >
                            {isDone ? 'Done ✓' : 'Complete'}
                          </button>

                          <button
                            onClick={() => handleRemoveRoutineFromBlock(routine)}
                            className="p-1 text-[#5E6D66] hover:text-red-400 transition-colors cursor-pointer"
                            title="Remove from block"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => toggleRoutineExpand(routine.id)}
                            className="p-1 text-[#8A9891] hover:text-[#F4F6F5] cursor-pointer"
                          >
                            <ChevronDown
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180 text-[#3ECF8E]' : ''
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Expandable Subtasks Checklist right inside time block */}
                      {isExpanded && subtasksList.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-[#26332C] space-y-1.5">
                          {subtasksList.map((st) => (
                            <div
                              key={st.id}
                              onClick={() => toggleRoutineSubtask(routine.id, st.id)}
                              className="flex items-center gap-2 text-xs text-[#F4F6F5] cursor-pointer hover:bg-[#16201B] p-1.5 rounded-lg transition-colors"
                            >
                              <div
                                className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                                  st.completed
                                    ? 'bg-[#3ECF8E] border-[#3ECF8E] text-[#0B1510]'
                                    : 'border-[#5E6D66]'
                                }`}
                              >
                                {st.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <span
                                className={`truncate ${
                                  st.completed ? 'line-through text-[#5E6D66]' : 'text-[#F4F6F5]'
                                }`}
                              >
                                {st.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Individual Tasks List */}
          {blockTasks.length === 0 && blockRoutines.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#8A9891]">
              No tasks or routines scheduled for {title.toLowerCase()}.
            </div>
          ) : (
            blockTasks.map((task) => {
              const taskPillar = pillars.find((p) => p.id === task.pillarId);

              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-3 hover:bg-[#16201B] transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                        task.completed
                          ? 'bg-[#3ECF8E] border-[#3ECF8E] text-[#0B1510]'
                          : 'border-[#5E6D66] hover:border-[#3ECF8E]'
                      }`}
                    >
                      {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    <span
                      className={`text-sm flex-1 truncate transition-all ${
                        task.completed
                          ? 'line-through text-[#5E6D66]'
                          : 'text-[#F4F6F5] font-normal'
                      }`}
                    >
                      {task.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: taskPillar?.color || '#3ECF8E' }}
                      title={taskPillar?.name}
                    />

                    <button
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-[#5E6D66] hover:text-red-400 p-1 transition-opacity cursor-pointer"
                      title="Delete Task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Inline Attach / Pick Existing Routine Drawer */}
          {isAddingInlineRoutine && (
            <div className="p-3 bg-[#131B17] border-t border-[#26332C]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono-code text-xs text-[#3ECF8E] uppercase flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" /> Add Routine to {title}
                </span>
                <button
                  onClick={() => setIsAddingInlineRoutine(false)}
                  className="text-xs text-[#8A9891] hover:text-[#F4F6F5] cursor-pointer"
                >
                  Close
                </button>
              </div>

              {availableRoutines.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono-code text-[#8A9891]">
                    Pick saved routine to add to {title}:
                  </div>
                  {availableRoutines.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between bg-[#1D2922] border border-[#26332C] rounded-xl p-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base">{r.icon}</span>
                        <div className="truncate">
                          <span className="text-[#F4F6F5] font-medium block truncate">
                            {r.title}
                          </span>
                          <span className="text-[10px] text-[#8A9891] block truncate">
                            {r.category} • {(r.subtasks || []).length} subtasks
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAttachExistingRoutine(r)}
                        className="bg-[#3ECF8E]/20 text-[#3ECF8E] hover:bg-[#3ECF8E] hover:text-[#0B1510] text-xs font-mono-code px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                      >
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-xs text-[#8A9891] mb-2">
                    None available. Create routines in the Routines tab first.
                  </p>
                  <button
                    onClick={() => setActiveTab('routines')}
                    className="text-xs font-mono-code text-[#3ECF8E] hover:underline cursor-pointer"
                  >
                    Go to Routines Tab →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Inline Quick Add Task Form */}
          {isAddingInlineTask && (
            <form onSubmit={handleQuickAddTask} className="p-3 bg-[#16201B] flex flex-col gap-2">
              <input
                type="text"
                value={quickTaskName}
                onChange={(e) => setQuickTaskName(e.target.value)}
                placeholder={`New task for ${title}...`}
                className="w-full bg-[#1D2922] border border-[#26332C] rounded-lg px-3 py-2 text-xs text-[#F4F6F5] focus:outline-none focus:border-[#3ECF8E]"
                autoFocus
              />

              <div className="flex items-center justify-between gap-2">
                <select
                  value={selectedPillarId}
                  onChange={(e) => setSelectedPillarId(e.target.value)}
                  className="bg-[#1D2922] border border-[#26332C] rounded-lg px-2 py-1 text-xs text-[#8A9891] focus:outline-none"
                >
                  {pillars.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.icon} {p.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingInlineTask(false)}
                    className="text-xs text-[#8A9891] hover:text-[#F4F6F5] px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-[#3ECF8E] text-[#0B1510] font-semibold text-xs px-3 py-1 rounded-md"
                  >
                    Add Task
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Action Row at Bottom of Card */}
          {!isAddingInlineTask && !isAddingInlineRoutine && (
            <div className="grid grid-cols-2 divide-x divide-[#26332C]">
              <button
                onClick={() => setIsAddingInlineTask(true)}
                className="py-2.5 px-3 flex items-center justify-center gap-1.5 text-xs font-mono-code text-[#8A9891] hover:text-[#3ECF8E] hover:bg-[#1D2922]/40 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> + Task
              </button>

              <button
                onClick={() => setIsAddingInlineRoutine(true)}
                className="py-2.5 px-3 flex items-center justify-center gap-1.5 text-xs font-mono-code text-[#3ECF8E] hover:bg-[#3ECF8E]/10 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> + Routine
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
