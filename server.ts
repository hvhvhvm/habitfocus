import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
app.use(express.json());
const PORT = 3000;

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

interface UserData {
  id: string;
  email: string;
  name: string;
  avatar: string;
  dayNumber: number;
  streakDays: number;
  totalDaysGoal: number;
  currentLevel: number;
  points: number;
  proteinGoal: number;
}

interface PillarData {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  dailyGoal: string;
}

interface TaskData {
  id: string;
  userId: string;
  pillarId: string;
  timeBlock: 'morning' | 'afternoon' | 'evening' | 'night';
  name: string;
  points: number;
  completed: boolean;
  repeatFrequency: string;
  customDays: string[];
}

interface SubtaskData {
  id: string;
  text: string;
  duration: string;
  completed: boolean;
}

interface RoutineData {
  id: string;
  userId: string;
  name: string;
  icon: string;
  durationMins: number;
  totalSteps: number;
  completed: boolean;
  subtasks: SubtaskData[];
}

interface ProteinEntryData {
  id: string;
  userId: string;
  foodName: string;
  proteinGrams: number;
  time: string;
}

// In-memory data persistence per user
const dbUsers = new Map<string, UserData>();
const dbPillars = new Map<string, PillarData[]>();
const dbTasks = new Map<string, TaskData[]>();
const dbRoutines = new Map<string, RoutineData[]>();
const dbProtein = new Map<string, ProteinEntryData[]>();

function seedUserDefaults(userId: string) {
  if (!dbPillars.has(userId)) {
    const p1 = { id: `p1_${userId}`, userId, name: "Physical Mastery", icon: "💪", color: "#3ECF8E", dailyGoal: "Workout / 160g Protein" };
    const p2 = { id: `p2_${userId}`, userId, name: "Deep Focus & Code", icon: "🧠", color: "#6BA6FF", dailyGoal: "4 Hours Deep Work" };
    const p3 = { id: `p3_${userId}`, userId, name: "Mindset & Discipline", icon: "🔥", color: "#F5A623", dailyGoal: "Cold Shower / Reading" };
    dbPillars.set(userId, [p1, p2, p3]);

    const t1 = { id: `t1_${userId}`, userId, pillarId: p1.id, timeBlock: "morning" as const, name: "Hydrate 1L Water & Electromix", points: 30, completed: false, repeatFrequency: "daily", customDays: [] };
    const t2 = { id: `t2_${userId}`, userId, pillarId: p2.id, timeBlock: "morning" as const, name: "90-Min Uninterrupted Deep Work Block", points: 100, completed: false, repeatFrequency: "daily", customDays: [] };
    const t3 = { id: `t3_${userId}`, userId, pillarId: p1.id, timeBlock: "afternoon" as const, name: "Hit 160g Daily Protein Target", points: 50, completed: false, repeatFrequency: "daily", customDays: [] };
    const t4 = { id: `t4_${userId}`, userId, pillarId: p3.id, timeBlock: "evening" as const, name: "Evening Review & Tomorrow Planning", points: 40, completed: false, repeatFrequency: "daily", customDays: [] };
    dbTasks.set(userId, [t1, t2, t3, t4]);

    const r1 = {
      id: `r1_${userId}`,
      userId,
      name: "Morning Lock-In Protocol",
      icon: "🌅",
      durationMins: 25,
      totalSteps: 4,
      completed: false,
      subtasks: [
        { id: "st1", text: "500ml Cold Water + Salt", duration: "2 mins", completed: false },
        { id: "st2", text: "5-Min Sunlight Exposure", duration: "5 mins", completed: false },
        { id: "st3", text: "Cold Shower", duration: "5 mins", completed: false },
        { id: "st4", text: "Review Top 3 Goals", duration: "3 mins", completed: false },
      ]
    };
    dbRoutines.set(userId, [r1]);

    dbProtein.set(userId, [
      { id: `pr1_${userId}`, userId, foodName: "Whey Protein Shake", proteinGrams: 30, time: "08:30 AM" },
      { id: `pr2_${userId}`, userId, foodName: "Chicken Breast & Rice", proteinGrams: 55, time: "01:15 PM" },
    ]);
  }
}

