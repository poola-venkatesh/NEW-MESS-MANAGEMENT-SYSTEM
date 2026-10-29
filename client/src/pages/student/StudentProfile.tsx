import React, { useState, useEffect } from 'react';
import { User, Shield, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { api } from '../../services/api';

export const StudentProfile: React.FC<{ user: any; onProfileUpdate?: (user: any) => void }> = ({
  user,
  onProfileUpdate,
}) => {
  const profile = user?.studentProfile;

  const [remarks, setRemarks] = useState(profile?.remarks || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSavePermittedFields = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(null);
    setError(null);

    try {
      const res: any = await api.patch('/admin/students/profile/self', {
        remarks,
        phone,
      });
      setSuccess('Profile details updated successfully!');
      if (onProfileUpdate) {
        onProfileUpdate({
          ...user,
          studentProfile: {
            ...profile,
            remarks: res.student.remarks,
            phone: res.student.phone,
          },
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
          <User className="w-4 h-4" /> Personal Account
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 mt-1">
          Student Profile & Permitted Preferences
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Your official college student profile. For identity changes or password resets, contact the hostel mess office.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Profile Details Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[11px] font-semibold">Full Name</span>
            <strong className="text-slate-900 text-sm">{profile?.fullName}</strong>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[11px] font-semibold">College Student ID</span>
            <strong className="text-slate-900 text-sm font-mono">{profile?.studentId}</strong>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[11px] font-semibold">Login Username</span>
            <span className="text-slate-800 font-mono">@{user?.username}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[11px] font-semibold">Hostel Allocation</span>
            <span className="text-slate-800 font-medium">
              {profile?.hostelBlock || 'Block A'} - Room {profile?.roomNo || 'N/A'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 sm:col-span-2 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[11px] font-semibold">Face Biometric Status</span>
              <span className="text-slate-800 font-medium text-xs">
                {profile?.faceEnrolled
                  ? 'Active biometric template enrolled with encryption'
                  : 'Pending face enrollment with mess desk'}
              </span>
            </div>
            {profile?.faceEnrolled ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                <CheckCircle className="w-3.5 h-3.5" /> Enrolled
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                <AlertCircle className="w-3.5 h-3.5" /> Not Enrolled
              </span>
            )}
          </div>
        </div>

        {/* Permitted Editable Fields */}
        <form onSubmit={handleSavePermittedFields} className="pt-4 border-t border-slate-100 space-y-4">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Permitted Profile Fields
          </h4>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Contact Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Dietary Preferences & Student Remarks
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Pure vegetarian preference, lactose sensitivity, or notes for the mess manager"
              className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-400">
              Only dietary remarks and phone are student-editable.
            </span>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
