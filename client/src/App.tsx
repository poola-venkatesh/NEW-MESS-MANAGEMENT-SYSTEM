import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { AdminSidebar } from './components/AdminSidebar';
import { api } from './services/api';

// Admin Pages
import { AdminLogin } from './pages/auth/AdminLogin';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { StudentManagement } from './pages/admin/StudentManagement';
import { RegisterStudent } from './pages/admin/RegisterStudent';
import { FaceEnrollment } from './pages/admin/FaceEnrollment';
import { LiveMessEntry } from './pages/admin/LiveMessEntry';
import { MealManagement } from './pages/admin/MealManagement';
import { AttendanceHistory } from './pages/admin/AttendanceHistory';
import { BillingPayments } from './pages/admin/BillingPayments';
import { AuditLogsView } from './pages/admin/AuditLogsView';

// Student Pages
import { StudentLogin } from './pages/auth/StudentLogin';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { StudentBills } from './pages/student/StudentBills';
import { StudentProfile } from './pages/student/StudentProfile';

import { Shield, ArrowRight, CheckCircle2, ScanFace, Sparkles, Download, Smartphone } from 'lucide-react';

export const InstallAppButton: React.FC<{ className?: string }> = ({ className }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert(
        "📱 To Install RGUKT Mess as a Web App on your device:\n\n" +
        "• Chrome / Edge (Desktop/Android): Click the Install icon (⊕) in the browser address bar or tap ⋮ Menu -> 'Install App'.\n" +
        "• Safari (iPhone / iPad): Tap the Share button (↑) and select 'Add to Home Screen'.\n\n" +
        "Once installed, you can launch it in full-screen standalone mode anytime!"
      );
    }
  };

  if (isInstalled) return null;

  return (
    <button
      onClick={handleInstallClick}
      className={className || "px-5 py-3.5 bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/50 text-emerald-400 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl backdrop-blur-md transition transform hover:-translate-y-0.5 cursor-pointer"}
    >
      <Smartphone className="w-4 h-4 text-emerald-400" />
      <span>Install Web App</span>
    </button>
  );
};