async function getAuthenticatedUser(req: express.Request): Promise<UserData | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  let userId = '';
  let email = '';
  let name = '';

  if (token.startsWith('demo_token_')) {
    userId = 'demo_user_123';
    email = 'demo@lockin.app';
    name = 'Lock-In Operator (Demo)';
  } else if (token.includes(':')) {
    const parts = token.split(':');
    userId = parts[0];
    email = parts[1] || `${userId}@lockin.app`;
    const rawName = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').trim();
    name = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : 'Lock-In Operator';
  } else if (SUPABASE_URL && SUPABASE_ANON_KEY && !token.startsWith('usr_')) {
    try {
      const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
      });
      if (res.ok) {
        const data = await res.json();
        userId = data.id;
        email = data.email || `${userId}@lockin.app`;
        name = data.user_metadata?.name || data.user_metadata?.full_name || email.split('@')[0];
      } else {
        userId = `usr_${token.slice(0, 12)}`;
        email = `${userId}@lockin.app`;
        name = 'Lock-In Operator';
      }
    } catch {
      userId = `usr_${token.slice(0, 12)}`;
      email = `${userId}@lockin.app`;
      name = 'Lock-In Operator';
    }
  } else {
    userId = token.startsWith('usr_') ? token : `usr_${token.slice(0, 12)}`;
    email = `${userId}@lockin.app`;
    name = 'Lock-In Operator';
  }

  let user = dbUsers.get(userId);
  if (!user) {
    user = {
      id: userId,
      email,
      name,
      avatar: '⚡',
      dayNumber: 1,
      streakDays: 1,
      totalDaysGoal: 90,
      currentLevel: 4,
      points: 1250,
      proteinGoal: 160,
    };
    dbUsers.set(userId, user);
  }

  seedUserDefaults(userId);
  return user;
}

// Health route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', backend: 'Lock-In Protocol Express Server' });
});

// Auth Routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = (email || '').trim().lowerCase || email.trim().toLowerCase();
  if (!cleanEmail) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  let foundUser = Array.from(dbUsers.values()).find((u) => u.email.toLowerCase() === cleanEmail);
  if (!foundUser) {
    const userId = `usr_${Math.random().toString(36).substring(2, 10)}`;
    const name = cleanEmail.split('@')[0].charAt(0).toUpperCase() + cleanEmail.split('@')[0].slice(1);
    foundUser = {
      id: userId,
      email: cleanEmail,
      name: name || 'Lock-In Operator',
      avatar: '⚡',
      dayNumber: 1,
      streakDays: 1,
      totalDaysGoal: 90,
      currentLevel: 4,
      points: 1250,
      proteinGoal: 160,
    };
    dbUsers.set(userId, foundUser);
    seedUserDefaults(userId);
  }

  const token = `${foundUser.id}:${foundUser.email}`;
  res.json({ user: foundUser, token });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  let foundUser = Array.from(dbUsers.values()).find((u) => u.email.toLowerCase() === cleanEmail);
  if (!foundUser) {
    const userId = `usr_${Math.random().toString(36).substring(2, 10)}`;
    const userName = (name || cleanEmail.split('@')[0]).trim();
    foundUser = {
      id: userId,
      email: cleanEmail,
      name: userName || 'Lock-In Operator',
      avatar: '⚡',
      dayNumber: 1,
      streakDays: 1,
      totalDaysGoal: 90,
      currentLevel: 4,
      points: 1250,
      proteinGoal: 160,
    };
    dbUsers.set(userId, foundUser);
    seedUserDefaults(userId);
  } else if (name) {
    foundUser.name = name;
  }

  const token = `${foundUser.id}:${foundUser.email}`;
  res.json({ user: foundUser, token });
});

app.post('/api/auth/demo', (req, res) => {
  const userId = 'demo_user_123';
  let demoUser = dbUsers.get(userId);
  if (!demoUser) {
    demoUser = {
      id: userId,
      email: 'demo@lockin.app',
      name: 'Lock-In Operator (Demo)',
      avatar: '⚡',
      dayNumber: 1,
      streakDays: 1,
      totalDaysGoal: 90,
      currentLevel: 4,
      points: 1250,
      proteinGoal: 160,
    };
    dbUsers.set(userId, demoUser);
    seedUserDefaults(userId);
  }

  res.json({ user: demoUser, token: 'demo_token_lockin_operator_90' });
});

app.get('/api/auth/me', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json({ user });
});

app.post('/api/auth/profile', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { name, avatar, proteinGoal } = req.body;
  if (name !== undefined) user.name = name;
  if (avatar !== undefined) user.avatar = avatar;
  if (proteinGoal !== undefined && Number(proteinGoal) > 0) user.proteinGoal = Number(proteinGoal);

  res.json({ user });
});

app.post('/api/auth/reset-90day', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  user.dayNumber = 1;
  user.streakDays = 1;
  user.points = 1250;

  const tasks = dbTasks.get(user.id) || [];
  tasks.forEach((t) => (t.completed = false));

  const routines = dbRoutines.get(user.id) || [];
  routines.forEach((r) => {
    r.completed = false;
    r.subtasks.forEach((s) => (s.completed = false));
  });

  dbProtein.set(user.id, []);

  res.json({
    success: true,
    user,
    tasks,
    routines,
    message: '90-Day Lock-In Protocol reset to Day 1!',
  });
});

