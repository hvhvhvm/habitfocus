-- =====================================================================
-- 90-DAY LOCK-IN PROTOCOL: SUPABASE DATABASE SCHEMA & MIGRATION SCRIPT
-- =====================================================================
-- Run this script directly in your Supabase SQL Editor (https://supabase.com/dashboard)
-- to automatically create all required tables, constraints, foreign keys, and RLS policies.

-- 1. PROFILES TABLE (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT DEFAULT 'Lock-In Operator',
  avatar TEXT DEFAULT '⚡',
  day_number INT DEFAULT 1,
  streak_days INT DEFAULT 1,
  total_days_goal INT DEFAULT 90,
  current_level INT DEFAULT 4,
  points INT DEFAULT 1250,
  protein_goal INT DEFAULT 160,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Trigger to automatically create profile on Supabase auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. PILLARS TABLE
CREATE TABLE IF NOT EXISTS public.pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🔥',
  color TEXT DEFAULT '#3ECF8E',
  daily_goal TEXT DEFAULT '1 Task/day',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pillars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own pillars" ON public.pillars;
CREATE POLICY "Users can manage own pillars" 
  ON public.pillars FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);


-- 3. TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pillar_id UUID REFERENCES public.pillars(id) ON DELETE SET NULL,
  time_block TEXT NOT NULL CHECK (time_block IN ('morning', 'afternoon', 'evening', 'night')),
  name TEXT NOT NULL,
  points INT DEFAULT 50,
  completed BOOLEAN DEFAULT FALSE,
  repeat_frequency TEXT DEFAULT 'daily',
  custom_days TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;
CREATE POLICY "Users can manage own tasks" 
  ON public.tasks FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);


-- 4. TASK LOGS TABLE (Daily Completion History)
CREATE TABLE IF NOT EXISTS public.task_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  points_awarded INT DEFAULT 50,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_task_completion_per_date UNIQUE (task_id, completed_date)
);

ALTER TABLE public.task_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own task logs" ON public.task_logs;
CREATE POLICY "Users can manage own task logs" 
  ON public.task_logs FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);


-- 5. ROUTINES TABLE
CREATE TABLE IF NOT EXISTS public.routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🌅',
  duration_mins INT DEFAULT 20,
  total_steps INT DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own routines" ON public.routines;
CREATE POLICY "Users can manage own routines" 
  ON public.routines FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);


-- 6. ROUTINE STEPS TABLE
CREATE TABLE IF NOT EXISTS public.routine_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  duration TEXT DEFAULT '5 mins',
  completed BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.routine_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage steps for their routines" ON public.routine_steps;
CREATE POLICY "Users can manage steps for their routines" 
  ON public.routine_steps FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.routines 
      WHERE routines.id = routine_steps.routine_id 
      AND routines.user_id = auth.uid()
    )
  );


-- 7. ROUTINE LOGS TABLE (Daily Completion History)
CREATE TABLE IF NOT EXISTS public.routine_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  points_awarded INT DEFAULT 75,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_routine_completion_per_date UNIQUE (routine_id, completed_date)
);

ALTER TABLE public.routine_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own routine logs" ON public.routine_logs;
CREATE POLICY "Users can manage own routine logs" 
  ON public.routine_logs FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);


-- 8. PROTEIN LOGS TABLE
CREATE TABLE IF NOT EXISTS public.protein_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  protein_grams INT NOT NULL,
  time_logged TEXT DEFAULT 'Today',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.protein_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own protein logs" ON public.protein_logs;
CREATE POLICY "Users can manage own protein logs" 
  ON public.protein_logs FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- SCHEMA SETUP COMPLETED SUCCESSFULLY
-- =====================================================================
