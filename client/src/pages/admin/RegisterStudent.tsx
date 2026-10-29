import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, CheckCircle, AlertCircle, Shield, ArrowRight } from 'lucide-react';
import { api, ApiError } from '../../services/api';

export const RegisterStudent: React.FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    studentId: '',
    username: '',
    password: '',
    email: '',
    phone: '',
    hostelBlock: 'Block A',
    roomNo: '',
    remarks: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [successStudent, setSuccessStudent] = useState<any | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDetails([]);
    setLoading(true);

    try {
      const res: any = await api.post('/admin/students', formData);
      setSuccessStudent(res.student);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.details) setDetails(err.details);
      } else {
        setError(err.message || 'Registration failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
          <UserPlus className="w-4 h-4" /> Admin Registration
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 mt-1">
          Manual Student Account Registration
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Students cannot register themselves. Only an authorized administrator can issue usernames and initial passwords.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          {details.length > 0 && (
            <ul className="list-disc list-inside pl-5 space-y-0.5 text-rose-600">
              {details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {successStudent ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0" />
            <div>
              <h3 className="font-extrabold text-base">Student Account Created Successfully!</h3>
              <p className="text-xs text-emerald-700 mt-0.5">
                The account has been created with verified uniqueness constraints.
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Student Name:</span>
              <strong className="text-slate-800">{successStudent.fullName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">College Student ID:</span>
              <strong className="text-slate-800">{successStudent.studentId}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Login Username:</span>
              <strong className="text-slate-800">{successStudent.username}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Hostel Allocation:</span>
              <span className="text-slate-800 font-medium">
                {successStudent.hostelBlock || 'N/A'} - Room {successStudent.roomNo || 'N/A'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => navigate('/admin/face-enrollment')}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm"
            >
              Enroll Face Biometrics Now <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setSuccessStudent(null);
                setFormData({
                  fullName: '',
                  studentId: '',
                  username: '',
                  password: '',
                  email: '',
                  phone: '',
                  hostelBlock: 'Block A',
                  roomNo: '',
                  remarks: '',
                });
              }}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-white text-xs font-semibold rounded-xl"
            >
              Register Another Student
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Full Name *
              </label>
              <input
                type="text"
                name="fullName"
                required
                value={formData.fullName}
                onChange={handleChange}
                placeholder="e.g. Alex Morgan"
                className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">
                College Student ID (Unique) *
              </label>
              <input
                type="text"
                name="studentId"
                required
                value={formData.studentId}
                onChange={handleChange}
                placeholder="e.g. CS2026-042"
                className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">
                Username (Unique Login) *
              </label>
              <input
                type="text"
                name="username"
                required
                value={formData.username}
                onChange={handleChange}
                placeholder="e.g. alex.morgan"
                className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">
                Initial Password * (Min 8 characters)
              </label>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                value={formData.password}
                onChange={handleChange}
                placeholder="Temporary secure password"
                className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="alex@college.edu"
                className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Hostel Block
              </label>
              <select
                name="hostelBlock"
                value={formData.hostelBlock}
                onChange={handleChange}
                className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Block A">Block A</option>
                <option value="Block B">Block B</option>
                <option value="Block C">Block C</option>
                <option value="PG Block">PG Block</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Room Number
              </label>
              <input
                type="text"
                name="roomNo"
                value={formData.roomNo}
                onChange={handleChange}
                placeholder="e.g. 204"
                className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Optional Admin Remarks
            </label>
            <textarea
              name="remarks"
              rows={2}
              value={formData.remarks}
              onChange={handleChange}
              placeholder="e.g. Special dietary requirements, vegetarian preference"
              className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              Passwords hashed securely with bcrypt. Hashes are never returned via API.
            </span>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Validating...' : 'Register Student'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