// Pillar Routes
app.get('/api/pillars', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json(dbPillars.get(user.id) || []);
});

app.post('/api/pillars', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { name, icon, color, dailyGoal } = req.body;
  const newPillar: PillarData = {
    id: `p_${Math.random().toString(36).substring(2, 9)}`,
    userId: user.id,
    name: name || 'New Pillar',
    icon: icon || '🔥',
    color: color || '#3ECF8E',
    dailyGoal: dailyGoal || '1 Task/day',
  };

  const pillars = dbPillars.get(user.id) || [];
  pillars.push(newPillar);
  dbPillars.set(user.id, pillars);

  res.json(newPillar);
});

app.delete('/api/pillars/:id', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const pillarId = req.params.id;
  const pillars = (dbPillars.get(user.id) || []).filter((p) => p.id !== pillarId);
  dbPillars.set(user.id, pillars);

  res.json({ success: true });
});

// Task Routes
app.get('/api/tasks', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json(dbTasks.get(user.id) || []);
});

app.post('/api/tasks', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { pillarId, timeBlock, name, points, repeatFrequency, customDays } = req.body;
  const newTask: TaskData = {
    id: `t_${Math.random().toString(36).substring(2, 9)}`,
    userId: user.id,
    pillarId: pillarId || (dbPillars.get(user.id)?.[0]?.id || 'p1'),
    timeBlock: timeBlock || 'morning',
    name: name || 'New Protocol Task',
    points: points || 50,
    completed: false,
    repeatFrequency: repeatFrequency || 'daily',
    customDays: customDays || [],
  };

  const tasks = dbTasks.get(user.id) || [];
  tasks.push(newTask);
  dbTasks.set(user.id, tasks);

  res.json(newTask);
});

app.patch('/api/tasks/:id/toggle', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const taskId = req.params.id;
  const tasks = dbTasks.get(user.id) || [];
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  task.completed = !task.completed;
  if (task.completed) {
    user.points += task.points;
  } else {
    user.points = Math.max(0, user.points - task.points);
  }

  res.json({ task, tasks, user });
});

app.delete('/api/tasks/:id', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const taskId = req.params.id;
  const tasks = (dbTasks.get(user.id) || []).filter((t) => t.id !== taskId);
  dbTasks.set(user.id, tasks);

  res.json({ success: true });
});

// Routine Routes
app.get('/api/routines', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json(dbRoutines.get(user.id) || []);
});

app.post('/api/routines', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { name, icon, durationMins, subtasks } = req.body;
  const newRoutine: RoutineData = {
    id: `r_${Math.random().toString(36).substring(2, 9)}`,
    userId: user.id,
    name: name || 'New Protocol Routine',
    icon: icon || '🌅',
    durationMins: durationMins || 20,
    totalSteps: subtasks?.length || 3,
    completed: false,
    subtasks: subtasks || [
      { id: 'st1', text: 'Step 1', duration: '5 mins', completed: false },
      { id: 'st2', text: 'Step 2', duration: '10 mins', completed: false },
    ],
  };

  const routines = dbRoutines.get(user.id) || [];
  routines.push(newRoutine);
  dbRoutines.set(user.id, routines);

  res.json(newRoutine);
});

app.patch('/api/routines/:id', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const routineId = req.params.id;
  const routines = dbRoutines.get(user.id) || [];
  const routine = routines.find((r) => r.id === routineId);
  if (!routine) {
    res.status(404).json({ error: 'Routine not found' });
    return;
  }

  const { name, icon, durationMins, subtasks } = req.body;
  if (name) routine.name = name;
  if (icon) routine.icon = icon;
  if (durationMins) routine.durationMins = durationMins;
  if (subtasks) {
    routine.subtasks = subtasks;
    routine.totalSteps = subtasks.length;
  }

  res.json({ routine, routines });
});

app.patch('/api/routines/:id/subtask/:subtaskId/toggle', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { id, subtaskId } = req.params;
  const routines = dbRoutines.get(user.id) || [];
  const routine = routines.find((r) => r.id === id);
  if (!routine) {
    res.status(404).json({ error: 'Routine not found' });
    return;
  }

  const st = routine.subtasks.find((s) => s.id === subtaskId);
  if (st) {
    st.completed = !st.completed;
  }

  const allCompleted = routine.subtasks.length > 0 && routine.subtasks.every((s) => s.completed);
  routine.completed = allCompleted;

  res.json({ routine, routines });
});

app.patch('/api/routines/:id/complete', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const routineId = req.params.id;
  const routines = dbRoutines.get(user.id) || [];
  const routine = routines.find((r) => r.id === routineId);
  if (!routine) {
    res.status(404).json({ error: 'Routine not found' });
    return;
  }

  routine.completed = !routine.completed;
  routine.subtasks.forEach((s) => (s.completed = routine.completed));

  if (routine.completed) {
    user.points += 75;
  } else {
    user.points = Math.max(0, user.points - 75);
  }

  res.json({ routine, routines, user });
});

