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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, updateUserInContext } = useAuth();

  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [proteinData, setProteinData] = useState<ProteinLogData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

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
    setIsLoadingData(true);
    try {
      const [fetchedPillars, fetchedTasks, fetchedRoutines, fetchedProtein] = await Promise.all([
        api.getPillars(),
        api.getTasks(),
        api.getRoutines(),
        api.getProteinLog(),
      ]);
      setPillars(fetchedPillars);
      setTasks(fetchedTasks);
      setRoutines(fetchedRoutines);
      setProteinData(fetchedProtein);
    } catch (err) {
      console.error('Error fetching app data:', err);
    } finally {
      setIsLoadingData(false);
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

      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null } : t))
      );

      if (isCompleting) {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#3ECF8E', '#F5A623', '#6BA6FF'],
        });
      }

      const res = await api.toggleTask(id);
      if (res.tasks) setTasks(res.tasks);
      if (res.user) updateUserInContext(res.user);

      const updatedPillars = await api.getPillars();
      setPillars(updatedPillars);
    } catch (err) {
      console.error('Failed to toggle task:', err);
      refreshData();
    }
  };

  const createTask = async (data: { pillarId: string; timeBlock: TimeBlock; name: string; points?: number; repeatFrequency?: any }) => {
    try {
      const newTask = await api.createTask(data);
      setTasks((prev) => [...prev, newTask]);
      refreshData();
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      await api.deleteTask(id);
      refreshData();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const createPillar = async (data: { name: string; icon?: string; color?: string; dailyGoal?: string }): Promise<Pillar> => {
    try {
      const newPillar = await api.createPillar(data);
      setPillars((prev) => [...prev, newPillar]);
      await refreshData();
      return newPillar;
    } catch (err: any) {
      console.error('Failed to create pillar:', err);
      throw err;
    }
  };

  const deletePillar = async (id: string) => {
    try {
      setPillars((prev) => prev.filter((p) => p.id !== id));
      setTasks((prev) => prev.filter((t) => t.pillarId !== id));
      await api.deletePillar(id);
      await refreshData();
    } catch (err: any) {
      console.error('Failed to delete pillar:', err);
      await refreshData();
    }
  };

  const createRoutine = async (data: Partial<Routine>) => {
    try {
      await api.createRoutine(data);
      refreshData();
    } catch (err) {
      console.error('Failed to create routine:', err);
    }
  };

  const updateRoutine = async (routineId: string, data: Partial<Routine>) => {
    try {
      setRoutines((prev) =>
        prev.map((r) => (r.id === routineId ? { ...r, ...data } : r))
      );
      const res = await api.updateRoutine(routineId, data);
      if (res.routines) setRoutines(res.routines);
    } catch (err) {
      console.error('Failed to update routine:', err);
      refreshData();
    }
  };

  const toggleRoutineSubtask = async (routineId: string, subtaskId: string) => {
    try {
      setRoutines((prev) =>
        prev.map((r) => {
          if (r.id !== routineId) return r;
          const updatedSubtasks = (r.subtasks || []).map((s) =>
            s.id === subtaskId ? { ...s, completed: !s.completed } : s
          );
          const allCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every((s) => s.completed);
          return { ...r, subtasks: updatedSubtasks, completed: allCompleted };
        })
      );

      const res = await api.toggleRoutineSubtask(routineId, subtaskId);
      if (res.routines) setRoutines(res.routines);
    } catch (err) {
      console.error('Failed to toggle routine subtask:', err);
      refreshData();
    }
  };

  const toggleRoutineComplete = async (routineId: string) => {
    try {
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

      const res = await api.toggleRoutineComplete(routineId);
      if (res.routines) setRoutines(res.routines);
      if (res.user) updateUserInContext(res.user);
    } catch (err) {
      console.error('Failed to toggle routine completion:', err);
      refreshData();
    }
  };

  const deleteRoutine = async (routineId: string) => {
    try {
      setRoutines((prev) => prev.filter((r) => r.id !== routineId));
      await api.deleteRoutine(routineId);
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

      const res = await api.addProteinEntry(foodName, proteinGrams, time);
      setProteinData(res.data);
      if (res.user) updateUserInContext(res.user);
    } catch (err) {
      console.error('Failed to log protein entry:', err);
    }
  };

  const deleteProteinEntry = async (id: string) => {
    try {
      const updated = await api.deleteProteinEntry(id);
      setProteinData(updated);
    } catch (err) {
      console.error('Failed to delete protein entry:', err);
    }
  };

  const updateProteinGoal = async (goalGrams: number) => {
    try {
      await api.updateProteinGoal(goalGrams);
      setProteinData((prev) => (prev ? { ...prev, goalGrams } : { goalGrams, totalLogged: 0, entries: [] }));
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
          match = await api.createPillar({
            name: p.name,
            icon: p.icon || '⚡',
            color: p.color || '#3ECF8E',
            dailyGoal: p.dailyGoal || '',
          });
          existingPillars.push(match);
        }
        pillarMap[p.name] = match.id;
      }

      const defaultPillarId = existingPillars[0]?.id;

      for (const block of aiData.timeBlocks || []) {
        for (const t of block.tasks || []) {
          const matchedPillarId = pillarMap[t.pillarName] || defaultPillarId;
          await api.createTask({
            pillarId: matchedPillarId,
            timeBlock: block.timeBlock,
            name: t.name,
            points: t.points || 15,
            repeatFrequency: 'daily',
          });
        }
      }

      await api.createRoutine({
        title: aiData.routineTitle || 'AI Lock-In Protocol',
        description: aiData.summary || 'AI generated daily productivity protocol.',
        category: 'AI Routine',
        pillarId: defaultPillarId,
        timeBlock: '',
        icon: '🤖',
        tasks: (aiData.timeBlocks || []).flatMap((b: any) => (b.tasks || []).map((t: any) => t.name)),
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
      const res = await api.reset90DayProtocol();
      if (res.user) {
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
