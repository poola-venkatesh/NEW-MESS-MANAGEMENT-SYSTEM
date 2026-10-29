import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Camera,
  ScanFace,
  Clock,
  History,
  Receipt,
  FileText,
  ShieldCheck,
} from 'lucide-react';

export const AdminSidebar: React.FC = () => {
  const navItems = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/live-scan', label: 'Live Mess Entry', icon: ScanFace, highlight: true },
    { to: '/admin/students', label: 'Student Directory', icon: Users },
    { to: '/admin/register-student', label: 'Register Student', icon: UserPlus },
    { to: '/admin/face-enrollment', label: 'Face Enrollment', icon: Camera },
    { to: '/admin/meals', label: 'Meal Timings & Pricing', icon: Clock },
    { to: '/admin/attendance', label: 'Attendance History', icon: History },
    { to: '/admin/billing', label: 'Billing & Payments', icon: Receipt },
    { to: '/admin/audit', label: 'Audit Logs', icon: ShieldCheck },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3">
            Hostel Operations
          </span>
          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                        : item.highlight
                        ? 'text-emerald-400 hover:bg-slate-800'
                        : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 text-center">
        <span>Mess System v1.0 • Secure Biometrics</span>
      </div>
    </aside>
  );
};