app.delete('/api/routines/:id', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const routineId = req.params.id;
  const routines = (dbRoutines.get(user.id) || []).filter((r) => r.id !== routineId);
  dbRoutines.set(user.id, routines);

  res.json({ success: true });
});

// Protein Log Routes
app.get('/api/protein-log', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const entries = dbProtein.get(user.id) || [];
  const totalLogged = entries.reduce((sum, e) => sum + e.proteinGrams, 0);

  res.json({
    entries,
    totalLoggedGrams: totalLogged,
    goalGrams: user.proteinGoal,
    remainingGrams: Math.max(0, user.proteinGoal - totalLogged),
  });
});

app.post('/api/protein-log', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { foodName, proteinGrams, time } = req.body;
  const newEntry: ProteinEntryData = {
    id: `pr_${Math.random().toString(36).substring(2, 9)}`,
    userId: user.id,
    foodName: foodName || 'Protein Item',
    proteinGrams: Number(proteinGrams) || 25,
    time: time || 'Today',
  };

  const entries = dbProtein.get(user.id) || [];
  entries.push(newEntry);
  dbProtein.set(user.id, entries);

  const totalLogged = entries.reduce((sum, e) => sum + e.proteinGrams, 0);
  const data = {
    entries,
    totalLoggedGrams: totalLogged,
    goalGrams: user.proteinGoal,
    remainingGrams: Math.max(0, user.proteinGoal - totalLogged),
  };

  res.json({ entry: newEntry, data, user });
});

app.delete('/api/protein-log/:id', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const entryId = req.params.id;
  const entries = (dbProtein.get(user.id) || []).filter((e) => e.id !== entryId);
  dbProtein.set(user.id, entries);

  const totalLogged = entries.reduce((sum, e) => sum + e.proteinGrams, 0);
  res.json({
    entries,
    totalLoggedGrams: totalLogged,
    goalGrams: user.proteinGoal,
    remainingGrams: Math.max(0, user.proteinGoal - totalLogged),
  });
});

app.put('/api/protein-goal', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { goalGrams } = req.body;
  if (goalGrams && Number(goalGrams) > 0) {
    user.proteinGoal = Number(goalGrams);
  }

  res.json({ goalGrams: user.proteinGoal });
});

// AI Suggestion Route
app.post('/api/ai/suggest-routine', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { goal, timeAvailable } = req.body;
  const routineName = `Optimized ${(goal || 'Focus').trim()} Protocol`;
  const subtasks = [
    { id: 'ai1', text: `Define primary 1-line outcome for ${goal || 'session'}`, duration: '5 mins', completed: false },
    { id: 'ai2', text: 'Eliminate top 3 digital distractions & set timer', duration: '5 mins', completed: false },
    { id: 'ai3', text: 'Execute high-intensity focus block', duration: '15 mins', completed: false },
    { id: 'ai4', text: 'Review key learnings & log output', duration: '5 mins', completed: false },
  ];

  res.json({
    routine: {
      name: routineName,
      icon: '⚡',
      durationMins: 30,
      totalSteps: subtasks.length,
      subtasks,
    },
    reasoning: `Custom protocol generated for operator targeting '${goal || 'Deep Focus'}' within ${timeAvailable || '30 mins'}.`,
  });
});

// Stats Route
app.get('/api/stats', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const tasks = dbTasks.get(user.id) || [];
  const routines = dbRoutines.get(user.id) || [];
  const proteinLogs = dbProtein.get(user.id) || [];

  const completedTasks = tasks.filter((t) => t.completed).length;
  const totalTasks = tasks.length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const completedRoutines = routines.filter((r) => r.completed).length;
  const totalProtein = proteinLogs.reduce((sum, p) => sum + p.proteinGrams, 0);

  res.json({
    dayNumber: user.dayNumber,
    totalDays: user.totalDaysGoal,
    streakDays: user.streakDays,
    points: user.points,
    level: user.currentLevel,
    tasksCompletedToday: completedTasks,
    totalTasks,
    taskCompletionRate,
    routinesCompleted: completedRoutines,
    proteinLogged: totalProtein,
    proteinGoal: user.proteinGoal,
    weeklyMomentum: [
      { day: 'Mon', score: 85 },
      { day: 'Tue', score: 90 },
      { day: 'Wed', score: 78 },
      { day: 'Thu', score: 95 },
      { day: 'Fri', score: 88 },
      { day: 'Sat', score: 92 },
      { day: 'Sun', score: 96 },
    ],
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ Lock-In Protocol App running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
