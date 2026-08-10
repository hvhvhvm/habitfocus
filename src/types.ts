export type TimeBlock = 'morning' | 'afternoon' | 'evening' | 'night';

export type RepeatFrequency = 'today' | 'daily' | 'weekdays' | 'custom';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  streakDays: number;
  totalPoints: number;
  currentLevel: number;
  lockInMode: boolean;
  dayNumber: number;
  totalDaysGoal: number;
}

export interface Pillar {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string; // e.g. #3ECF8E, #F5A623, #6BA6FF, #E06B9F, #B98CF0
  dailyGoal?: string;
  completedCount: number;
  totalCount: number;
  streakDays: number;
}

export interface Task {
  id: string;
  userId: string;
  pillarId: string;
  timeBlock: TimeBlock;
  name: string;
  completed: boolean;
  completedAt?: string | null;
  points: number;
  repeatFrequency: RepeatFrequency;
  customDays?: string[]; // e.g. ['Mon', 'Wed', 'Fri']
  createdAt: string;
}

export interface RoutineSubtask {
  id: string;
  name: string;
  completed: boolean;
}

export interface Routine {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  pillarId: string;
  timeBlock?: TimeBlock | '' | null;
  icon: string;
  tasks: string[]; // string array of task names
  subtasks?: RoutineSubtask[];
  completed?: boolean;
  frequency?: RepeatFrequency;
  active: boolean;
  isMaster?: boolean;
  masterId?: string;
}

export interface ProteinEntry {
  id: string;
  userId: string;
  foodName: string;
  proteinGrams: number;
  time: string;
  createdAt: string;
}

export interface ProteinLogData {
  goalGrams: number;
  totalLogged: number;
  entries: ProteinEntry[];
}

export interface ProgressEntry {
  date: string; // YYYY-MM-DD
  completed: number;
  total: number;
  points: number;
  pillarStats: Record<string, { name: string; completed: number; total: number; color: string }>;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AIRoutineRequest {
  goal: string;
  timeCommitment: string;
  focusPillars: string[];
}

export interface AIRoutineResponse {
  routineTitle: string;
  summary: string;
  pillars: { name: string; icon: string; color: string; dailyGoal: string }[];
  timeBlocks: {
    timeBlock: TimeBlock;
    tasks: { name: string; pillarName: string; points: number }[];
  }[];
}
