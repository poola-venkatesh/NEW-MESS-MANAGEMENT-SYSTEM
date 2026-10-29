import React, { useState, useEffect } from 'react';
import {
  Clock,
  Edit2,
  Save,
  CheckCircle,
  AlertCircle,
  Utensils,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';

export const MealManagement: React.FC = () => {
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit session state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [defsRes, sessionsRes]: any = await Promise.all([
        api.get('/meals/definitions'),
        api.get('/meals/sessions/today'),
      ]);
      setDefinitions(defsRes.definitions || []);
      setTodaySessions(sessionsRes.sessions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load meal configurations');
    } finally {
      setLoading(false);
    }
  };

  const startEditSession = (session: any) => {
    setEditingSessionId(session.id);
    setEditFormData({
      startTime: session.startTime,
      endTime: session.endTime,
      price: session.price,
      menuDescription: session.menuDescription || '',
      status: session.status,
      isSpecialMeal: session.isSpecialMeal,
    });
    setError(null);
    setSuccess(null);
  };

  const handleSaveSession = async (sessionId: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`/meals/sessions/${sessionId}`, {
        startTime: editFormData.startTime,
        endTime: editFormData.endTime,
        price: parseFloat(editFormData.price),
        menuDescription: editFormData.menuDescription,
        status: editFormData.status,
        isSpecialMeal: editFormData.isSpecialMeal,
      });
      setSuccess('Today meal session parameters updated successfully!');
      setEditingSessionId(null);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to update session');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
            <Utensils className="w-4 h-4" /> Food & Session Controls
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1">
            Dynamic Meal Timings, Menus & Consumption Pricing
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure meal categories, active attendance windows, special feast menus, and prices without restarting the server.
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

      {/* Today's Dynamic Sessions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" /> Today's Active Session Snapshots
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">
            Rule: Modifying price applies to new check-ins; past charges remain preserved.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {todaySessions.map((session) => {
            const isEditing = editingSessionId === session.id;

            return (
              <div
                key={session.id}
                className={`bg-white border rounded-2xl p-5 shadow-sm transition space-y-4 ${
                  session.status === 'ACTIVE'
                    ? 'border-emerald-300 ring-2 ring-emerald-500/10'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-base">{session.name}</h4>
                      {session.isSpecialMeal && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                          <Sparkles className="w-3 h-3" /> Special Meal
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          session.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {session.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {session.startTime} – {session.endTime}
                      </span>
                    </div>
                  </div>

                  {!isEditing && (
                    <button
                      onClick={() => startEditSession(session)}
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-emerald-600 transition"
                      title="Edit Session Parameters"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">Start Time</label>
                        <input
                          type="text"
                          value={editFormData.startTime}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, startTime: e.target.value })
                          }
                          className="mt-0.5 w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                          placeholder="07:30"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">End Time</label>
                        <input
                          type="text"
                          value={editFormData.endTime}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, endTime: e.target.value })
                          }
                          className="mt-0.5 w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                          placeholder="09:30"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">Price (₹)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={editFormData.price}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, price: e.target.value })
                          }
                          className="mt-0.5 w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-emerald-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">Status</label>
                        <select
                          value={editFormData.status}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, status: e.target.value })
                          }
                          className="mt-0.5 w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="CLOSED">CLOSED</option>
                          <option value="SCHEDULED">SCHEDULED</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600">Today's Menu Description</label>
                      <textarea
                        rows={2}
                        value={editFormData.menuDescription}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, menuDescription: e.target.value })
                        }
                        className="mt-0.5 w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editFormData.isSpecialMeal}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, isSpecialMeal: e.target.checked })
                          }
                          className="rounded border-slate-300 text-purple-600"
                        />
                        <span className="text-[11px] text-slate-700 font-medium">Mark as Special Feast</span>
                      </label>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingSessionId(null)}
                          className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleSaveSession(session.id)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-semibold flex items-center gap-1"
                        >
                          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Apply'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Per-Meal Price:</span>
                      <span className="font-mono font-bold text-emerald-700 text-sm">
                        ₹{Number(session.price).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Today's Menu:</span>
                      <p className="text-slate-700 italic mt-0.5">
                        {session.menuDescription || 'Standard menu'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
