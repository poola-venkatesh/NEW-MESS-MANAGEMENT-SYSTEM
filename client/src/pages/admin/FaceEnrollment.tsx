import React, { useState, useEffect } from 'react';
import {
  Camera,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Trash2,
  RefreshCw,
  User,
  Info,
} from 'lucide-react';
import { CameraView } from '../../components/CameraView';
import { api, ApiError } from '../../services/api';

export const FaceEnrollment: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [isReEnroll, setIsReEnroll] = useState(false);
  const [reEnrollReason, setReEnrollReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const res: any = await api.get('/admin/students');
      setStudents(res.students || []);
      if (res.students && res.students.length > 0 && !selectedStudentId) {
        setSelectedStudentId(res.students[0].id);
        setSelectedStudent(res.students[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentChange = (id: string) => {
    setSelectedStudentId(id);
    const s = students.find((st) => st.id === id);
    setSelectedStudent(s || null);
    setIsReEnroll(s?.faceEnrolled || false);
    setConsentGiven(false);
    setError(null);
    setSuccess(null);
  };

  const handleFrameCapture = async (descriptor: number[], qualityScore: number) => {
    if (!selectedStudent) {
      setError('Please select a student first');
      return;
    }

    if (!consentGiven) {
      setError('Student informed consent must be checked before saving biometric template');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      if (isReEnroll && selectedStudent.faceEnrolled) {
        if (!reEnrollReason.trim()) {
          throw new Error('Mandatory audit justification required for face re-enrollment');
        }
        await api.post('/biometrics/re-enroll', {
          studentProfileId: selectedStudent.id,
          descriptor,
          consentGiven: true,
          qualityScore,
          reason: reEnrollReason,
        });
        setSuccess(`Face template successfully updated for ${selectedStudent.fullName}!`);
      } else {
        await api.post('/biometrics/enroll', {
          studentProfileId: selectedStudent.id,
          descriptor,
          consentGiven: true,
          qualityScore,
        });
        setSuccess(`Face template successfully enrolled for ${selectedStudent.fullName}!`);
      }

      await loadStudents();
      // re-sync selected student
      const updated = students.find((st) => st.id === selectedStudent.id);
      if (updated) setSelectedStudent({ ...updated, faceEnrolled: true });
    } catch (err: any) {
      setError(err.message || 'Failed to enroll face biometric');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBiometrics = async () => {
    if (!selectedStudent || !selectedStudent.faceEnrolled) return;
    if (
      !window.confirm(
        `Are you sure you want to permanently delete biometric data for ${selectedStudent.fullName}? This will revoke their ability to check into meals using face recognition.`
      )
    ) {
      return;
    }

    try {
      setIsProcessing(true);
      await api.delete(`/biometrics/${selectedStudent.id}`);
      setSuccess(`Biometric template permanently deleted for ${selectedStudent.fullName}.`);
      await loadStudents();
      setSelectedStudent({ ...selectedStudent, faceEnrolled: false });
      setIsReEnroll(false);
    } catch (err: any) {
      setError(err.message || 'Failed to delete biometric data');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
            <Camera className="w-4 h-4" /> Biometric Registration Station
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1">
            Student Face Enrollment & Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Enrolls 128-dimensional facial vectors protected with server-side AES-256-GCM encryption.
          </p>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Student Selector & Consent Settings */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <h3 className="font-bold text-slate-900 text-sm border-b pb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-600" /> Step 1: Select Student
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Registered Student
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => handleStudentChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.studentId}) {s.faceEnrolled ? '✓ Enrolled' : '⚠️ Pending'}
                </option>
              ))}
            </select>
          </div>

          {selectedStudent && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">College ID</span>
                <span className="font-bold text-slate-800">{selectedStudent.studentId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hostel Room</span>
                <span className="font-medium text-slate-800">
                  {selectedStudent.hostelBlock || 'Block A'} - Room {selectedStudent.roomNo || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Face Status</span>
                {selectedStudent.faceEnrolled ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Enrolled
                  </span>
                ) : (
                  <span className="text-amber-600 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Not Enrolled
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Re-enrollment warning & reason */}
          {selectedStudent?.faceEnrolled && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <Info className="w-4 h-4 text-amber-600" /> Authorized Re-Enrollment
              </div>
              <p className="text-[11px] text-amber-800">
                This student already has an enrolled face template. To re-capture, specify an audit reason:
              </p>
              <input
                type="text"
                value={reEnrollReason}
                onChange={(e) => setReEnrollReason(e.target.value)}
                placeholder="e.g. Appearance changed / previous capture lighting suboptimal"
                className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs text-slate-900"
              />

              <button
                type="button"
                onClick={handleDeleteBiometrics}
                className="mt-2 text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Revoke / Delete Biometric Template
              </button>
            </div>
          )}

          {/* Consent Checkbox */}
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs text-slate-700 leading-snug">
                <strong>Informed Biometric Consent:</strong> The student explicitly consents to the secure generation and encrypted storage of a mathematical facial descriptor vector used strictly for hostel meal attendance.
              </span>
            </label>
          </div>
        </div>

        {/* Right: Real Device Camera Station */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b pb-3 flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-600" /> Step 2: Live Camera Capture
            </h3>

            <p className="text-xs text-slate-500">
              Ensure the student faces the camera in good lighting. Click <strong>Capture Frame</strong> when the face target box indicates a good detection score.
            </p>

            <CameraView
              continuousVerify={false}
              onCapture={handleFrameCapture}
              isProcessing={isProcessing}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
