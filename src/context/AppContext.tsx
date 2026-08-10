import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Pillar, Task, Routine, TimeBlock, ProteinLogData } from '../types';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';
import confetti from 'canvas-confetti';

interface AppContextType {
  pillars: Pillar[];
  tasks: Task[];
  routines: Routine[];
  proteinData: ProteinLogData | null;
  isLoadingData: boolean;
  activeTab: 'home' | 'pillars' | 'add' | 'routines' | 'progress' | 'profile';
  setActiveTab: (tab: 'home' | 'pillars' | 'add' | 'routines' | 'progress' | 'profile') => void;
  viewMode: 'mobile' | 'desktop';
  setViewMode: (mode: 'mobile' | 'desktop') => void;
  isAddTaskOpen: boolean;
  setIsAddTaskOpen: (open: boolean) => void;
  isAddPillarOpen: boolean;
  setIsAddPillarOpen: (open: boolean) => void;
  isAddRoutineOpen: boolean;
  setIsAddRoutineOpen: (open: boolean) => void;
  routineDefaultTimeBlock: TimeBlock;
  openAddRoutineModalForBlock: (tb?: TimeBlock) => void;
  isAIRoutineOpen: boolean;
  setIsAIRoutineOpen: (open: boolean) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  
  // Derived state & helpers
  currentBlock: TimeBlock;
  heroFocusTask: Task | null;
  nextFocusTask: Task | null;
  completionRate: number;
  totalTasksCount: number;
  completedTasksCount: number;
  
