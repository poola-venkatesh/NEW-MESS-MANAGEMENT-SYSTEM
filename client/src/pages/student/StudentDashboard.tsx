import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Utensils,
  CheckCircle,
  FileDown,
  Clock,
  Receipt,
  User,
  AlertCircle,
  Calendar,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api';

export const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);

  useEffect(() => {
    fetchStudentStats();
  }, []);

  const fetchStudentStats = async () => {
    try {
      setLoading(true);
      const res: any = await api.get('/billing/dashboard-stats');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load student dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadMonthlyPdf = async () => {
    if (!data?.student) return;
    try {
      setPdfDownloading(true);
      await api.downloadPdf(
        `/reports/statement-pdf/${data.student.id}?filter=month`,
        `mess-statement-${data.student.studentId}-month.pdf`
      );
    } catch (err: any) {
      alert(`PDF Download Error: ${err.message}`);
    } finally {
      setPdfDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-medium mt-3">Loading Your Mess Dashboard...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error || 'Unable to load dashboard.'}</span>
        </div>
      </div>
    );
  }

  const { student, todayAttendance, chargesSummary, paymentsRecorded, outstandingBalance, currentMealSession } = data;

  const attendedMealNames = (todayAttendance || []).map((a: any) => a.meal);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Welcome Card */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-emerald-700/50">
        <div className="flex items-center gap-4">
          <img
            src="/Messlogo.png"
            alt="RGUKT Mess Web App"
            className="w-16 h-16 rounded-full ring-2 ring-amber-400 p-0.5 bg-slate-900/50 shadow-lg shrink-0"
          />
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">
              Student Consumption Web App
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Hello, {student.fullName}!
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200">
              <span className="bg-white/10 px-3 py-1 rounded-full font-mono">
                College ID: {student.studentId}
              </span>
              <span className="bg-white/10 px-3 py-1 rounded-full">
                Hostel: {student.hostelBlock || 'Block A'} • Room {student.roomNo || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleDownloadMonthlyPdf}
            disabled={pdfDownloading}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-emerald-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-50"
          >
            <FileDown className="w-4 h-4 text-emerald-700" />
            {pdfDownloading ? 'Generating...' : 'Download Statement (PDF)'}
          </button>
        </div>
      </div>

      {/* Consumption Policy Notice */}
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 text-xs flex items-start gap-3">
        <Utensils className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <strong className="block text-emerald-950 text-sm">Pay-Per-Meal Model Active</strong>
          You are charged strictly for individual meals you verify and check into. Skipped meals incur zero charge. No fixed monthly mess fees are applied.
        </div>
      </div>

      {/* Today's Meals Attendance Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">Today's Meals Status</h3>
            <p className="text-xs text-slate-500">Live check-in verification records for today</p>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
            {attendedMealNames.length} of 4 Consumed
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'].map((meal) => {
            const attended = attendedMealNames.includes(meal);
            const entry = (todayAttendance || []).find((a: any) => a.meal === meal);

            return (
              <div
                key={meal}
                className={`p-4 rounded-xl border flex flex-col justify-between transition ${
                  attended
                    ? 'bg-emerald-50/80 border-emerald-300'
                    : 'bg-slate-50/50 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">{meal}</span>
                    {attended ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 block mt-1 font-medium">
                    {attended ? 'Checked In' : 'Not Attended'}
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[10px]">Charge:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {attended ? `₹${Number(entry?.price || 0).toFixed(2)}` : '₹0.00'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Charges Period Breakdown */}
      <div>
        <h3 className="font-extrabold text-slate-900 text-sm mb-3 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-emerald-600" /> Consumption Charges Summary
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Today's Charges
            </span>
            <div className="text-xl font-black text-slate-900 mt-1.5 font-mono">
              ₹{Number(chargesSummary.today || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-400">Single day</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Weekly Charges
            </span>
            <div className="text-xl font-black text-slate-900 mt-1.5 font-mono">
              ₹{Number(chargesSummary.week || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-400">Past 7 days</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Monthly Charges
            </span>
            <div className="text-xl font-black text-slate-900 mt-1.5 font-mono">
              ₹{Number(chargesSummary.month || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-400">Current month</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Semester Charges
            </span>
            <div className="text-xl font-black text-slate-900 mt-1.5 font-mono">
              ₹{Number(chargesSummary.semester || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-400">Academic semester</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Yearly Charges
            </span>
            <div className="text-xl font-black text-slate-900 mt-1.5 font-mono">
              ₹{Number(chargesSummary.year || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-400">Academic year</span>
          </div>
        </div>
      </div>

      {/* Financial Account Balance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Payments Made
            </span>
            <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">
              ₹{Number(paymentsRecorded || 0).toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Recorded official payments & advances</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Current Outstanding Balance
            </span>
            <div
              className={`text-2xl font-black mt-1 font-mono ${
                outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              ₹{Number(outstandingBalance || 0).toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Net balance due (Charges - Payments)
            </p>
          </div>
          <button
            onClick={() => navigate('/student/bills')}
            className="px-4 py-2 border border-slate-300 text-slate-800 hover:bg-slate-50 text-xs font-bold rounded-xl transition"
          >
            View Full Bill
          </button>
        </div>
      </div>
    </div>
  );
};
