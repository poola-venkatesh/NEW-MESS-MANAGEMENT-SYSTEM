import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  ScanFace,
  Receipt,
  DollarSign,
  Clock,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { api } from '../../services/api';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res: any = await api.get('/billing/dashboard-stats');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-2">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading Dashboard Metrics...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error || 'Unable to load statistics.'}</span>
        </div>
      </div>
    );
  }

  const { metrics, currentMealSession, recentActivity } = data;

  const chartData = [
    { name: 'Breakfast', count: metrics.mealWiseAttendance.BREAKFAST || 0, color: '#f59e0b' },
    { name: 'Lunch', count: metrics.mealWiseAttendance.LUNCH || 0, color: '#10b981' },
    { name: 'Snacks', count: metrics.mealWiseAttendance.SNACKS || 0, color: '#8b5cf6' },
    { name: 'Dinner', count: metrics.mealWiseAttendance.DINNER || 0, color: '#3b82f6' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Shortcuts */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white p-6 rounded-2xl shadow-lg border border-slate-800">
        <div className="flex items-center gap-4">
          <img
            src="/Messlogo.png"
            alt="RGUKT Mess Web App"
            className="w-14 h-14 rounded-full ring-2 ring-amber-400 p-0.5 bg-slate-900/60 shadow-lg shrink-0"
          />
          <div>
            <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold">
              Live Hostel Control Room
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight mt-0.5">
              Smart Mess Management Dashboard
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Verified consumption-based billing & real-time biometric attendance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate('/admin/live-scan')}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <ScanFace className="w-4 h-4" /> Open Live Check-In
          </button>
          <button
            onClick={() => navigate('/admin/register-student')}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl flex items-center gap-2 transition cursor-pointer"
          >
            + Register Student
          </button>
        </div>
      </div>

      {/* Current Active Meal Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Current Meal Session Status
              </span>
              {currentMealSession ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  ACTIVE NOW
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                  NORMAL MEAL WINDOW CLOSED
                </span>
              )}
            </div>
            {currentMealSession ? (
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                {currentMealSession.name} ({currentMealSession.startTime} – {currentMealSession.endTime})
                <span className="text-emerald-600 ml-2 font-mono">₹{Number(currentMealSession.price).toFixed(2)} / meal</span>
              </h3>
            ) : (
              <p className="text-xs text-slate-500 mt-0.5">
                No meal session is scheduled right now. Next session will open automatically per schedule.
              </p>
            )}
          </div>
        </div>

        {currentMealSession && (
          <button
            onClick={() => navigate('/admin/live-scan')}
            className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-500 transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            Check In Students <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Enrolled Students
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">{metrics.totalStudents}</span>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
              <span className="text-emerald-600 font-semibold">{metrics.activeStudents} active</span>
              <span>•</span>
              <span className="text-indigo-600 font-semibold">{metrics.enrolledFaces} face enrolled</span>
            </div>
          </div>
        </div>

        {/* Today's Meals Attended */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Today's Attendance
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">
              {metrics.todayTotalAttendance}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">Verified check-ins today</p>
          </div>
        </div>

        {/* Today's Charges */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Today's Charges
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">
              ₹{metrics.todayCharges.toFixed(2)}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">Exact meal consumption revenue</p>
          </div>
        </div>

        {/* Outstanding Balances */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Hostel Outstanding
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-600">
              ₹{metrics.totalOutstandingBalances.toFixed(2)}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">
              Payments: ₹{metrics.totalPaymentsReceived.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Charts & Live Feed Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Breakdown Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Today's Meal-Wise Attendance</h3>
              <p className="text-xs text-slate-500">Live head-count per scheduled meal category</p>
            </div>
            <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-lg">
              {metrics.todayTotalAttendance} Total
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [`${val} students`, 'Attendance']}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Attendance Activity Feed */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 text-sm">Recent Scans</h3>
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Live Feed
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 max-h-64 pr-1">
            {recentActivity && recentActivity.length > 0 ? (
              recentActivity.map((item: any) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800">{item.student.fullName}</span>
                    <span className="text-[11px] text-slate-500 block">
                      {item.student.studentId} • {item.mealSession.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-700">
                      ₹{Number(item.mealSession.price).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {new Date(item.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-xs text-slate-400">
                No check-ins recorded yet today.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
