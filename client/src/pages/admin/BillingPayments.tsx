import React, { useState, useEffect } from 'react';
import {
  Receipt,
  DollarSign,
  PlusCircle,
  FileDown,
  Filter,
  CheckCircle,
  AlertCircle,
  Calendar,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api';

export const BillingPayments: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [statement, setStatement] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [pdfDownloading, setPdfDownloading] = useState(false);

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjType, setAdjType] = useState('CREDIT_REFUND');
  const [adjReason, setAdjReason] = useState('');
  const [adjSubmitting, setAdjSubmitting] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      loadStatement();
    }
  }, [selectedStudentId, filter, customStart, customEnd]);

  const loadStudents = async () => {
    try {
      const res: any = await api.get('/admin/students');
      setStudents(res.students || []);
      if (res.students && res.students.length > 0 && !selectedStudentId) {
        setSelectedStudentId(res.students[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadStatement = async () => {
    if (!selectedStudentId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ filter });
      if (filter === 'custom') {
        if (!customStart || !customEnd) return;
        params.append('startDate', customStart);
        params.append('endDate', customEnd);
      }

      const res: any = await api.get(
        `/billing/statement/${selectedStudentId}?${params.toString()}`
      );
      setStatement(res.statement);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedStudentId || !statement) return;
    try {
      setPdfDownloading(true);
      const params = new URLSearchParams({ filter });
      if (filter === 'custom') {
        params.append('startDate', customStart);
        params.append('endDate', customEnd);
      }

      await api.downloadPdf(
        `/reports/statement-pdf/${selectedStudentId}?${params.toString()}`,
        `mess-statement-${statement.student.studentId}-${filter}.pdf`
      );
    } catch (err: any) {
      alert(`PDF Download Error: ${err.message}`);
    } finally {
      setPdfDownloading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !paymentAmount) return;

    setPaymentSubmitting(true);
    try {
      await api.post('/billing/payments', {
        studentProfileId: selectedStudentId,
        amount: parseFloat(paymentAmount),
        paymentMethod,
        referenceNo: paymentRef,
        receiptNotes: paymentNotes,
      });
      alert('Payment recorded successfully!');
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      await loadStatement();
    } catch (err: any) {
      alert(`Failed to record payment: ${err.message}`);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleRecordAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !adjAmount || !adjReason.trim()) return;

    setAdjSubmitting(true);
    try {
      await api.post('/billing/adjustments', {
        studentProfileId: selectedStudentId,
        amount: parseFloat(adjAmount),
        type: adjType,
        reason: adjReason,
      });
      alert('Adjustment recorded successfully!');
      setShowAdjustmentModal(false);
      setAdjAmount('');
      setAdjReason('');
      await loadStatement();
    } catch (err: any) {
      alert(`Failed to record adjustment: ${err.message}`);
    } finally {
      setAdjSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
            <Receipt className="w-4 h-4" /> Financial Auditing
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1">
            Consumption Billing & Payment Processing
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Students pay only for meals consumed. Fixed monthly charges are strictly prohibited.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPaymentModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" /> Record Payment
          </button>
          <button
            onClick={() => setShowAdjustmentModal(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
          >
            <DollarSign className="w-4 h-4" /> Adjustment / Refund
          </button>
        </div>
      </div>

      {/* Filter and Student Selection Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="w-full sm:w-64">
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Select Student:</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.studentId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Period Filter:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold"
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
                  className="bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500">To:</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>
          )}
        </div>

        {statement && (
          <button
            onClick={handleDownloadPdf}
            disabled={pdfDownloading}
            className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition disabled:opacity-50"
          >
            <FileDown className="w-4 h-4 text-emerald-600" />
            {pdfDownloading ? 'Generating PDF...' : 'Download Official PDF Report'}
          </button>
        )}
      </div>

      {/* Statement Content */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
          Calculating consumption-based statement...
        </div>
      ) : statement ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Meals Attended
              </span>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {statement.summary.totalMealsAttended}
              </div>
              <span className="text-[11px] text-slate-500">In selected period</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Total Charges
              </span>
              <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                ₹{statement.summary.totalCharges.toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-500">Consumption charges only</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Payments & Adjustments
              </span>
              <div className="text-2xl font-black text-emerald-600 mt-2 font-mono">
                ₹{(statement.summary.totalPayments + statement.summary.totalAdjustments).toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-500">
                Paid: ₹{statement.summary.totalPayments.toFixed(2)} • Adj: ₹{statement.summary.totalAdjustments.toFixed(2)}
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Outstanding Balance
              </span>
              <div
                className={`text-2xl font-black mt-2 font-mono ${
                  statement.summary.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                ₹{statement.summary.outstandingBalance.toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-500">Net payable balance</span>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Itemized Meal Check-Ins</h3>
              <span className="text-xs text-slate-400">
                {statement.period.startDate} to {statement.period.endDate}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="px-5 py-3.5">#</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5">Meal Category</th>
                    <th className="px-4 py-3.5">Verification Method</th>
                    <th className="px-5 py-3.5 text-right">Applicable Historical Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statement.itemizedCharges.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                        No meals checked into during this period. Zero charges applied.
                      </td>
                    </tr>
                  ) : (
                    statement.itemizedCharges.map((item: any, idx: number) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-5 py-3 text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{item.date}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{item.mealName}</td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
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

      {/* Payment Entry Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Record Student Payment</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="e.g. 500.00"
                  className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-semibold"
                >
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CARD">Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Transaction Reference No.</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. UPI / UTR transaction ID"
                  className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Receipt Notes</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentSubmitting}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-500 disabled:opacity-50"
                >
                  {paymentSubmitting ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Record Financial Adjustment</h3>
              <button
                onClick={() => setShowAdjustmentModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Adjustment Type *</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value)}
                  className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-semibold"
                >
                  <option value="CREDIT_REFUND">Credit / Refund (Reduces student bill)</option>
                  <option value="DEBIT_CORRECTION">Debit Correction (Increases student bill)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.5"
                  required
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  placeholder="e.g. 50.00"
                  className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Audit Reason / Justification *</label>
                <textarea
                  required
                  rows={3}
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="e.g. Authorized refund for verified cafeteria machine disruption."
                  className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjSubmitting}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50"
                >
                  {adjSubmitting ? 'Recording...' : 'Authorize Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
