import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '../types';
import { api } from '../lib/api';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType extends AuthState {
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserInContext: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;

    /** Build a minimal User from Supabase session metadata as a fallback
     *  when the FastAPI backend is temporarily unreachable. */
    function userFromSession(session: { user: { id: string; email?: string | null; user_metadata?: Record<string, any> } }): import('../types').User {
      const meta = session.user.user_metadata || {};
      const email = session.user.email || '';
      return {
        id: session.user.id,
        email,
        name: meta.name || meta.full_name || email.split('@')[0] || 'Operator',
        avatar: meta.avatar || '⚡',
        streakDays: 1,
        totalPoints: 0,
        currentLevel: 1,
        lockInMode: false,
        dayNumber: 1,
        totalDaysGoal: 90,
      };
    }

    async function initAuth() {
      try {
        // Get the existing Supabase session (persisted in localStorage by Supabase SDK)
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token && mounted) {
          try {
            const { user } = await api.getCurrentUser();
            if (mounted) {
              setAuthState({
                user,
                token: session.access_token,
                isAuthenticated: true,
                isLoading: false,
              });
            }
          } catch (err) {
            console.error('Failed to load user profile from FastAPI:', err);
            // FastAPI unreachable — fall back to Supabase session metadata
            // so the user is not kicked out after a successful Supabase login.
            if (mounted) {
              setAuthState({
                user: userFromSession(session),
                token: session.access_token,
                isAuthenticated: true,
                isLoading: false,
              });
            }
          }
        } else if (mounted) {
          setAuthState({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      } catch (err) {
        console.error('Supabase getSession error:', err);
        if (mounted) {
          setAuthState({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      }
    }

    initAuth();

    // Listen for Supabase Auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (session?.access_token) {
        try {
          const { user } = await api.getCurrentUser();
          if (mounted) {
            setAuthState({
              user,
              token: session.access_token,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } catch (err) {
          console.error('Error fetching current user on auth state change:', err);
          // FastAPI unreachable — fall back to Supabase session metadata
          // so login succeeds even if backend is temporarily down.
          if (mounted) {
            setAuthState({
              user: userFromSession(session),
              token: session.access_token,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        }
      } else {
        if (mounted) {
          setAuthState({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Sign in with Supabase Auth — no local fallback.
   * Throws a descriptive error if sign-in fails.
   */
  const login = async (email: string, pass: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Supabase is not configured. Please verify that the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables are correctly set in your environment.'
      );
    }

    setAuthState((prev) => ({ ...prev, isLoading: true }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });

      if (error) {
        setAuthState((prev) => ({ ...prev, isLoading: false }));
        const msg = error.message.toLowerCase();
        if (msg.includes('email not confirmed')) {
          throw new Error('Please confirm your email before signing in. Check your inbox for a confirmation link.');
        }
        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials') || msg.includes('incorrect password')) {
          throw new Error('Incorrect password. Please try again.');
        }
        throw new Error(error.message || 'Sign-in failed. Please check your credentials.');
      }

      if (!data.session?.access_token) {
        setAuthState((prev) => ({ ...prev, isLoading: false }));
        throw new Error('No session returned from Supabase. Please try again.');
      }

      setAuthState((prev) => ({ ...prev, isLoading: false }));
    } catch (err: any) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      throw new Error(err.message || 'Network error: Failed to connect to Supabase Auth service.');
    }
  };

  /**
   * Sign up with Supabase Auth — no local fallback.
   * If email confirmation is required, informs the user to check their inbox.
   */
  const register = async (name: string, email: string, pass: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Supabase is not configured. Please verify that the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables are correctly set in your environment.'
      );
    }

    setAuthState((prev) => ({ ...prev, isLoading: true }));

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: { name },
        },
      });

      if (error) {
        setAuthState((prev) => ({ ...prev, isLoading: false }));
        const msg = error.message.toLowerCase();
        if (msg.includes('user already exists') || msg.includes('already registered') || msg.includes('already exists')) {
          throw new Error('Email already registered. Please sign in instead.');
        }
        throw new Error(error.message || 'Registration failed. Please try again.');
      }

      if (data.session?.access_token) {
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      } else if (data.user && !data.session) {
        setAuthState((prev) => ({ ...prev, isLoading: false }));
        throw new Error(
          'Account created! Please check your email and click the confirmation link before signing in.'
        );
      } else {
        setAuthState((prev) => ({ ...prev, isLoading: false }));
        throw new Error('Registration failed. Please try again.');
      }
    } catch (err: any) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      throw new Error(err.message || 'Network error: Failed to connect to Supabase Auth service.');
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Supabase signOut error:', e);
    }
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const updateUserInContext = (user: User) => {
    setAuthState((prev) => ({ ...prev, user }));
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        register,
        logout,
        updateUserInContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
