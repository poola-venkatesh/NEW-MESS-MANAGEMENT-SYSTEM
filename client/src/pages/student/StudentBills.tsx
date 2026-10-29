import React, { useState, useEffect } from 'react';
import {
  Receipt,
  FileDown,
  Filter,
  Calendar,
  CreditCard,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../services/api';

export const StudentBills: React.FC<{ user: any }> = ({ user }) => {
  const [statement, setStatement] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [pdfDownloading, setPdfDownloading] = useState(false);

  const studentId = user?.studentProfile?.id;

  useEffect(() => {
    if (studentId) {
      loadStatement();
    }
  }, [studentId, filter, customStart, customEnd]);

  const loadStatement = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ filter });
      if (filter === 'custom') {
        if (!customStart || !customEnd) return;
        params.append('startDate', customStart);
        params.append('endDate', customEnd);
      }

      const res: any = await api.get(
        `/billing/statement/${studentId}?${params.toString()}`
      );
      setStatement(res.statement);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!studentId || !statement) return;
    try {
      setPdfDownloading(true);
      const params = new URLSearchParams({ filter });
      if (filter === 'custom') {
        params.append('startDate', customStart);
        params.append('endDate', customEnd);
      }

      await api.downloadPdf(
        `/reports/statement-pdf/${studentId}?${params.toString()}`,
        `mess-statement-${statement.student.studentId}-${filter}.pdf`
      );
    } catch (err: any) {
      alert(`PDF Download Error: ${err.message}`);
    } finally {
      setPdfDownloading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
            <Receipt className="w-4 h-4" /> Consumption Statement
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1">
            My Itemized Mess Bills & Statement
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Official breakdown of meals attended, snapshot prices, recorded payments, and net balance.
          </p>
        </div>

        {statement && (
          <button
            onClick={handleDownloadPdf}
            disabled={pdfDownloading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            {pdfDownloading ? 'Generating PDF...' : 'Download Official PDF Statement'}
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Filter Period:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-semibold"
            >
              <option value="today">Today (Single Day)</option>
              <option value="week">Past 7 Days</option>
              <option value="month">Current Month</option>
              <option value="semester">Academic Semester</option>
              <option value="year">Academic Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {filter === 'custom' && (
            <div className="flex items-center gap-2">
              <div>
                <label className="block text-[10px] text-slate-500">From:</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500">To:</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 text-xs text-slate-900"
                />
              </div>
            </div>
          )}
        </div>

        {statement && (
          <span className="text-xs text-slate-400 font-medium">
            Showing records for: <strong>{statement.period.startDate}</strong> to{' '}
            <strong>{statement.period.endDate}</strong>
          </span>
        )}
      </div>

      {/* Statement Summary Cards */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
          Loading your consumption records...
        </div>
      ) : statement ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Meals Consumed
              </span>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {statement.summary.totalMealsAttended}
              </div>
              <span className="text-[11px] text-slate-500">Attended meal count</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Total Meal Charges
              </span>
              <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                ₹{statement.summary.totalCharges.toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-500">Exact consumption charges</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Payments & Credits
              </span>
              <div className="text-2xl font-black text-emerald-600 mt-2 font-mono">
                ₹{(statement.summary.totalPayments + statement.summary.totalAdjustments).toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-500">
                Paid: ₹{statement.summary.totalPayments.toFixed(2)}
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Net Outstanding
              </span>
              <div
                className={`text-2xl font-black mt-2 font-mono ${
                  statement.summary.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                ₹{statement.summary.outstandingBalance.toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-500">Balance payable</span>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Itemized Meal Check-Ins</h3>
              <span className="text-xs text-slate-400">
                {statement.itemizedCharges.length} Check-ins
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="px-5 py-3.5">#</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5">Meal Session</th>
                    <th className="px-4 py-3.5">Check-In Method</th>
                    <th className="px-5 py-3.5 text-right">Applicable Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statement.itemizedCharges.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                        No meals attended in this period.
                      </td>
                    </tr>
                  ) : (
                    statement.itemizedCharges.map((item: any, idx: number) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-5 py-3 text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{item.date}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{item.mealName}</td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md font-medium">
                            {item.verificationMethod || 'FACE_BIOMETRIC'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
                          ₹{Number(item.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
