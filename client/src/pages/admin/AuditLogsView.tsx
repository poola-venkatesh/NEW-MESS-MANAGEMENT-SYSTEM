import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter, RefreshCw, Key, FileText } from 'lucide-react';
import { api } from '../../services/api';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  useEffect(() => {
    loadLogs();
  }, [actionFilter, entityFilter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (actionFilter) params.append('action', actionFilter);
      if (entityFilter) params.append('entityType', entityFilter);

      const res: any = await api.get(`/audit/logs?${params.toString()}`);
      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> System Security & Financial Audit Trail
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1">
            Tamper-Evident System Audit Logs
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Immutable tracking of logins, biometric registrations, meal check-ins, financial corrections, and payments.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Filter Action:</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900"
            >
              <option value="">All Actions</option>
              <option value="AUTH_LOGIN_SUCCESS">Login Success</option>
              <option value="AUTH_LOGIN_FAILED">Login Failed</option>
              <option value="STUDENT_REGISTER">Student Registered</option>
              <option value="BIOMETRIC_ENROLLED">Biometric Enrolled</option>
              <option value="ATTENDANCE_RECORDED">Attendance Recorded</option>
              <option value="PAYMENT_RECORDED">Payment Recorded</option>
              <option value="FINANCIAL_ADJUSTMENT_RECORDED">Adjustment Recorded</option>
              <option value="ATTENDANCE_VOIDED">Attendance Voided</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Entity Type:</label>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900"
            >
              <option value="">All Entities</option>
              <option value="User">User</option>
              <option value="StudentProfile">StudentProfile</option>
              <option value="FaceBiometric">FaceBiometric</option>
              <option value="Attendance">Attendance</option>
              <option value="Payment">Payment</option>
              <option value="Adjustment">Adjustment</option>
            </select>
          </div>
        </div>

        <span className="text-xs text-slate-400 font-medium">
          Showing {logs.length} of {total} audit records
        </span>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-4 py-3.5">Actor</th>
                <th className="px-4 py-3.5">Action</th>
                <th className="px-4 py-3.5">Entity</th>
                <th className="px-5 py-3.5">Audit Details</th>
                <th className="px-4 py-3.5 text-right">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-slate-900 block">
                        {log.actorUser?.username || 'SYSTEM / ANONYMOUS'}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        {log.actorRole || 'N/A'}
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-slate-700 font-semibold">{log.entityType}</span>
                    </td>

                    <td className="px-5 py-3 max-w-xs break-words text-[11px] text-slate-600">
                      {log.details ? (
                        <pre className="text-[10px] bg-slate-50 p-1.5 rounded border border-slate-100 whitespace-pre-wrap font-mono">
                          {log.details}
                        </pre>
                      ) : (
                        <span className="text-slate-400 italic">No extra metadata</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
