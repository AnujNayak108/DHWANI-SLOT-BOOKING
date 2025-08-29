"use client";
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getClientAuth, ADMIN_EMAIL } from '@/lib/firebaseClient';
import { getCurrentWeekDates } from '@/lib/week';

type Booking = { 
  id: string;
  userId: string; 
  userEmail: string;
  userName: string;
  date: string; 
  slot: number; 
  bandName: string;
  createdAt: number;
  cancelled?: boolean;
  cancelledAt?: number;
  cancelledBy?: string;
  cancelledByEmail?: string;
};

type DateSlotMap = Record<string, Record<number, {
  bookingId: string;
  userId: string;
  userEmail: string;
  userName: string;
  bandName: string;
  createdAt: number;
  cancelled?: boolean;
  cancelledAt?: number;
  cancelledBy?: string;
  cancelledByEmail?: string;
}>>;

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

export default function WeekCalendar() {
  const [dates, setDates] = useState<string[]>(getCurrentWeekDates());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dateSlotMap, setDateSlotMap] = useState<DateSlotMap>({});
  const [cancellationRequests, setCancellationRequests] = useState<CancellationRequest[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showCancellationForm, setShowCancellationForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [bandName, setBandName] = useState<string>('');
  const [cancellationReason, setCancellationReason] = useState<string>('');

  const isAdmin = email === ADMIN_EMAIL;

  useEffect(() => {
    const auth = getClientAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid || null);
      setEmail(u?.email || null);
    });
    return () => unsub();
  }, []);

  async function refresh() {
    const res = await fetch('/api/week', { cache: 'no-store' });
    const data = await res.json();
    if (data.dates) setDates(data.dates);
    if (data.bookings) setBookings(data.bookings);
    if (data.dateSlotMap) setDateSlotMap(data.dateSlotMap);
    if (data.cancellationRequests) setCancellationRequests(data.cancellationRequests);
  }

  useEffect(() => {
    refresh();
  }, []);

  // Check if user has any booking on a specific date (daily restriction)
  const hasBookingOnDate = (date: string) => {
    return bookings.some(b => b.userId === uid && b.date === date && !b.cancelled);
  };

  // Check if user has a pending cancellation request for a booking
  const hasPendingCancellationRequest = (bookingId: string) => {
    return cancellationRequests.some(
      req => req.bookingId === bookingId && req.status === 'pending'
    );
  };

  // Get cancellation request for a booking
  const getCancellationRequest = (bookingId: string) => {
    return cancellationRequests.find(req => req.bookingId === bookingId);
  };

  async function book(date: string, slot: number) {
    if (!uid) return alert('Sign in first');
    if (hasBookingOnDate(date)) return alert('You already booked a slot on this date');
    
    // Check if the slot is actually available (not taken by someone else)
    const existingBooking = bookings.find(b => b.date === date && b.slot === slot && !b.cancelled);
    if (existingBooking) {
      return alert('This slot is already booked by someone else');
    }
    
    setSelectedDate(date);
    setSelectedSlot(slot);
    setShowBookingForm(true);
  }

  async function submitBooking() {
    if (!bandName.trim()) return alert('Please enter a band name');
    
    setLoading(true);
    try {
      const token = await getClientAuth().currentUser?.getIdToken();
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ date: selectedDate, slot: selectedSlot, bandName: bandName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to book');
      
      setShowBookingForm(false);
      setBandName('');
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to book';
      alert(message);
    } finally {
      setLoading(false);
    }
  }

  async function requestCancellation(bookingId: string) {
    setSelectedBookingId(bookingId);
    setCancellationReason('');
    setShowCancellationForm(true);
  }

  async function submitCancellationRequest() {
    if (!cancellationReason.trim()) return alert('Please provide a reason for cancellation');
    
    setLoading(true);
    try {
      const token = await getClientAuth().currentUser?.getIdToken();
      const res = await fetch('/api/cancel-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          bookingId: selectedBookingId, 
          reason: cancellationReason.trim() 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit cancellation request');
      
      setShowCancellationForm(false);
      setCancellationReason('');
      setSelectedBookingId('');
      await refresh();
      alert('Cancellation request submitted successfully. Waiting for admin approval.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to submit cancellation request';
      alert(message);
    } finally {
      setLoading(false);
    }
  }

  async function resetWeek() {
    if (!isAdmin) return;
    if (!confirm('Reset all bookings for this week?')) return;
    setLoading(true);
    try {
      const token = await getClientAuth().currentUser?.getIdToken();
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset');
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to reset';
      alert(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">This Week</div>
        {isAdmin && (
          <button
            onClick={resetWeek}
            className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            disabled={loading}
          >
            Reset Week
          </button>
        )}
      </div>

      {/* Booking Form Modal */}
      {showBookingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black border-2 border-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Book Music Room</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <div className="p-2 bg-gray-800 rounded">{selectedDate}</div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Time</label>
                <div className="p-2 bg-gray-800 rounded">{`${String(((selectedSlot % 24) + 24) % 24).padStart(2, '0')}:30`}</div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Band Name *</label>
                <input
                  type="text"
                  value={bandName}
                  onChange={(e) => setBandName(e.target.value)}
                  placeholder="Enter your band name"
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowBookingForm(false);
                    setBandName('');
                  }}
                  className="flex-1 px-4 py-2 border rounded hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={submitBooking}
                  disabled={loading || !bandName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Booking...' : 'Book Slot'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Request Form Modal */}
      {showCancellationForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black border-2 border-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Request Cancellation</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Reason for Cancellation *</label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Please provide a valid reason for cancellation..."
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  autoFocus
                />
              </div>
              <div className="text-sm text-gray-400">
                Your cancellation request will be reviewed by an administrator. 
                You will be notified once it's approved or rejected.
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowCancellationForm(false);
                    setCancellationReason('');
                    setSelectedBookingId('');
                  }}
                  className="flex-1 px-4 py-2 border rounded hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={submitCancellationRequest}
                  disabled={loading || !cancellationReason.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead>
            <tr>
              <th className="border px-2 py-1">Hour</th>
              {dates.map((d) => (
                <th key={d} className="border px-2 py-1">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 11 }).map((_, idx) => {
              const hour = idx + 17; // 17-27 (5:30 PM to 3:30 AM, 11 slots)
              const displayHour = ((hour % 24) + 24) % 24;
              const displayTime = `${String(displayHour).padStart(2, '0')}:30`;
              return (
                <tr key={hour}>
                  <td className="border px-2 py-1 font-medium">{displayTime}</td>
                  {dates.map((d) => {
                    const booking = dateSlotMap[d]?.[hour];
                    const isMine = booking && booking.userId === uid;
                    const isTaken = !!booking;
                    const hasMyBookingOnDate = hasBookingOnDate(d);
                    const cancellationRequest = booking ? getCancellationRequest(booking.bookingId) : null;
                    const hasPendingRequest = booking ? hasPendingCancellationRequest(booking.bookingId) : false;
                    const isCancelled = booking?.cancelled === true;
                    
                    return (
                      <td key={d + hour} className="border p-1">
                        {isTaken && !isCancelled ? (
                          <div
                            className={`text-center rounded px-2 py-1 ${
                              isMine 
                                ? 'bg-green-200 text-green-800' 
                                : 'bg-gray-200 text-gray-600'
                            }`}
                            title={
                              isMine 
                                ? `Your booking: ${booking.bandName}` 
                                : `Booked by: ${booking.bandName}`
                            }
                          >
                            <div className="font-medium">
                              {isMine ? 'Your booking' : 'Booked'}
                            </div>
                            <div className="text-xs truncate">
                              {booking.bandName}
                            </div>
                            {isMine && !hasPendingRequest && (
                              <button
                                onClick={() => requestCancellation(booking.bookingId)}
                                className="text-xs text-red-600 hover:text-red-800 mt-1"
                                title="Request cancellation"
                              >
                                Cancel
                              </button>
                            )}
                            {hasPendingRequest && (
                              <div className="text-xs text-orange-600 mt-1">
                                Pending
                              </div>
                            )}
                            {cancellationRequest?.status === 'rejected' && (
                              <div className="text-xs text-red-600 mt-1">
                                Rejected
                              </div>
                            )}
                          </div>
                        ) : isCancelled ? (
                          <button
                            disabled={loading || !uid || hasMyBookingOnDate}
                            onClick={() => book(d, hour)}
                            className="w-full text-center rounded px-2 py-1 bg-yellow-100 border-2 border-yellow-400 hover:bg-yellow-200 disabled:opacity-50"
                            title="This slot was recently cancelled and is available for booking"
                          >
                            <div className="font-medium text-yellow-800">
                              Recently Cancelled
                            </div>
                            <div className="text-xs text-yellow-700 truncate">
                              {booking.bandName}
                            </div>
                            <div className="text-xs text-yellow-600">
                              Click to book
                            </div>
                          </button>
                        ) : (
                          <button
                            disabled={loading || !uid || hasMyBookingOnDate}
                            onClick={() => book(d, hour)}
                            className="w-full text-center rounded px-2 py-1 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                            title={hasMyBookingOnDate ? 'You already have a booking on this date' : 'Book this slot'}
                          >
                            Book
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


