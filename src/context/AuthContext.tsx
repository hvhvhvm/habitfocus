import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '../types';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

interface AuthContextType extends AuthState {
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  loginDemo: () => Promise<void>;
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
            // Token exists but backend call failed — still mark loading done
            if (mounted) {
              setAuthState({ user: null, token: null, isAuthenticated: false, isLoading: false });
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
          if (mounted) {
            setAuthState({ user: null, token: null, isAuthenticated: false, isLoading: false });
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
    setAuthState((prev) => ({ ...prev, isLoading: true }));

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });

    if (error) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      // Provide a human-readable message for the common "Email not confirmed" case
      if (error.message.toLowerCase().includes('email not confirmed')) {
        throw new Error('Please confirm your email before signing in. Check your inbox for a confirmation link.');
      }
      throw new Error(error.message || 'Sign-in failed. Please check your credentials.');
    }

    if (!data.session?.access_token) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      throw new Error('No session returned from Supabase. Please try again.');
    }

    // onAuthStateChange will fire and set state — but set loading false here too
    setAuthState((prev) => ({ ...prev, isLoading: false }));
  };

  /**
   * Sign up with Supabase Auth — no local fallback.
   * If email confirmation is required, informs the user to check their inbox.
   */
  const register = async (name: string, email: string, pass: string) => {
    setAuthState((prev) => ({ ...prev, isLoading: true }));

    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: { name },
      },
    });

    if (error) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      throw new Error(error.message || 'Registration failed. Please try again.');
    }

    if (data.session?.access_token) {
      // Email confirmation is disabled — session granted immediately
      // onAuthStateChange will handle the rest
      setAuthState((prev) => ({ ...prev, isLoading: false }));
    } else if (data.user && !data.session) {
      // Email confirmation is required — user created but no session yet
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      throw new Error(
        'Account created! Please check your email and click the confirmation link before signing in.'
      );
    } else {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      throw new Error('Registration failed. Please try again.');
    }
  };

  /**
   * Demo login — signs into a pre-configured Supabase demo account.
   * Set VITE_DEMO_EMAIL and VITE_DEMO_PASSWORD env vars pointing to a real Supabase user.
   * Falls back to showing an error if demo credentials are not configured.
   */
  const loginDemo = async () => {
    const demoEmail = import.meta.env.VITE_DEMO_EMAIL as string | undefined;
    const demoPassword = import.meta.env.VITE_DEMO_PASSWORD as string | undefined;

    if (!demoEmail || !demoPassword) {
      throw new Error(
        'Demo account is not configured. Please set VITE_DEMO_EMAIL and VITE_DEMO_PASSWORD env vars, or create a demo user in Supabase.'
      );
    }

    setAuthState((prev) => ({ ...prev, isLoading: true }));

    const { error } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword,
    });

    if (error) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      throw new Error(
        `Demo login failed: ${error.message}. Ensure the demo account exists in your Supabase project.`
      );
    }

    // onAuthStateChange will set the full auth state
    setAuthState((prev) => ({ ...prev, isLoading: false }));
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
        loginDemo,
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
