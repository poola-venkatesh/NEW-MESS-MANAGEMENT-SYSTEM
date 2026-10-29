import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, AlertCircle, ArrowRight, Info } from 'lucide-react';
import { api, ApiError } from '../../services/api';

export const StudentLogin: React.FC<{ onLoginSuccess: (user: any) => void }> = ({
  onLoginSuccess,
}) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res: any = await api.post('/auth/login', { username, password });
      if (res.user.role !== 'STUDENT') {
        throw new Error('This portal is for Students. For admin access, use the Admin Portal.');
      }
      onLoginSuccess(res.user);
      navigate('/student');
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err.message || 'Login failed. Please check your username and password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background Image: Messbg clearly visible */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat filter brightness-90 contrast-105"
        style={{ backgroundImage: "url('/Messbg.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-900/50 to-slate-950/80 backdrop-blur-[1px]" />

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md text-center">
        <img
          src="/Messlogo.png"
          alt="RGUKT Mess Web App Logo"
          className="mx-auto w-24 h-24 rounded-full shadow-2xl ring-4 ring-amber-400 p-1 bg-slate-900/70 mb-3"
        />
        <h2 className="text-center text-2xl font-black text-white tracking-tight">
          RGUKT Student Mess Portal
        </h2>
        <p className="mt-1 text-center text-xs text-amber-300 font-medium tracking-wider uppercase">
          Smart Mess Web App • Eat Well • Attend Well • Live Well
        </p>
      </div>

      <div className="relative z-10 mt-6 sm:mx-auto sm:w-full sm:max-w-md w-full">
        <div className="bg-slate-900/90 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-3xl sm:px-10 border border-slate-700/80">
          {error && (
            <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mb-5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Pay-Per-Meal Policy:</strong> You are charged ONLY for meals you verify and check into. Skipped meals cost ₹0.
            </span>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Student Username / ID
              </label>
              <div className="mt-1 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. CS2026-002 or username"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-950/60 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Password
              </label>
              <div className="mt-1 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-950/60 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Sign In to Student Portal'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Hostel Admin?{' '}
              <Link to="/admin/login" className="text-emerald-400 hover:text-emerald-300 font-bold">
                Admin Station
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-4 text-center text-[11px] text-slate-400">
          Rajiv Gandhi University of Knowledge Technologies • Smart Mess System
        </div>
      </div>
    </div>
  );
};
