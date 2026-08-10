import { User, Pillar, Task, Routine, AIRoutineRequest, AIRoutineResponse, ProteinEntry, ProteinLogData } from '../types';
import { supabase } from './supabase';

// Set VITE_BACKEND_URL on Vercel to the Render FastAPI service URL.
// Local dev can use same-origin /api with the Vite proxy.
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

async function getSupabaseAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getSupabaseAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers,
  });
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const errorData = await response.json().catch(() => ({ error: `HTTP Error ${response.status}` }));
      throw new Error(errorData.detail || errorData.error || `HTTP Error ${response.status}`);
    }

    throw new Error(`HTTP Error ${response.status}: ${response.statusText || 'Unexpected server response'}`);
  }

  if (!contentType.includes('application/json')) {
    throw new Error(
      `Expected JSON from FastAPI for ${endpoint}, but received ${contentType || 'an unknown content type'}. ` +
      'Check VITE_BACKEND_URL and the backend deployment URL.'
    );
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth: Supabase handles sign-in/sign-up directly on the frontend.
  // FastAPI only needs /api/auth/me to load the user profile after Supabase auth.
  async getCurrentUser(): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/me');
  },

  async updateProfile(data: { name?: string; avatar?: string; proteinGoal?: number }): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/profile', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async reset90DayProtocol(): Promise<{ success: boolean; user: User; tasks: Task[]; routines: Routine[]; message: string }> {
    return request<{ success: boolean; user: User; tasks: Task[]; routines: Routine[]; message: string }>('/api/auth/reset-90day', {
      method: 'POST',
    });
  },

  // Pillars
  async getPillars(): Promise<Pillar[]> {
    return request<Pillar[]>('/api/pillars');
  },

  async createPillar(data: { name: string; icon?: string; color?: string; dailyGoal?: string }): Promise<Pillar> {
    return request<Pillar>('/api/pillars', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deletePillar(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/pillars/${id}`, {
      method: 'DELETE',
    });
  },

  // Tasks
  async getTasks(): Promise<Task[]> {
    return request<Task[]>('/api/tasks');
  },

  async createTask(data: {
    pillarId: string;
    timeBlock: 'morning' | 'afternoon' | 'evening' | 'night';
    name: string;
    points?: number;
    repeatFrequency?: 'today' | 'daily' | 'weekdays' | 'custom';
    customDays?: string[];
  }): Promise<Task> {
    return request<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async toggleTask(id: string): Promise<{ task: Task; tasks: Task[]; user: User | null }> {
    return request<{ task: Task; tasks: Task[]; user: User | null }>(`/api/tasks/${id}/toggle`, {
      method: 'PATCH',
    });
  },

  async deleteTask(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/tasks/${id}`, {
      method: 'DELETE',
    });
  },

  // Routines
  async getRoutines(): Promise<Routine[]> {
    return request<Routine[]>('/api/routines');
  },

  async createRoutine(data: Partial<Routine>): Promise<Routine> {
    return request<Routine>('/api/routines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateRoutine(routineId: string, data: Partial<Routine>): Promise<{ routine: Routine; routines: Routine[] }> {
    return request<{ routine: Routine; routines: Routine[] }>(`/api/routines/${routineId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async toggleRoutineSubtask(routineId: string, subtaskId: string): Promise<{ routine: Routine; routines: Routine[] }> {
    return request<{ routine: Routine; routines: Routine[] }>(`/api/routines/${routineId}/subtask/${subtaskId}/toggle`, {
      method: 'PATCH',
    });
  },

  async toggleRoutineComplete(routineId: string): Promise<{ routine: Routine; routines: Routine[]; user: User | null }> {
    return request<{ routine: Routine; routines: Routine[]; user: User | null }>(`/api/routines/${routineId}/complete`, {
      method: 'PATCH',
    });
  },

  async deleteRoutine(routineId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/routines/${routineId}`, {
      method: 'DELETE',
    });
  },

  // Protein / Macro Tracker
  async getProteinLog(): Promise<ProteinLogData> {
    return request<ProteinLogData>('/api/protein-log');
  },

  async addProteinEntry(foodName: string, proteinGrams: number, time?: string): Promise<{ entry: ProteinEntry; data: ProteinLogData; user: User | null }> {
    return request<{ entry: ProteinEntry; data: ProteinLogData; user: User | null }>('/api/protein-log', {
      method: 'POST',
      body: JSON.stringify({ foodName, proteinGrams, time }),
    });
  },

  async deleteProteinEntry(id: string): Promise<ProteinLogData> {
    return request<ProteinLogData>(`/api/protein-log/${id}`, {
      method: 'DELETE',
    });
  },

  async updateProteinGoal(goalGrams: number): Promise<{ goalGrams: number }> {
    return request<{ goalGrams: number }>('/api/protein-goal', {
      method: 'PUT',
      body: JSON.stringify({ goalGrams }),
    });
  },

  // AI Generator
  async suggestAIRoutine(req: AIRoutineRequest): Promise<AIRoutineResponse> {
    return request<AIRoutineResponse>('/api/ai/suggest-routine', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  // Stats
  async getStats(): Promise<any> {
    return request<any>('/api/stats');
  },
};
