import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../../services/api';

export const AttendanceHistory: React.FC = () => {
  const [attendances, setAttendances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState('');
  const [mealFilter, setMealFilter] = useState('');

  // Void modal
  const [voidModalAttendance, setVoidModalAttendance] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);

  useEffect(() => {
    loadAttendance();
  }, [dateFilter, mealFilter]);

  const loadAttendance = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFilter) params.append('date', dateFilter);
      if (mealFilter) params.append('mealName', mealFilter);

      const res: any = await api.get(`/attendance/history?${params.toString()}`);
      setAttendances(res.attendances || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load attendance history');
    } finally {
      setLoading(false);
    }
  };

  const handleVoidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidModalAttendance || !voidReason.trim()) return;

    setVoidLoading(true);
    try {
      await api.post(`/attendance/${voidModalAttendance.id}/void`, {
        reason: voidReason,
      });
      alert('Attendance and associated charge voided with audit trail.');
      setVoidModalAttendance(null);
      setVoidReason('');
      await loadAttendance();
    } catch (err: any) {
      alert(`Error voiding record: ${err.message}`);
    } finally {
      setVoidLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
            <History className="w-4 h-4" /> Check-in Auditing
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1">
            Mess Attendance History & Audited Corrections
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time biometric and manual meal entries with tamper-evident voiding workflows.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Filter Date:</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Meal Category:</label>
            <select
              value={mealFilter}
              onChange={(e) => setMealFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Meals</option>
              <option value="BREAKFAST">Breakfast</option>
              <option value="LUNCH">Lunch</option>
              <option value="SNACKS">Snacks</option>
              <option value="DINNER">Dinner</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => {
            setDateFilter('');
            setMealFilter('');
          }}
          className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
        >
          Reset Filters
        </button>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Student</th>
                <th className="px-4 py-3.5">Meal Session</th>
                <th className="px-4 py-3.5">Date & Time</th>
                <th className="px-4 py-3.5">Method</th>
                <th className="px-4 py-3.5">Applied Charge</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Loading attendance records...
                  </td>
                </tr>
              ) : attendances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No attendance records found.
                  </td>
                </tr>
              ) : (
                attendances.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-slate-900 block">{item.student.fullName}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {item.student.studentId}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-slate-800">{item.mealSession.name}</span>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="text-slate-800 font-medium block">{item.date}</span>
                      <span className="text-slate-400 text-[11px] font-mono">
                        {new Date(item.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      {item.verificationMethod === 'FACE_BIOMETRIC' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium text-[11px]">
                          <CheckCircle className="w-3 h-3" /> Face Match ({item.confidenceScore ? `${Math.round(item.confidenceScore * 100)}%` : 'OK'})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium text-[11px]">
                          Audited Manual
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                      ₹{Number(item.charge?.amount || item.mealSession.price).toFixed(2)}
                    </td>

                    <td className="px-4 py-3.5">
                      {item.status === 'VALID' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          VALID
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          VOIDED
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      {item.status === 'VALID' && (
                        <button
                          onClick={() => setVoidModalAttendance(item)}
                          className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 border border-rose-200 hover:bg-rose-50 rounded-lg transition"
                          title="Void Erroneous Check-In"
                        >
                          Void & Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Void Reason Modal */}
      {voidModalAttendance && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 text-rose-700">
                <ShieldAlert className="w-5 h-5 text-rose-600" /> Void Attendance Record
              </h3>
              <button
                onClick={() => setVoidModalAttendance(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              You are about to void the attendance and linked charge (₹
              {Number(voidModalAttendance.charge?.amount || voidModalAttendance.mealSession.price).toFixed(2)}) for{' '}
              <strong>{voidModalAttendance.student.fullName}</strong>.
            </p>

            <form onSubmit={handleVoidSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Mandatory Audit Reason / Correction Details *
                </label>
                <textarea
                  required
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Student mistakenly checked in twice using alternate terminal; confirmed with mess register."
                  className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidModalAttendance(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={voidLoading}
                  className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-xl hover:bg-rose-500 disabled:opacity-50"
                >
                  {voidLoading ? 'Voiding...' : 'Confirm Void & Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
