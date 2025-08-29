"use client";
import { useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getClientAuth, ADMIN_EMAIL } from '@/lib/firebaseClient';

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
};

export default function CancellationRequests() {
  const [requests, setRequests] = useState<CancellationRequest[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CancellationRequest | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = email === ADMIN_EMAIL;

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
    return new Date(dateString).toLocaleDateString();
  }

  function formatTime(slot: number) {
    const hour = ((slot % 24) + 24) % 24;
    return `${String(hour).padStart(2, '0')}:30`;
  }

  function formatDateTime(timestamp: number) {
    return new Date(timestamp).toLocaleString();
  }

  if (!isAdmin) return null;

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Cancellation Requests</h2>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Pending Requests */}
      <div>
        <h3 className="text-lg font-medium mb-3">Pending Requests ({pendingRequests.length})</h3>
        {pendingRequests.length === 0 ? (
          <p className="text-gray-500">No pending cancellation requests</p>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <div key={request.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-medium">{request.bandName}</div>
                    <div className="text-sm text-gray-600">
                      {request.userName} ({request.userEmail})
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{formatDate(request.date)}</div>
                    <div>{formatTime(request.slot)}</div>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="text-sm font-medium mb-1">Reason for cancellation:</div>
                  <div className="text-sm bg-white p-2 rounded border">{request.reason}</div>
                </div>
                <div className="text-xs text-gray-500 mb-3">
                  Requested on: {formatDateTime(request.createdAt)}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => openResponseModal(request)}
                    className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
                  >
                    Review Request
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Processed Requests */}
      {processedRequests.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3">Processed Requests ({processedRequests.length})</h3>
          <div className="space-y-3">
            {processedRequests.map((request) => (
              <div key={request.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-medium">{request.bandName}</div>
                    <div className="text-sm text-gray-600">
                      {request.userName} ({request.userEmail})
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{formatDate(request.date)}</div>
                    <div>{formatTime(request.slot)}</div>
                    <div className={`font-medium ${
                      request.status === 'approved' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {request.status === 'approved' ? 'Approved' : 'Rejected'}
                    </div>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="text-sm font-medium mb-1">Reason for cancellation:</div>
                  <div className="text-sm bg-white p-2 rounded border">{request.reason}</div>
                </div>
                {request.adminResponse && (
                  <div className="mb-3">
                    <div className="text-sm font-medium mb-1">Admin response:</div>
                    <div className="text-sm bg-white p-2 rounded border">{request.adminResponse}</div>
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  Requested: {formatDateTime(request.createdAt)}
                  {request.adminResponseAt && (
                    <span> • Processed: {formatDateTime(request.adminResponseAt)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response Modal */}
      {showResponseModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black border-2 border-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Review Cancellation Request</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-1">Band: {selectedRequest.bandName}</div>
                <div className="text-sm text-gray-400">
                  {selectedRequest.userName} ({selectedRequest.userEmail})
                </div>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Date & Time:</div>
                <div className="text-sm text-gray-400">
                  {formatDate(selectedRequest.date)} at {formatTime(selectedRequest.slot)}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Reason:</div>
                <div className="text-sm bg-gray-800 p-2 rounded">{selectedRequest.reason}</div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Admin Response (Optional)</label>
                <textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="Add a response message..."
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800"
                  rows={3}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowResponseModal(false);
                    setSelectedRequest(null);
                    setAdminResponse('');
                  }}
                  className="flex-1 px-4 py-2 border rounded hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Reject'}
                </button>
                <button
                  onClick={() => handleAction('approve')}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
