import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '../types';
import { api, getStoredToken, setStoredToken } from '../lib/api';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
    token: getStoredToken(),
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    async function initAuth() {
      // 1. Supabase Auth listener & initial session check
      if (isSupabaseConfigured()) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            setStoredToken(session.access_token);
            try {
              const { user } = await api.getCurrentUser();
              setAuthState({
                user,
                token: session.access_token,
                isAuthenticated: true,
                isLoading: false,
              });
              return;
            } catch (err) {
              console.error('Failed to load user from FastAPI backend:', err);
            }
          }
        } catch (err) {
          console.warn('Supabase auth check error:', err);
        }

        // Listen for Supabase Auth state changes
        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session?.access_token) {
            setStoredToken(session.access_token);
            try {
              const { user } = await api.getCurrentUser();
              setAuthState({
                user,
                token: session.access_token,
                isAuthenticated: true,
                isLoading: false,
              });
            } catch (e) {
              console.error('Error fetching current user on auth state change:', e);
            }
          } else {
            setStoredToken(null);
            setAuthState({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        });

        // If no session found yet, finish loading state
        setAuthState((prev) => ({ ...prev, isLoading: false }));
        return () => {
          authListener.subscription.unsubscribe();
        };
      }

      // 2. Fallback if token exists in localStorage
      const token = getStoredToken();
      if (token) {
        try {
          const { user } = await api.getCurrentUser();
          setAuthState({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        } catch (e) {
          console.warn('Stored token invalid');
          setStoredToken(null);
        }
      }

      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }

    initAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    setAuthState((prev) => ({ ...prev, isLoading: true }));
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });

        if (error) {
          // If Supabase credentials are not valid or login failed on Supabase, attempt local auth fallback
          console.warn('Supabase sign-in error, trying local auth fallback:', error.message);
          try {
            const { user, token } = await api.login(email, pass);
            setStoredToken(token);
            setAuthState({
              user,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          } catch (localErr: any) {
            setAuthState((prev) => ({ ...prev, isLoading: false }));
            throw new Error(error.message || localErr.message || 'Login failed');
          }
        }

        if (data.session?.access_token) {
          setStoredToken(data.session.access_token);
          const { user } = await api.getCurrentUser();
          setAuthState({
            user,
            token: data.session.access_token,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      }

      // Local / FastAPI auth fallback
      const { user, token } = await api.login(email, pass);
      setStoredToken(token);
      setAuthState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      throw err;
    }
  };

  const register = async (name: string, email: string, pass: string) => {
    setAuthState((prev) => ({ ...prev, isLoading: true }));
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: {
            data: { name },
          },
        });

        if (error) {
          console.warn('Supabase sign-up warning:', error.message);
          // Try local registration fallback if Supabase registration yields an issue
          try {
            const { user, token } = await api.register(name, email, pass);
            setStoredToken(token);
            setAuthState({
              user,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          } catch (localErr: any) {
            setAuthState((prev) => ({ ...prev, isLoading: false }));
            throw new Error(error.message || localErr.message || 'Registration failed');
          }
        }

        if (data.session?.access_token) {
          setStoredToken(data.session.access_token);
          const { user } = await api.getCurrentUser();
          setAuthState({
            user,
            token: data.session.access_token,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        } else if (data.user) {
          // If Supabase created user but requires email confirmation, fallback to local login token for instant access
          const { user, token } = await api.register(name, email, pass);
          setStoredToken(token);
          setAuthState({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      }

      // Local / Demo API register fallback
      const { user, token } = await api.register(name, email, pass);
      setStoredToken(token);
      setAuthState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      throw err;
    }
  };

  const loginDemo = async () => {
    setAuthState((prev) => ({ ...prev, isLoading: true }));
    try {
      const { user, token } = await api.loginDemo();
      setStoredToken(token);
      setAuthState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      console.warn('Backend demo login endpoint error, using local fallback:', err);
      const demoToken = 'demo_token_lockin_operator_90';
      setStoredToken(demoToken);
      try {
        const { user } = await api.getCurrentUser();
        setAuthState({
          user,
          token: demoToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (e) {
        setAuthState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error('Supabase signout error:', e);
      }
    }
    setStoredToken(null);
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