  // Actions
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  createTask: (data: { pillarId: string; timeBlock: TimeBlock; name: string; points?: number; repeatFrequency?: any }) => Promise<void>;
  createPillar: (data: { name: string; icon?: string; color?: string; dailyGoal?: string }) => Promise<Pillar>;
  deletePillar: (id: string) => Promise<void>;
  createRoutine: (data: Partial<Routine>) => Promise<void>;
  updateRoutine: (routineId: string, data: Partial<Routine>) => Promise<void>;
  toggleRoutineSubtask: (routineId: string, subtaskId: string) => Promise<void>;
  toggleRoutineComplete: (routineId: string) => Promise<void>;
  deleteRoutine: (routineId: string) => Promise<void>;
  addProteinEntry: (foodName: string, proteinGrams: number, time?: string) => Promise<void>;
  deleteProteinEntry: (id: string) => Promise<void>;
  updateProteinGoal: (goalGrams: number) => Promise<void>;
  importAIRoutine: (aiData: any) => Promise<void>;
  reset90DayProtocol: () => Promise<void>;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function getCurrentTimeBlock(): TimeBlock {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

const DEFAULT_PILLARS: Pillar[] = [
  { id: 'pil_fit', userId: 'usr', name: 'Physical Mastery', icon: '💪', color: '#3ECF8E', dailyGoal: 'Workout / 160g Protein', completedCount: 0, totalCount: 0, streakDays: 3 },
  { id: 'pil_focus', userId: 'usr', name: 'Deep Focus & Code', icon: '🧠', color: '#6BA6FF', dailyGoal: '4 Hours Deep Work', completedCount: 0, totalCount: 0, streakDays: 5 },
  { id: 'pil_mind', userId: 'usr', name: 'Mindset & Discipline', icon: '🔥', color: '#F5A623', dailyGoal: 'Cold Shower / Reading', completedCount: 0, totalCount: 0, streakDays: 2 },
];

const DEFAULT_ROUTINES: Routine[] = [
  {
    id: 'r_morn',
    userId: 'usr',
    title: 'Morning Lock-In Protocol',
    category: 'Morning Routine',
    pillarId: 'pil_fit',
    timeBlock: 'morning',
    icon: '🌅',
    description: 'Essential morning alignment routine to kickstart focus & hydration.',
    tasks: ['500ml Water + Salt', '5-Min Sunlight', 'Cold Shower', 'Goal Review'],
    subtasks: [
      { id: 'st1', name: '500ml Cold Water + Electrolytes', completed: false },
      { id: 'st2', name: '5-Min Direct Sunlight Exposure', completed: false },
      { id: 'st3', name: '2-Min Cold Shower Reset', completed: false },
      { id: 'st4', name: 'Review Top 3 Goals for Today', completed: false },
    ],
    completed: false,
    isMaster: true,
    active: true,
  },
  {
    id: 'r_stretch',
    userId: 'usr',
    title: 'Post-Workout Mobility & Stretch',
    category: 'Stretch Routine',
    pillarId: 'pil_fit',
    timeBlock: 'afternoon',
    icon: '🧘',
    description: '10-minute mobility and hamstring/hip opener sequence.',
    tasks: ['Quad Stretch', 'Pigeon Pose', 'Cat Cow', 'Deep Breathing'],
    subtasks: [
      { id: 'st10', name: 'Hamstring & Quad Stretch (60s)', completed: false },
      { id: 'st11', name: 'Hip Opener Pigeon Pose (60s)', completed: false },
      { id: 'st12', name: 'Spinal Decompression & Deep Breathing', completed: false },
    ],
    completed: false,
    isMaster: true,
    active: true,
  },
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, updateUserInContext } = useAuth();

  const [pillars, setPillars] = useState<Pillar[]>(() => {
    const saved = localStorage.getItem('lockin_pillars');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return DEFAULT_PILLARS;
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('lockin_tasks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  const [routines, setRoutines] = useState<Routine[]>(() => {
    const saved = localStorage.getItem('lockin_routines');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return DEFAULT_ROUTINES;
  });

  const [proteinData, setProteinData] = useState<ProteinLogData | null>(() => {
    const saved = localStorage.getItem('lockin_protein');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.goalGrams === 'number') return parsed;
      } catch (e) {}
    }
    return { goalGrams: 160, totalLogged: 0, entries: [] };
  });
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'home' | 'pillars' | 'add' | 'routines' | 'progress' | 'profile'>('home');
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>('mobile');

  const [isAddTaskOpen, setIsAddTaskOpen] = useState<boolean>(false);
  const [isAddPillarOpen, setIsAddPillarOpen] = useState<boolean>(false);
  const [isAddRoutineOpen, setIsAddRoutineOpen] = useState<boolean>(false);
  const [routineDefaultTimeBlock, setRoutineDefaultTimeBlock] = useState<TimeBlock>('morning');
  const [isAIRoutineOpen, setIsAIRoutineOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const openAddRoutineModalForBlock = (tb?: TimeBlock) => {
    if (tb) setRoutineDefaultTimeBlock(tb);
    setIsAddRoutineOpen(true);
  };

  const currentBlock = getCurrentTimeBlock();

  const refreshData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [fetchedPillars, fetchedTasks, fetchedRoutines, fetchedProtein] = await Promise.all([
        api.getPillars().catch(() => null),
        api.getTasks().catch(() => null),
        api.getRoutines().catch(() => null),
        api.getProteinLog().catch(() => null),
      ]);

      if (fetchedPillars && Array.isArray(fetchedPillars) && fetchedPillars.length > 0) {
        setPillars(fetchedPillars);
        localStorage.setItem('lockin_pillars', JSON.stringify(fetchedPillars));
      }
      if (fetchedTasks && Array.isArray(fetchedTasks)) {
        setTasks(fetchedTasks);
        localStorage.setItem('lockin_tasks', JSON.stringify(fetchedTasks));
      }
      if (fetchedRoutines && Array.isArray(fetchedRoutines) && fetchedRoutines.length > 0) {
        setRoutines(fetchedRoutines);
        localStorage.setItem('lockin_routines', JSON.stringify(fetchedRoutines));
      }
      if (fetchedProtein) {
        setProteinData(fetchedProtein);
      }
    } catch (err) {
      console.warn('Backend sync skipped, using local state:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    }
  }, [isAuthenticated, refreshData]);

  // Derived state calculations
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter((t) => t.completed).length;
  const completionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Priority ordered uncompleted tasks: current block first, then rest
  const currentBlockUncompletedTasks = tasks.filter((t) => t.timeBlock === currentBlock && !t.completed);
  const otherUncompletedTasks = tasks.filter((t) => t.timeBlock !== currentBlock && !t.completed);
  const uncompletedTasksOrdered = [...currentBlockUncompletedTasks, ...otherUncompletedTasks];

  const heroFocusTask = uncompletedTasksOrdered[0] || null;
  const nextFocusTask = uncompletedTasksOrdered[1] || null;

  const toggleTask = async (id: string) => {
    try {
      const targetTask = tasks.find((t) => t.id === id);
      const isCompleting = targetTask ? !targetTask.completed : false;

      setTasks((prev) => {
        const updated = prev.map((t) => (t.id === id ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null } : t));
        localStorage.setItem('lockin_tasks', JSON.stringify(updated));
        return updated;
      });

      if (isCompleting) {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#3ECF8E', '#F5A623', '#6BA6FF'],
        });
      }

      const res = await api.toggleTask(id).catch(() => null);
      if (res?.tasks) {
        setTasks(res.tasks);
        localStorage.setItem('lockin_tasks', JSON.stringify(res.tasks));
      }
      if (res?.user) updateUserInContext(res.user);
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const createTask = async (data: { pillarId: string; timeBlock: TimeBlock; name: string; points?: number; repeatFrequency?: any }) => {
    const fallbackPillarId = data.pillarId || pillars[0]?.id || 'pil_fit';

    const tempTask: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: 'local',
      pillarId: fallbackPillarId,
      timeBlock: data.timeBlock,
      name: data.name.trim(),
      completed: false,
      points: data.points || 15,
      repeatFrequency: data.repeatFrequency || 'daily',
      createdAt: new Date().toISOString(),
    };

    setTasks((prev) => {
      const updated = [...prev, tempTask];
      localStorage.setItem('lockin_tasks', JSON.stringify(updated));
      return updated;
    });

    try {
      const serverTask = await api.createTask({ ...data, pillarId: fallbackPillarId });
      if (serverTask && serverTask.id) {
        setTasks((prev) => {
          const updated = prev.map((t) => (t.id === tempTask.id ? serverTask : t));
          localStorage.setItem('lockin_tasks', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err: any) {
      console.warn('Backend API task sync offline, saved task locally:', err);
    }
  };

  const deleteTask = async (id: string) => {
    setTasks((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      localStorage.setItem('lockin_tasks', JSON.stringify(updated));
      return updated;
    });
    try {
      await api.deleteTask(id).catch(() => null);
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const createPillar = async (data: { name: string; icon?: string; color?: string; dailyGoal?: string }): Promise<Pillar> => {
    const tempPillar: Pillar = {
      id: `pil_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: 'local',
      name: data.name.trim(),
      icon: data.icon || '🧠',
      color: data.color || '#3ECF8E',
      dailyGoal: data.dailyGoal || 'Daily Focus Domain',
      completedCount: 0,
      totalCount: 0,
      streakDays: 1,
    };

    // Update state immediately for instant UI feedback!
    setPillars((prev) => {
      const updated = [...prev, tempPillar];
      localStorage.setItem('lockin_pillars', JSON.stringify(updated));
      return updated;
    });

    try {
      const serverPillar = await api.createPillar(data);
      if (serverPillar && serverPillar.id) {
        setPillars((prev) => {
          const updated = prev.map((p) => (p.id === tempPillar.id ? serverPillar : p));
          localStorage.setItem('lockin_pillars', JSON.stringify(updated));
          return updated;
        });
        return serverPillar;
      }
    } catch (err: any) {
      console.warn('Backend API pillar sync offline, saved pillar locally:', err);
    }

    return tempPillar;
  };

  const deletePillar = async (id: string) => {
    setPillars((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      localStorage.setItem('lockin_pillars', JSON.stringify(updated));
      return updated;
    });
    setTasks((prev) => {
      const updated = prev.filter((t) => t.pillarId !== id);
      localStorage.setItem('lockin_tasks', JSON.stringify(updated));
      return updated;
    });
    try {
      await api.deletePillar(id).catch(() => null);
    } catch (err: any) {
      console.error('Failed to delete pillar:', err);
    }
  };

  const createRoutine = async (data: Partial<Routine>) => {
    const routineTitle = data.title || data.name || 'New Protocol Routine';
    const subtaskItems = data.subtasks || (data.tasks || []).map((tName, idx) => ({
      id: `sub_${Date.now()}_${idx}`,
      name: tName,
      completed: false,
    }));

    const newRoutine: Routine = {
      id: `r_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: 'local',
      title: routineTitle,
      category: data.category || 'Daily Routine',
      pillarId: data.pillarId || pillars[0]?.id || 'pil_fit',
      timeBlock: data.timeBlock || '',
      icon: data.icon || '🧘',
      description: data.description || '',
      tasks: subtaskItems.map((s) => s.name),
      subtasks: subtaskItems,
      completed: false,
      isMaster: data.isMaster !== undefined ? data.isMaster : true,
      active: true,
    };

    // Save to state & local storage immediately for 0ms latency UI response!
    setRoutines((prev) => {
      const updated = [newRoutine, ...prev];
      localStorage.setItem('lockin_routines', JSON.stringify(updated));
      return updated;
    });

    try {
      const serverRoutine = await api.createRoutine(data);
      if (serverRoutine && serverRoutine.id) {
        setRoutines((prev) => {
          const updated = prev.map((r) => (r.id === newRoutine.id ? { ...newRoutine, ...serverRoutine } : r));
          localStorage.setItem('lockin_routines', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err: any) {
      console.warn('Backend API routine sync offline, saved routine locally:', err);
    }
  };

  const updateRoutine = async (routineId: string, data: Partial<Routine>) => {
    setRoutines((prev) => {
      const updated = prev.map((r) => (r.id === routineId ? { ...r, ...data } : r));
      localStorage.setItem('lockin_routines', JSON.stringify(updated));
      return updated;
    });

    try {
      const res = await api.updateRoutine(routineId, data).catch(() => null);
      if (res?.routines) {
        setRoutines(res.routines);
        localStorage.setItem('lockin_routines', JSON.stringify(res.routines));
      }
    } catch (err) {
      console.error('Failed to update routine:', err);
    }
  };

  const toggleRoutineSubtask = async (routineId: string, subtaskId: string) => {
    setRoutines((prev) => {
      const updated = prev.map((r) => {
        if (r.id !== routineId) return r;
        const updatedSubtasks = (r.subtasks || []).map((s) =>
          s.id === subtaskId ? { ...s, completed: !s.completed } : s
        );
        const allCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every((s) => s.completed);
        return { ...r, subtasks: updatedSubtasks, completed: allCompleted };
      });
      localStorage.setItem('lockin_routines', JSON.stringify(updated));
      return updated;
    });

    try {
      const res = await api.toggleRoutineSubtask(routineId, subtaskId).catch(() => null);
      if (res?.routines) {
        setRoutines(res.routines);
        localStorage.setItem('lockin_routines', JSON.stringify(res.routines));
      }
    } catch (err) {
      console.error('Failed to toggle routine subtask:', err);
    }
  };

  const toggleRoutineComplete = async (routineId: string) => {
    const target = routines.find((r) => r.id === routineId);
    const isCompleting = target ? !target.completed : false;

    if (isCompleting) {
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#3ECF8E', '#F5A623', '#B98CF0'],
      });
    }

    setRoutines((prev) => {
      const updated = prev.map((r) => {
        if (r.id !== routineId) return r;
        const nextCompleted = !r.completed;
        const updatedSubtasks = (r.subtasks || []).map((s) => ({ ...s, completed: nextCompleted }));
        return { ...r, completed: nextCompleted, subtasks: updatedSubtasks };
      });
      localStorage.setItem('lockin_routines', JSON.stringify(updated));
      return updated;
    });

    try {
      const res = await api.toggleRoutineComplete(routineId).catch(() => null);
      if (res?.routines) {
        setRoutines(res.routines);
        localStorage.setItem('lockin_routines', JSON.stringify(res.routines));
      }
      if (res?.user) updateUserInContext(res.user);
    } catch (err) {
      console.error('Failed to toggle routine completion:', err);
    }
  };

  const deleteRoutine = async (routineId: string) => {
    setRoutines((prev) => {
      const updated = prev.filter((r) => r.id !== routineId);
      localStorage.setItem('lockin_routines', JSON.stringify(updated));
      return updated;
    });
    try {
      await api.deleteRoutine(routineId).catch(() => null);
    } catch (err) {
      console.error('Failed deleting routine:', err);
    }
  };

  const addProteinEntry = async (foodName: string, proteinGrams: number, time?: string) => {
    try {
      confetti({
        particleCount: 25,
        spread: 50,
        origin: { y: 0.8 },
        colors: ['#F5A623', '#3ECF8E'],
      });

      const res = await api.addProteinEntry(foodName, proteinGrams, time).catch(() => null);
      if (res?.data) {
        setProteinData(res.data);
        localStorage.setItem('lockin_protein', JSON.stringify(res.data));
      } else {
        const newEntry = {
          id: `p_${Date.now()}`,
          userId: 'local',
          foodName,
          proteinGrams,
          time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: new Date().toISOString(),
        };
        setProteinData((prev) => {
          const goalGrams = prev?.goalGrams || 160;
          const entries = [newEntry, ...(prev?.entries || [])];
          const totalLogged = entries.reduce((sum, e) => sum + e.proteinGrams, 0);
          const updated = { goalGrams, totalLogged, entries };
          localStorage.setItem('lockin_protein', JSON.stringify(updated));
          return updated;
        });
      }
      if (res?.user) updateUserInContext(res.user);
    } catch (err) {
      console.error('Failed to log protein entry:', err);
    }
  };

  const deleteProteinEntry = async (id: string) => {
    try {
      const updated = await api.deleteProteinEntry(id).catch(() => null);
      if (updated) {
        setProteinData(updated);
        localStorage.setItem('lockin_protein', JSON.stringify(updated));
      } else {
        setProteinData((prev) => {
          if (!prev) return null;
          const entries = prev.entries.filter((e) => e.id !== id);
          const totalLogged = entries.reduce((sum, e) => sum + e.proteinGrams, 0);
          const updatedData = { ...prev, totalLogged, entries };
          localStorage.setItem('lockin_protein', JSON.stringify(updatedData));
          return updatedData;
        });
      }
    } catch (err) {
      console.error('Failed to delete protein entry:', err);
    }
  };

  const updateProteinGoal = async (goalGrams: number) => {
    setProteinData((prev) => {
      const updated = prev ? { ...prev, goalGrams } : { goalGrams, totalLogged: 0, entries: [] };
      localStorage.setItem('lockin_protein', JSON.stringify(updated));
      return updated;
    });
    try {
      await api.updateProteinGoal(goalGrams).catch(() => null);
    } catch (err) {
      console.error('Failed updating protein goal:', err);
    }
  };

  const importAIRoutine = async (aiData: any) => {
    try {
      const existingPillars = [...pillars];
      const pillarMap: Record<string, string> = {};

      for (const p of aiData.pillars || []) {
        let match = existingPillars.find((ep) => ep.name.toLowerCase() === p.name.toLowerCase());
        if (!match) {
          match = await createPillar({
            name: p.name,
            icon: p.icon || '⚡',
            color: p.color || '#3ECF8E',
            dailyGoal: p.dailyGoal || '',
          });
          existingPillars.push(match);
        }
        pillarMap[p.name] = match.id;
      }

      const defaultPillarId = existingPillars[0]?.id || 'pil_fit';

      for (const block of aiData.timeBlocks || []) {
        for (const t of block.tasks || []) {
          const matchedPillarId = pillarMap[t.pillarName] || defaultPillarId;
          await createTask({
            pillarId: matchedPillarId,
            timeBlock: block.timeBlock,
            name: t.name,
            points: t.points || 15,
            repeatFrequency: 'daily',
          });
        }
      }

      await createRoutine({
        title: aiData.routineTitle || 'AI Lock-In Protocol',
        description: aiData.summary || 'AI generated daily productivity protocol.',
        category: 'AI Routine',
        pillarId: defaultPillarId,
        timeBlock: '',
        icon: '🤖',
        tasks: (aiData.timeBlocks || []).flatMap((b: any) => (b.tasks || []).map((t: any) => t.name)),
        subtasks: (aiData.timeBlocks || []).flatMap((b: any) =>
          (b.tasks || []).map((t: any, idx: number) => ({
            id: `sub_ai_${idx}`,
            name: t.name,
            completed: false,
          }))
        ),
        isMaster: true,
      });

      confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.6 },
      });

      refreshData();
    } catch (err) {
      console.error('Failed importing AI routine:', err);
    }
  };

  const reset90DayProtocol = async () => {
    try {
      const res = await api.reset90DayProtocol().catch(() => null);
      if (res?.user) {
        updateUserInContext(res.user);
      }
      confetti({
        particleCount: 120,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#3ECF8E', '#F5A623', '#6BA6FF', '#FFFFFF'],
      });
      await refreshData();
    } catch (err) {
      console.error('Failed to reset 90-day protocol:', err);
    }
  };

  return (
    <AppContext.Provider
      value={{
        pillars,
        tasks,
        routines,
        proteinData,
        isLoadingData,
        activeTab,
        setActiveTab,
        viewMode,
        setViewMode,
        isAddTaskOpen,
        setIsAddTaskOpen,
        isAddPillarOpen,
        setIsAddPillarOpen,
        isAddRoutineOpen,
        setIsAddRoutineOpen,
        routineDefaultTimeBlock,
        openAddRoutineModalForBlock,
        isAIRoutineOpen,
        setIsAIRoutineOpen,
        isAuthModalOpen,
        setIsAuthModalOpen,
        currentBlock,
        heroFocusTask,
        nextFocusTask,
        completionRate,
        totalTasksCount,
        completedTasksCount,
        toggleTask,
        deleteTask,
        createTask,
        createPillar,
        deletePillar,
        createRoutine,
        updateRoutine,
        toggleRoutineSubtask,
        toggleRoutineComplete,
        deleteRoutine,
        addProteinEntry,
        deleteProteinEntry,
        updateProteinGoal,
        importAIRoutine,
        reset90DayProtocol,
        refreshData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
