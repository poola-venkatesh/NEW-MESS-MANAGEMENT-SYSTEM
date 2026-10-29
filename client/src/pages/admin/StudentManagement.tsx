import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  CheckCircle,
  AlertCircle,
  Key,
  Trash2,
  Edit,
  Camera,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api';

export const StudentManagement: React.FC = () => {
  const navigate = useNavigate();

  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [passwordModalStudent, setPasswordModalStudent] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    loadStudents();
  }, [statusFilter]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const res: any = await api.get(`/admin/students?${params.toString()}`);
      setStudents(res.students || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadStudents();
  };

  const toggleStudentActive = async (student: any) => {
    try {
      await api.post(`/admin/students/${student.id}/toggle-active`);
      await loadStudents();
    } catch (err: any) {
      alert(`Error toggling account: ${err.message}`);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalStudent || !newPassword.trim() || !resetReason.trim()) return;

    setResetLoading(true);
    try {
      await api.post(`/admin/students/${passwordModalStudent.id}/reset-password`, {
        newPassword,
        reason: resetReason,
      });
      alert(`Password successfully reset for ${passwordModalStudent.fullName}`);
      setPasswordModalStudent(null);
      setNewPassword('');
      setResetReason('');
    } catch (err: any) {
      alert(`Failed to reset password: ${err.message}`);
    } finally {
      setResetLoading(false);
    }
  };

  const handleDeleteStudent = async (student: any) => {
    if (
      !window.confirm(
        `Are you sure you want to deactivate and remove student "${student.fullName}" (${student.studentId})?\n\nNote: All past meal attendance, charges, and payments will be preserved for financial auditing.`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/admin/students/${student.id}`);
      alert(`Student account safely removed. Financial records preserved.`);
      await loadStudents();
    } catch (err: any) {
      alert(`Failed to remove student: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
            <Users className="w-4 h-4" /> Directory Management
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1">
            Registered Students Directory
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage student hostel accounts, face enrollment status, password resets, and account status.
          </p>
        </div>

        <button
          onClick={() => navigate('/admin/register-student')}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-sm transition"
        >
          + Register New Student
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2 w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name, college ID, or username..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl hover:bg-slate-700 transition"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs text-slate-500 whitespace-nowrap">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Students</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="enrolled">Face Enrolled</option>
            <option value="not_enrolled">Face Pending</option>
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Student Details</th>
                <th className="px-4 py-3.5">Hostel & Room</th>
                <th className="px-4 py-3.5">Biometrics</th>
                <th className="px-4 py-3.5">Meals Consumed</th>
                <th className="px-4 py-3.5">Outstanding Balance</th>
                <th className="px-4 py-3.5">Account Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Loading students...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-slate-900 block text-sm">
                        {student.fullName}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {student.studentId} • @{student.username} {student.course ? `• ${student.course}` : ''}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="text-slate-800 font-medium">
                        {student.hostelBlock || 'Block A'}
                      </span>
                      <span className="text-slate-400 block text-[11px]">
                        Room {student.roomNo || 'N/A'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      {student.faceEnrolled ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle className="w-3 h-3" /> Enrolled
                        </span>
                      ) : (
                        <button
                          onClick={() => navigate('/admin/face-enrollment')}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 transition cursor-pointer"
                        >
                          <Camera className="w-3 h-3" /> Enroll Now
                        </button>
                      )}
                    </td>

                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {student.totalMealsConsumed} meals
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`font-mono font-bold ${
                          student.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        ₹{Number(student.outstandingBalance).toFixed(2)}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => toggleStudentActive(student)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                          student.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {student.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                      </button>
                    </td>

                    <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => setPasswordModalStudent(student)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                        title="Reset Forgotten Password"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteStudent(student)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Deactivate and Remove Student Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password Reset Modal */}
      {passwordModalStudent && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Reset Student Password</h3>
              <button
                onClick={() => setPasswordModalStudent(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Enter a temporary password for <strong>{passwordModalStudent.fullName}</strong> ({passwordModalStudent.studentId}). Passwords are never retrieved in plaintext.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">New Temporary Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Audit Reason / Justification *</label>
                <input
                  type="text"
                  required
                  value={resetReason}
                  onChange={(e) => setResetReason(e.target.value)}
                  placeholder="e.g. Student requested password reset at mess desk"
                  className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalStudent(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-500 disabled:opacity-50"
                >
                  {resetLoading ? 'Updating...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
