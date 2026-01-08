"use client";
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getClientAuth, isAdminEmail } from '@/lib/firebaseClient';
import { toZonedTime } from 'date-fns-tz';
import { APP_CONFIG, isWeekend, getDayName } from '@/lib/config';

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
  autoApproved?: boolean;
};

export default function WeekCalendar() {
  const [dates, setDates] = useState<string[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dateSlotMap, setDateSlotMap] = useState<DateSlotMap>({});
  const [cancellationRequests, setCancellationRequests] = useState<CancellationRequest[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [datesLoading, setDatesLoading] = useState(true);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showCancellationForm, setShowCancellationForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [bandName, setBandName] = useState<string>('');
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'weekdays' | 'weekends'>('weekdays');

  const isAdmin = email ? isAdminEmail(email) : false;

  useEffect(() => {
    const auth = getClientAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid || null);
      setEmail(u?.email || null);
    });
    return () => unsub();
  }, []);

  async function refresh() {
    setDatesLoading(true);
    try {
      const res = await fetch('/api/week', { cache: 'no-store' });
      const data = await res.json();
      if (data.dates) setDates(data.dates);
      if (data.bookings) setBookings(data.bookings);
      if (data.dateSlotMap) setDateSlotMap(data.dateSlotMap);
      if (data.cancellationRequests) setCancellationRequests(data.cancellationRequests);
    } catch (error) {
      console.error('Failed to load week data:', error);
    } finally {
      setDatesLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    
    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const indiaTime = toZonedTime(now, 'Asia/Kolkata');
      const nextMidnight = new Date(indiaTime);
      nextMidnight.setDate(nextMidnight.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0);
      const msUntilMidnight = nextMidnight.getTime() - indiaTime.getTime();
      
      const timeoutId = setTimeout(() => {
        refresh();
        scheduleMidnightRefresh();
      }, msUntilMidnight);
      
      return timeoutId;
    };
    
    const timeoutId = scheduleMidnightRefresh();
    return () => clearTimeout(timeoutId);
  }, []);

  // Separate weekdays and weekends
  const weekdays = dates.filter(d => !isWeekend(d));
  const weekends = dates.filter(d => isWeekend(d));

  // Check if user has any booking on a specific date
  const hasBookingOnDate = (date: string) => {
    return bookings.some(b => b.userId === uid && b.date === date && !b.cancelled);
  };

  // Check how many slots user has booked on a weekend date
  const getWeekendBookingCount = (date: string) => {
    if (!isWeekend(date)) return 0;
    return bookings.filter(b => b.userId === uid && b.date === date && !b.cancelled).length;
  };

  const hasPendingCancellationRequest = (bookingId: string) => {
    return cancellationRequests.some(
      req => req.bookingId === bookingId && req.status === 'pending'
    );
  };

  const getCancellationRequest = (bookingId: string) => {
    return cancellationRequests.find(req => req.bookingId === bookingId);
  };

  async function book(date: string, slot: number) {
    if (!uid) return alert('Sign in first');
    
    // Check booking limits
    if (isWeekend(date)) {
      const weekendBookingCount = getWeekendBookingCount(date);
      if (weekendBookingCount >= APP_CONFIG.WEEKEND_MAX_SLOTS_PER_BAND) {
        return alert(`You can only book ${APP_CONFIG.WEEKEND_MAX_SLOTS_PER_BAND} slots per day on weekends`);
      }
    } else {
      if (hasBookingOnDate(date)) {
        return alert('You already booked a slot on this date');
      }
    }
    
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
      
      // Show appropriate message based on auto-approval
      if (data.autoApproved) {
        alert('✅ Your cancellation has been automatically approved (requested 2+ hours before slot time)');
      } else {
        alert('Cancellation request submitted successfully. Waiting for admin approval.');
      }
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

  // Format time display
  const formatTime = (hour: number, isWeekendSlot: boolean = false) => {
    const displayHour = ((hour % 24) + 24) % 24;
    if (isWeekendSlot) {
      // Weekend slots are hourly (8 AM to 11 PM)
      return `${String(displayHour).padStart(2, '0')}:00`;
    }
    // Weekday slots are at :30 (5:30 PM to 3:30 AM)
    return `${String(displayHour).padStart(2, '0')}:30`;
  };

  // Format date for display
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      day: getDayName(dateStr).slice(0, 3),
      date: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' })
    };
  };

  // Render slot cell
  const renderSlotCell = (d: string, hour: number, isWeekendSlot: boolean = false) => {
    const booking = dateSlotMap[d]?.[hour];
    const isMine = booking && booking.userId === uid;
    const isTaken = !!booking;
    const isWeekendDate = isWeekend(d);
    const weekendBookingCount = isWeekendDate ? getWeekendBookingCount(d) : 0;
    const canBookMore = isWeekendDate ? weekendBookingCount < APP_CONFIG.WEEKEND_MAX_SLOTS_PER_BAND : !hasBookingOnDate(d);
    const cancellationRequest = booking ? getCancellationRequest(booking.bookingId) : null;
    const hasPendingRequest = booking ? hasPendingCancellationRequest(booking.bookingId) : false;
    const isCancelled = booking?.cancelled === true;

    if (isTaken && !isCancelled) {
      return (
        <div
          className={`rounded-xl p-3 transition-all ${
            isMine 
              ? 'bg-emerald-500/20 border-2 border-emerald-500/50 dark:bg-emerald-500/10' 
              : 'bg-slate-200 dark:bg-slate-700/50 border-2 border-slate-300 dark:border-slate-600'
          }`}
          title={isMine ? `Your booking: ${booking.bandName}` : `Booked by: ${booking.bandName}`}
        >
          <div className={`font-semibold text-sm ${isMine ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
            {isMine ? '🎸 Your Booking' : '🔒 Booked'}
          </div>
          <div className={`text-xs mt-1 truncate ${isMine ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
            {booking.bandName}
          </div>
          {isMine && !hasPendingRequest && (
            <button
              onClick={() => requestCancellation(booking.bookingId)}
              className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 mt-2 font-medium transition-colors"
              title="Request cancellation"
            >
              ✕ Cancel
            </button>
          )}
          {hasPendingRequest && (
            <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium flex items-center gap-1">
              <span className="animate-pulse">⏳</span> Pending
            </div>
          )}
          {cancellationRequest?.status === 'rejected' && (
            <div className="text-xs text-red-500 dark:text-red-400 mt-2 font-medium">
              ❌ Rejected
            </div>
          )}
        </div>
      );
    }

    if (isCancelled) {
      return (
        <button
          disabled={loading || !uid || !canBookMore}
          onClick={() => book(d, hour)}
          className="w-full rounded-xl p-3 bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-400 dark:border-amber-600 hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 transition-all text-left"
          title="This slot was recently cancelled and is available for booking"
        >
          <div className="font-semibold text-amber-700 dark:text-amber-400 text-sm">
            🔓 Available
          </div>
          <div className="text-xs text-amber-600 dark:text-amber-300 mt-1 truncate">
            Was: {booking.bandName}
          </div>
          <div className="text-xs text-amber-500 dark:text-amber-400 mt-1 font-medium">
            Click to book
          </div>
        </button>
      );
    }

    const slotLimitMessage = isWeekendDate 
      ? (weekendBookingCount >= APP_CONFIG.WEEKEND_MAX_SLOTS_PER_BAND 
          ? `You've reached the limit (${APP_CONFIG.WEEKEND_MAX_SLOTS_PER_BAND} slots/day)` 
          : `Book slot ${weekendBookingCount + 1}/${APP_CONFIG.WEEKEND_MAX_SLOTS_PER_BAND}`)
      : 'Book this slot';

    return (
      <button
        disabled={loading || !uid || !canBookMore}
        onClick={() => book(d, hour)}
        className="w-full rounded-xl p-3 bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-blue-800 dark:to-blue-400 text-white hover:from-indigo-600 hover:to-purple-700 dark:hover:from-indigo-500 dark:hover:to-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
        title={!canBookMore ? slotLimitMessage : 'Book this slot'}
      >
        <div className="font-semibold text-sm">
          🎵 Book
        </div>
        {isWeekendDate && weekendBookingCount > 0 && (
          <div className="text-xs mt-1 opacity-80">
            {weekendBookingCount}/{APP_CONFIG.WEEKEND_MAX_SLOTS_PER_BAND}
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            📅 This Week&apos;s Schedule
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Book your music room slot
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={resetWeek}
            className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
            disabled={loading}
          >
            <span>🔄</span> Reset Week
          </button>
        )}
      </div>

      {datesLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-4">🎵</div>
            <div className="text-lg text-slate-600 dark:text-slate-300">Loading calendar...</div>
          </div>
        </div>
      ) : dates.length === 0 ? (
        <div className="text-center py-16 bg-red-50 dark:bg-red-900/20 rounded-2xl border-2 border-red-200 dark:border-red-800">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-lg text-red-600 dark:text-red-400">Failed to load calendar</div>
        </div>
      ) : (
        <>
          {/* Tab Navigation */}
          <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab('weekdays')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'weekdays'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span className="mr-2">📆</span>
              Weekdays
              <span className="ml-2 text-xs opacity-70">Mon-Fri</span>
            </button>
            <button
              onClick={() => setActiveTab('weekends')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'weekends'
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span className="mr-2">🎉</span>
              Weekends
              <span className="ml-2 text-xs opacity-70">Sat-Sun</span>
            </button>
          </div>

          {/* Weekdays View */}
          {activeTab === 'weekdays' && (
            <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800">
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">
                        Time
                      </th>
                      {weekdays.map((d) => {
                        const { day, date, month } = formatDateDisplay(d);
                        return (
                          <th key={d} className="px-3 py-4 text-center border-b border-slate-200 dark:border-slate-700 min-w-[140px]">
                            <div className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">{day}</div>
                            <div className="text-xl font-bold text-slate-700 dark:text-slate-200">{date}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{month}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {APP_CONFIG.WEEKDAY_SLOTS.map((hour) => (
                      <tr key={hour} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-sm font-medium text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700/50 sticky left-0 bg-white dark:bg-slate-800/50 z-10">
                          {formatTime(hour, false)}
                        </td>
                        {weekdays.map((d) => (
                          <td key={d + hour} className="px-2 py-2 border-b border-slate-100 dark:border-slate-700/50">
                            {renderSlotCell(d, hour, false)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Weekends View - Hourly Slots Table */}
          {activeTab === 'weekends' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🎉</span>
                  <h3 className="text-lg font-bold text-purple-700 dark:text-purple-300">Weekend Hourly Booking</h3>
                </div>
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  On weekends, you can book up to 2 slots of 1 hour each (morning to night). Each slot is 1 hour long.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800">
                        <th className="px-4 py-4 text-left text-sm font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">
                          Time
                        </th>
                        {weekends.map((d) => {
                          const { day, date, month } = formatDateDisplay(d);
                          return (
                            <th key={d} className="px-3 py-4 text-center border-b border-slate-200 dark:border-slate-700 min-w-[140px]">
                              <div className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">{day}</div>
                              <div className="text-xl font-bold text-slate-700 dark:text-slate-200">{date}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{month}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {APP_CONFIG.WEEKEND_SLOTS.map((hour) => (
                        <tr key={hour} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 font-mono text-sm font-medium text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700/50 sticky left-0 bg-white dark:bg-slate-800/50 z-10">
                            {formatTime(hour, true)}
                          </td>
                          {weekends.map((d) => (
                            <td key={d + hour} className="px-2 py-2 border-b border-slate-100 dark:border-slate-700/50">
                              {renderSlotCell(d, hour, true)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gradient-to-br from-indigo-500 to-purple-600"></div>
              <span className="text-slate-600 dark:text-slate-400">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-500/30 border-2 border-emerald-500/50"></div>
              <span className="text-slate-600 dark:text-slate-400">Your Booking</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-slate-300 dark:bg-slate-600"></div>
              <span className="text-slate-600 dark:text-slate-400">Booked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-amber-200 border-2 border-amber-400"></div>
              <span className="text-slate-600 dark:text-slate-400">Recently Cancelled</span>
            </div>
          </div>
        </>
      )}

      {/* Booking Form Modal */}
      {showBookingForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
              <h3 className="text-xl font-bold text-white">🎸 Book Music Room</h3>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Date</label>
                <div className="px-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium">
                  {selectedDate} ({getDayName(selectedDate)})
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Time</label>
                <div className="px-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium">
                  {formatTime(selectedSlot, isWeekend(selectedDate))}
                  {isWeekend(selectedDate) && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                      (1 hour slot)
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Band Name *</label>
                <input
                  type="text"
                  value={bandName}
                  onChange={(e) => setBandName(e.target.value)}
                  placeholder="Enter your band name"
                  className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-white transition-all"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowBookingForm(false);
                    setBandName('');
                  }}
                  className="flex-1 px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={submitBooking}
                  disabled={loading || !bandName.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 font-medium shadow-md hover:shadow-lg transition-all"
                >
                  {loading ? '⏳ Booking...' : '✓ Book Slot'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Request Form Modal */}
      {showCancellationForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4">
              <h3 className="text-xl font-bold text-white">❌ Request Cancellation</h3>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Reason for Cancellation *</label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Please provide a valid reason for cancellation..."
                  className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-slate-700 dark:text-white transition-all resize-none"
                  rows={4}
                  autoFocus
                />
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <span className="font-semibold">💡 Tip:</span> Cancellations requested 2+ hours before the slot time are automatically approved!
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowCancellationForm(false);
                    setCancellationReason('');
                    setSelectedBookingId('');
                  }}
                  className="flex-1 px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-all"
                >
                  Back
                </button>
                <button
                  onClick={submitCancellationRequest}
                  disabled={loading || !cancellationReason.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl hover:from-red-600 hover:to-orange-600 disabled:opacity-50 font-medium shadow-md hover:shadow-lg transition-all"
                >
                  {loading ? '⏳ Submitting...' : '✓ Submit Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
