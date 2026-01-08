"use client";
import { useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getClientAuth, isAdminEmail } from '@/lib/firebaseClient';
import { APP_CONFIG } from '@/lib/config';

type CancellationRequest = {
  id: string;
  bookingId: string;
  userId: string;
  userEmail: string;
  userName: string;
  date: string;
  slot: number;
  bandName: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  adminResponse?: string;
  adminResponseAt?: number;
  adminId?: string;
  adminEmail?: string;
  autoApproved?: boolean;
};

export default function CancellationRequests() {
  const [requests, setRequests] = useState<CancellationRequest[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CancellationRequest | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = email ? isAdminEmail(email) : false;

  useEffect(() => {
    const auth = getClientAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setEmail(u?.email || null);
    });
    return () => unsub();
  }, []);

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    try {
      const token = await getClientAuth().currentUser?.getIdToken();
      const res = await fetch('/api/cancellation-requests', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.requests) setRequests(data.requests);
    } catch (e) {
      console.error('Failed to load cancellation requests:', e);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      refresh();
    }
  }, [isAdmin, refresh]);

  async function handleAction(action: 'approve' | 'reject') {
    if (!selectedRequest) return;
    
    setActionLoading(true);
    try {
      const token = await getClientAuth().currentUser?.getIdToken();
      const res = await fetch('/api/cancel-request', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          action,
          adminResponse: adminResponse.trim(),
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to process request');
      }
      
      setShowResponseModal(false);
      setSelectedRequest(null);
      setAdminResponse('');
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to process request';
      alert(message);
    } finally {
      setActionLoading(false);
    }
  }

  function openResponseModal(request: CancellationRequest) {
    setSelectedRequest(request);
    setAdminResponse('');
    setShowResponseModal(true);
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function formatTime(slot: number) {
    const hour = ((slot % 24) + 24) % 24;
    // Weekend slots are hourly (8 AM to 11 PM), weekday slots are at :30 (5:30 PM to 3:30 AM)
    // Check if it's a weekend slot (8-23)
    if (slot >= 8 && slot <= 23) {
      return `${String(hour).padStart(2, '0')}:00`;
    }
    return `${String(hour).padStart(2, '0')}:30`;
  }

  function formatDateTime(timestamp: number) {
    return new Date(timestamp).toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (!isAdmin) return null;

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            📋 Cancellation Requests
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage booking cancellation requests
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center gap-2"
        >
          <span>{loading ? '⏳' : '🔄'}</span>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Pending Requests */}
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl">
        <div className="px-6 py-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <span>⏳</span>
            Pending Requests
            <span className="ml-2 px-2 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-full text-sm">
              {pendingRequests.length}
            </span>
          </h3>
        </div>
        <div className="p-6">
          {pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <div className="text-4xl mb-3">✅</div>
              <p>No pending cancellation requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div 
                  key={request.id} 
                  className="border-2 border-amber-200 dark:border-amber-800 rounded-xl p-5 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                    <div>
                      <div className="font-bold text-lg text-slate-800 dark:text-slate-100">
                        🎸 {request.bandName}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {request.userName} • {request.userEmail}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-700 dark:text-slate-200">
                        {formatDate(request.date)}
                      </div>
                      <div className="text-indigo-600 dark:text-indigo-400 font-mono">
                        {formatTime(request.slot)}
                      </div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                      Reason for cancellation:
                    </div>
                    <div className="text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 p-3 rounded-xl border border-slate-200 dark:border-slate-600">
                      {request.reason}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Requested: {formatDateTime(request.createdAt)}
                    </div>
                    <button
                      onClick={() => openResponseModal(request)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:from-indigo-600 hover:to-purple-700 shadow-md hover:shadow-lg transition-all"
                    >
                      📝 Review Request
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Processed Requests */}
      {processedRequests.length > 0 && (
        <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl">
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span>📁</span>
              Processed Requests
              <span className="ml-2 px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-sm">
                {processedRequests.length}
              </span>
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {processedRequests.map((request) => (
                <div 
                  key={request.id} 
                  className={`border-2 rounded-xl p-5 transition-colors ${
                    request.status === 'approved'
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'
                      : 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                    <div>
                      <div className="font-bold text-lg text-slate-800 dark:text-slate-100">
                        🎸 {request.bandName}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {request.userName} • {request.userEmail}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-700 dark:text-slate-200">
                        {formatDate(request.date)}
                      </div>
                      <div className="text-indigo-600 dark:text-indigo-400 font-mono">
                        {formatTime(request.slot)}
                      </div>
                      <div className={`mt-1 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        request.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                      }`}>
                        {request.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                        {request.autoApproved && ' (Auto)'}
                      </div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                      Reason for cancellation:
                    </div>
                    <div className="text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 p-3 rounded-xl border border-slate-200 dark:border-slate-600">
                      {request.reason}
                    </div>
                  </div>
                  {request.adminResponse && (
                    <div className="mb-4">
                      <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                        {request.autoApproved ? 'System response:' : 'Admin response:'}
                      </div>
                      <div className="text-sm bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800">
                        {request.adminResponse}
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Requested: {formatDateTime(request.createdAt)}
                    {request.adminResponseAt && (
                      <span> • Processed: {formatDateTime(request.adminResponseAt)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Response Modal */}
      {showResponseModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
              <h3 className="text-xl font-bold text-white">📝 Review Cancellation Request</h3>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Band</div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100">{selectedRequest.bandName}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Date & Time</div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100">
                    {formatDate(selectedRequest.date)} at {formatTime(selectedRequest.slot)}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">User</div>
                <div className="text-slate-700 dark:text-slate-200">
                  {selectedRequest.userName} ({selectedRequest.userEmail})
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Reason</div>
                <div className="text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 p-3 rounded-xl">
                  {selectedRequest.reason}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                  Admin Response (Optional)
                </label>
                <textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="Add a response message..."
                  className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-white transition-all resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowResponseModal(false);
                    setSelectedRequest(null);
                    setAdminResponse('');
                  }}
                  className="flex-1 px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl hover:from-red-600 hover:to-orange-600 disabled:opacity-50 font-medium shadow-md hover:shadow-lg transition-all"
                >
                  {actionLoading ? '⏳' : '❌'} Reject
                </button>
                <button
                  onClick={() => handleAction('approve')}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 font-medium shadow-md hover:shadow-lg transition-all"
                >
                  {actionLoading ? '⏳' : '✅'} Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
