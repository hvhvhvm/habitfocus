import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { X, Lock, KeyRound, UserPlus, Zap } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { login, register } = useAuth();
  const { isAuthModalOpen, setIsAuthModalOpen } = useApp();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isAuthModalOpen) return null;

  const toggleMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (mode === 'register' && password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name || email.split('@')[0], email, password);
      }
      setIsAuthModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#16201B] border border-[#26332C] rounded-3xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#26332C] mb-5">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#3ECF8E]" />
            <h3 className="font-space font-bold text-xl text-[#F4F6F5]">
              {mode === 'login' ? 'Account Login' : 'Create Operator Account'}
            </h3>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="p-1.5 rounded-lg text-[#8A9891] hover:text-[#F4F6F5] hover:bg-[#1D2922]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <div>
              <label className="font-mono-code text-[11px] text-[#8A9891] uppercase tracking-wider block mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Vance"
                required
                className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl px-4 py-2.5 text-sm text-[#F4F6F5] focus:outline-none focus:border-[#3ECF8E]"
              />
            </div>
          )}

          <div>
            <label className="font-mono-code text-[11px] text-[#8A9891] uppercase tracking-wider block mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@lockin.app"
              required
              className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl px-4 py-2.5 text-sm text-[#F4F6F5] focus:outline-none focus:border-[#3ECF8E]"
            />
          </div>

          <div>
            <label className="font-mono-code text-[11px] text-[#8A9891] uppercase tracking-wider block mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl px-4 py-2.5 text-sm text-[#F4F6F5] focus:outline-none focus:border-[#3ECF8E]"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#3ECF8E] hover:bg-[#32B87C] text-[#0B1510] font-space font-bold text-sm py-3 rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50 mt-1"
          >
            {isSubmitting ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>



        <div className="text-center mt-4 pt-3 border-t border-[#26332C]/60 text-xs text-[#8A9891]">
          {mode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => toggleMode('register')}
                className="text-[#3ECF8E] font-semibold hover:underline cursor-pointer"
              >
                Sign Up
              </button>
            </span>
          ) : (
            <span>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => toggleMode('login')}
                className="text-[#3ECF8E] font-semibold hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
