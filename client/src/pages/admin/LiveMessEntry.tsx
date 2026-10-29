import React, { useState, useEffect, useCallback } from 'react';
import {
  ScanFace,
  CheckCircle,
  AlertTriangle,
  Clock,
  UserCheck,
  ShieldAlert,
  Volume2,
  VolumeX,
  FileEdit,
  RefreshCw,
} from 'lucide-react';
import { CameraView } from '../../components/CameraView';
import { api, ApiError } from '../../services/api';

export const LiveMessEntry: React.FC = () => {
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Ready to scan');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Manual entry modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Fetch active session
  const fetchCurrentSession = async () => {
    try {
      setLoadingSession(true);
      const res: any = await api.get('/meals/sessions/current');
      setActiveSession(res.activeSession);
    } catch (err) {
      console.error('Error fetching meal session:', err);
    } finally {
      setLoadingSession(false);
    }
  };

  useEffect(() => {
    fetchCurrentSession();
    // Poll session every 60s
    const interval = setInterval(fetchCurrentSession, 60000);
    return () => clearInterval(interval);
  }, []);

  // Play audio chime
  const playSound = (type: 'success' | 'duplicate' | 'error') => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'duplicate') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(330, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      // AudioContext not allowed or not supported
    }
  };

  // Cooldown tracker to avoid spamming the same probe multiple times in 4 seconds
  const [lastVerifiedTime, setLastVerifiedTime] = useState<number>(0);

  const handleVerifyProbe = useCallback(
    async (descriptor: number[]) => {
      const now = Date.now();
      if (now - lastVerifiedTime < 3500 || isProcessing) {
        return; // debounce
      }

      setIsProcessing(true);
      setStatusMessage('Authoritative verification in progress...');

      try {
        const res: any = await api.post('/attendance/verify-entry', {
          probeDescriptor: descriptor,
        });

        setLastVerifiedTime(now);
        setLastCheckIn({
          type: 'success',
          student: res.student,
          mealSession: res.mealSession,
          charge: res.chargeAmount,
          time: new Date().toLocaleTimeString(),
          confidence: res.confidenceScore,
        });
        setStatusMessage(`✅ Check-in Confirmed: ${res.student.fullName}`);
        playSound('success');
      } catch (err: any) {
        setLastVerifiedTime(now);
        if (err.status === 409) {
          // Duplicate scan
          setLastCheckIn({
            type: 'duplicate',
            message: err.message,
            time: new Date().toLocaleTimeString(),
          });
          setStatusMessage(`⚠️ Duplicate Scan Detected`);
          playSound('duplicate');
        } else if (err.status === 422) {
          setLastCheckIn({
            type: 'error',
            message: 'Face not recognized. Ensure you have enrolled your face.',
            time: new Date().toLocaleTimeString(),
          });
          setStatusMessage('❌ Unrecognized Face');
          playSound('error');
        } else {
          setLastCheckIn({
            type: 'error',
            message: err.message || 'Verification failed',
            time: new Date().toLocaleTimeString(),
          });
          setStatusMessage('❌ Check-in Error');
          playSound('error');
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [lastVerifiedTime, isProcessing, soundEnabled]
  );

  // Load students for manual entry modal
  const openManualEntryModal = async () => {
    setShowManualModal(true);
    try {
      const res: any = await api.get('/admin/students');
      setStudentsList(res.students || []);
      if (res.students && res.students.length > 0) {
        setSelectedStudentId(res.students[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !manualReason.trim()) return;

    setManualSubmitting(true);
    try {
      const res: any = await api.post('/attendance/manual-entry', {
        studentProfileId: selectedStudentId,
        reason: manualReason,
      });

      alert(`Manual check-in recorded for student! Charge: ₹${res.charge.amount}`);
      setShowManualModal(false);
      setManualReason('');
      fetchCurrentSession();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setManualSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Session Bar */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <ScanFace className="w-4 h-4" /> Live Mess Entry Terminal
          </div>
          <h2 className="text-2xl font-black tracking-tight mt-1">
            Real Device Face Verification Check-In
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Face biometric match triggers 1 atomic attendance record and 1 snapshot meal charge.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              soundEnabled
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-rose-950/40 border-rose-800 text-rose-300'
            }`}
            title="Toggle Audio Feedback"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Chime ON' : 'Chime OFF'}</span>
          </button>

          <button
            onClick={openManualEntryModal}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-2 transition"
          >
            <FileEdit className="w-4 h-4 text-amber-400" /> Audited Manual Entry
          </button>
        </div>
      </div>

      {/* Active Session Alert */}
      {loadingSession ? (
        <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 animate-pulse">
          Checking scheduled meal session...
        </div>
      ) : activeSession ? (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900">
                  {activeSession.name} IS ACTIVE
                </span>
                <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {activeSession.startTime} – {activeSession.endTime}
                </span>
              </div>
              <span className="text-xs text-slate-600 mt-0.5 block">
                Today's Snapshot Price: <strong>₹{Number(activeSession.price).toFixed(2)}</strong> • Menu: {activeSession.menuDescription || 'Standard hostel meal'}
              </span>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-700 hidden sm:inline">
            Status: OPEN
          </span>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-sm block text-amber-950">
              No Meal Session Active At This Moment
            </span>
            Attendance scans are automatically rejected when outside active meal hours. You can update timings in{' '}
            <strong>Meal Timings & Pricing</strong> or use <strong>Audited Manual Entry</strong>.
          </div>
        </div>
      )}

      {/* Main Scanner & Verification Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Camera Feed */}
        <div className="lg:col-span-7">
          <CameraView
            continuousVerify={true}
            onContinuousMatch={handleVerifyProbe}
            onCapture={handleVerifyProbe}
            statusMessage={statusMessage}
            isProcessing={isProcessing}
          />
        </div>

        {/* Right: Instant Verification Feedback Card */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Last Verification Result</h3>
            <span className="text-xs text-slate-400 font-mono">Live Display</span>
          </div>

          {!lastCheckIn ? (
            <div className="py-16 text-center space-y-2">
              <ScanFace className="w-12 h-12 text-slate-300 mx-auto animate-pulse" />
              <h4 className="text-sm font-semibold text-slate-700">Awaiting Student Face Scan</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Have the student look directly at the camera. The neural net detects the face and validates the enrollment template authoritatively.
              </p>
            </div>
          ) : lastCheckIn.type === 'success' ? (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Check-In Confirmed
                  </span>
                  <h4 className="text-lg font-black text-slate-900 leading-tight">
                    {lastCheckIn.student.fullName}
                  </h4>
                  <div className="text-xs text-slate-600 mt-1 space-y-0.5 font-medium">
                    <p>College ID: <strong className="text-slate-900">{lastCheckIn.student.studentId}</strong></p>
                    <p>Hostel: {lastCheckIn.student.hostelBlock || 'Block A'} • Room: {lastCheckIn.student.roomNo || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Meal Session</span>
                  <span className="font-bold text-slate-800">{lastCheckIn.mealSession.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Verified Timestamp</span>
                  <span className="font-mono text-slate-800">{lastCheckIn.time}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Biometric Confidence</span>
                  <span className="font-semibold text-emerald-600">
                    {Math.round(lastCheckIn.confidence * 100)}% Match
                  </span>
                </div>
                <div className="flex justify-between py-1 text-sm font-bold pt-2">
                  <span className="text-slate-800">Consumption Charge</span>
                  <span className="font-mono text-emerald-700">₹{Number(lastCheckIn.charge).toFixed(2)}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 text-center italic">
                Rule enforced: Exactly 1 attendance record and 1 charge created atomically.
              </p>
            </div>
          ) : lastCheckIn.type === 'duplicate' ? (
            <div className="p-5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-3 animate-in shake duration-200">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0" />
                <h4 className="font-black text-sm uppercase tracking-wide text-amber-950">
                  Duplicate Check-in Blocked
                </h4>
              </div>
              <p className="text-xs text-amber-800 font-medium">
                {lastCheckIn.message}
              </p>
              <div className="text-[11px] bg-white/70 p-2.5 rounded-lg border border-amber-200 text-amber-900">
                ⚠️ <strong>Zero Duplicate Charge Rule:</strong> The database transaction rejected this second scan. No additional charges were applied to the student's bill.
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 space-y-3 animate-in shake duration-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
                <h4 className="font-black text-sm uppercase tracking-wide text-rose-950">
                  Scan Unrecognized
                </h4>
              </div>
              <p className="text-xs text-rose-800 font-medium">
                {lastCheckIn.message}
              </p>
              <div className="text-[11px] text-slate-500">
                Tips: Remove masks or caps, look directly into the camera, or ensure the student's face was enrolled in <strong>Face Enrollment</strong>.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Audited Manual Check-In</h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              This will record a manual attendance check-in and charge for the current active meal. A specific audit reason is required.
            </p>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Select Student</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  {studentsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.studentId}) - Room {s.roomNo || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Audit Justification / Reason (Mandatory)
                </label>
                <textarea
                  required
                  rows={3}
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="e.g. Student has facial bandage; verified student ID card manually."
                  className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-500 disabled:opacity-50"
                >
                  {manualSubmitting ? 'Recording...' : 'Authorize Manual Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
