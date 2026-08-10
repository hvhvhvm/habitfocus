import { User, Pillar, Task, Routine, AuthState, AIRoutineRequest, AIRoutineResponse, ProteinEntry, ProteinLogData } from '../types';

const TOKEN_KEY = 'lockin_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unexpected error occurred' }));
    throw new Error(errorData.error || `HTTP Error ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    return res;
  },

  async register(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setStoredToken(res.token);
    return res;
  },

  async loginDemo(): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/api/auth/demo', {
      method: 'POST',
    });
    setStoredToken(res.token);
    return res;
  },

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