const LandingPage: React.FC = () => {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center px-4 py-12 overflow-hidden">
      {/* Background Image: Messbg clearly visible as requested */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat filter brightness-95 contrast-105"
        style={{ backgroundImage: "url('/Messbg.jpg')" }}
      />
      {/* Frosted overlay ensuring Messbg hostel building is visible while cards remain crystal clear */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/65 via-slate-950/40 to-slate-950/80 backdrop-blur-[0.5px]" />

      {/* Hero Content */}
      <div className="relative z-10 max-w-4xl text-center space-y-6">
        {/* Prominent RGUKT Mess Logo */}
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="relative">
            <img
              src="/Messlogo.png"
              alt="RGUKT Mess Web App Logo"
              className="w-28 h-28 sm:w-36 sm:h-36 object-contain rounded-full shadow-2xl ring-4 ring-amber-400/90 p-1.5 bg-slate-900/60 backdrop-blur-md animate-in zoom-in-95 duration-300"
            />
            <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-[10px] text-white font-extrabold px-2.5 py-0.5 rounded-full shadow-lg border border-emerald-400">
              PWA WEB APP
            </span>
          </div>

          <div className="inline-flex items-center gap-2 bg-slate-900/85 border border-amber-400/50 px-4 py-1.5 rounded-full text-xs font-bold text-amber-300 shadow-xl backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> EAT WELL • ATTEND WELL • LIVE WELL
          </div>
        </div>

        <h1 className="text-3xl sm:text-6xl font-black text-white tracking-tight leading-tight drop-shadow-lg">
          RGUKT Smart Mess Management
        </h1>

        <p className="text-sm sm:text-lg text-slate-100 max-w-2xl mx-auto leading-relaxed drop-shadow font-medium">
          Students pay <strong>ONLY</strong> for the meals they physically attend. Powered by real device camera face verification, zero duplicate charges, and transparent consumption billing.
        </p>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3.5">
          <Link
            to="/student"
            className="w-full sm:w-auto px-7 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/50 hover:shadow-emerald-600/30 transition transform hover:-translate-y-0.5 cursor-pointer"
          >
            Open Student Portal <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            to="/admin"
            className="w-full sm:w-auto px-7 py-4 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl transition transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Shield className="w-4 h-4 text-amber-400" /> Admin Station
          </Link>

          <Link
            to="/admin/live-scan"
            className="w-full sm:w-auto px-7 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-amber-950/40 transition transform hover:-translate-y-0.5 cursor-pointer"
          >
            <ScanFace className="w-4 h-4" /> Live Camera Check-In
          </Link>

          <InstallAppButton />
        </div>

        {/* Feature Grid */}
        <div className="pt-8 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-left">
          <div className="p-3.5 bg-slate-900/85 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1.5" />
            <h4 className="font-bold text-xs text-white">Live Camera Verification</h4>
            <p className="text-[11px] text-slate-300 mt-0.5">Real-time facial attendance</p>
          </div>
          <div className="p-3.5 bg-slate-900/85 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-amber-400 mb-1.5" />
            <h4 className="font-bold text-xs text-white">Zero Flat Mess Charges</h4>
            <p className="text-[11px] text-slate-300 mt-0.5">Pay only per attended meal</p>
          </div>
          <div className="p-3.5 bg-slate-900/85 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1.5" />
            <h4 className="font-bold text-xs text-white">Encrypted Biometrics</h4>
            <p className="text-[11px] text-slate-300 mt-0.5">AES-256-GCM vector protection</p>
          </div>
          <div className="p-3.5 bg-slate-900/85 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-amber-400 mb-1.5" />
            <h4 className="font-bold text-xs text-white">Itemized PDF Statements</h4>
            <p className="text-[11px] text-slate-300 mt-0.5">One-click financial downloads</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Student Sub-Navigation Header
const StudentSubNav: React.FC = () => {
  const location = useLocation();

  const links = [
    { to: '/student', label: 'Dashboard', end: true },
    { to: '/student/bills', label: 'My Bills & Statements' },
    { to: '/student/profile', label: 'My Profile & Preferences' },
  ];

  return (
    <div className="bg-slate-900 border-b border-slate-800 sticky top-16 z-20 shadow-md">
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-2 sm:gap-4 overflow-x-auto">
        {links.map((link) => {
          const isActive = link.end
            ? location.pathname === link.to
            : location.pathname.startsWith(link.to);

          return (
            <Link
              key={link.to}
              to={link.to}
              className={`py-3.5 px-3.5 text-xs font-bold whitespace-nowrap border-b-2 transition ${
                isActive
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  const [user, setUser] = useState<any | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    try {
      const res: any = await api.get('/auth/me');
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setAuthChecked(true);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center space-y-3">
          <img src="/Messlogo.png" alt="Loading RGUKT Mess" className="w-16 h-16 rounded-full animate-pulse" />
          <span className="text-xs text-slate-400 font-semibold tracking-wide">
            Loading RGUKT Mess Web App...
          </span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Navbar user={user} onLogout={() => setUser(null)} />

        <Routes>
          {/* Public Landing with Messbg and Messlogo */}
          <Route path="/" element={<LandingPage />} />

          {/* Authentication Routes */}
          <Route
            path="/admin/login"
            element={
              user?.role === 'ADMIN' ? (
                <Navigate to="/admin" replace />
              ) : (
                <AdminLogin onLoginSuccess={(u) => setUser(u)} />
              )
            }
          />
          <Route
            path="/student/login"
            element={
              user?.role === 'STUDENT' ? (
                <Navigate to="/student" replace />
              ) : (
                <StudentLogin onLoginSuccess={(u) => setUser(u)} />
              )
            }
          />

          {/* Admin Portal Routes: /admin/* */}
          <Route
            path="/admin/*"
            element={
              !user ? (
                <Navigate to="/admin/login" replace />
              ) : user.role !== 'ADMIN' ? (
                <div className="p-8 max-w-xl mx-auto text-center space-y-3">
                  <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-xs">
                    <strong>Access Forbidden:</strong> You do not possess administrator credentials to access /admin.
                  </div>
                  <Link to="/student" className="text-emerald-400 text-xs font-bold hover:underline">
                    Return to Student Portal
                  </Link>
                </div>
              ) : (
                <div className="flex-1 flex flex-col md:flex-row bg-slate-900">
                  <AdminSidebar />
                  <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-slate-950">
                    <Routes>
                      <Route path="/" element={<AdminDashboard />} />
                      <Route path="/live-scan" element={<LiveMessEntry />} />
                      <Route path="/students" element={<StudentManagement />} />
                      <Route path="/register-student" element={<RegisterStudent />} />
                      <Route path="/face-enrollment" element={<FaceEnrollment />} />
                      <Route path="/meals" element={<MealManagement />} />
                      <Route path="/attendance" element={<AttendanceHistory />} />
                      <Route path="/billing" element={<BillingPayments />} />
                      <Route path="/audit" element={<AuditLogsView />} />
                      <Route path="*" element={<Navigate to="/admin" replace />} />
                    </Routes>
                  </main>
                </div>
              )
            }
          />

          {/* Student Portal Routes: /student/* */}
          <Route
            path="/student/*"
            element={
              !user ? (
                <Navigate to="/student/login" replace />
              ) : user.role !== 'STUDENT' ? (
                <div className="p-8 max-w-xl mx-auto text-center space-y-3">
                  <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-4 rounded-xl text-xs">
                    <strong>Admin Session Active:</strong> You are currently signed in with administrator privileges.
                  </div>
                  <Link to="/admin" className="text-emerald-400 text-xs font-bold hover:underline">
                    Return to Admin Dashboard
                  </Link>
                </div>
              ) : (
                <div className="flex-1 flex flex-col bg-slate-950">
                  <StudentSubNav />
                  <main className="flex-1 p-4 sm:p-6 lg:p-8">
                    <Routes>
                      <Route path="/" element={<StudentDashboard />} />
                      <Route path="/bills" element={<StudentBills user={user} />} />
                      <Route
                        path="/profile"
                        element={<StudentProfile user={user} onProfileUpdate={(u) => setUser(u)} />}
                      />
                      <Route path="*" element={<Navigate to="/student" replace />} />
                    </Routes>
                  </main>
                </div>
              )
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};
