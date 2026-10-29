import React from 'react';
import { LogOut, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, setStoredToken } from '../services/api';

interface NavbarProps {
  user?: {
    username: string;
    role: string;
    studentProfile?: {
      fullName: string;
      studentId: string;
    } | null;
  } | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setStoredToken(null);
      if (onLogout) onLogout();
      if (user?.role === 'ADMIN') {
        navigate('/admin/login');
      } else {
        navigate('/student/login');
      }
    }
  };

  return (
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 shadow-lg text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand with Messlogo */}
        <div
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => navigate(user?.role === 'ADMIN' ? '/admin' : '/student')}
        >
          <img
            src="/Messlogo.png"
            alt="RGUKT Mess Web App Logo"
            className="w-11 h-11 object-contain rounded-full shadow-md shadow-emerald-500/20 ring-2 ring-amber-400 group-hover:scale-105 transition p-0.5 bg-slate-800"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-white text-base sm:text-lg tracking-tight">
                RGUKT MESS
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                WEB APP
              </span>
            </div>
            <p className="text-[10px] text-amber-300 font-medium tracking-wider uppercase">
              Eat Well • Attend Well • Live Well
            </p>
          </div>
        </div>

        {/* User Info & Actions */}
        {user ? (
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-slate-100">
                {user.studentProfile?.fullName || user.username}
              </span>
              <span className="text-xs text-slate-400 flex items-center justify-end gap-1">
                {user.role === 'ADMIN' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <Shield className="w-2.5 h-2.5 mr-1" /> ADMIN
                  </span>
                ) : (
                  <span className="text-emerald-400 font-mono text-[11px]">
                    ID: {user.studentProfile?.studentId}
                  </span>
                )}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate('/student/login')}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              Student Portal
            </button>
            <button
              onClick={() => navigate('/admin/login')}
              className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md shadow-emerald-600/30 transition cursor-pointer"
            >
              Admin Access
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
