import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getCurrentWeekDates } from '@/lib/week';

export const runtime = 'nodejs';

interface Booking {
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
}

interface FirebaseBooking {
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
}

interface CancellationRequest {
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
}

export async function GET() {
  try {
    const dates = getCurrentWeekDates();
    
    // Get all bookings and filter by current week dates
    const bookingsSnapshot = await adminDb.ref('bookings').once('value');
    const allBookings = bookingsSnapshot.val() as Record<string, FirebaseBooking> | null;
    
    // Convert to array and filter by current week dates
    const bookings: Booking[] = [];
    if (allBookings) {
      Object.entries(allBookings).forEach(([id, booking]) => {
        if (dates.includes(booking.date)) {
          bookings.push({
            id,
            ...booking,
          });
        }
      });
    }
    
    // Create a map of date -> slot -> booking for easy lookup
    const dateSlotMap: Record<string, Record<number, {
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
    }>> = {};
    dates.forEach(date => {
      dateSlotMap[date] = {};
    });
    
    bookings.forEach((booking: Booking) => {
      if (dateSlotMap[booking.date]) {
        dateSlotMap[booking.date][booking.slot] = {
          bookingId: booking.id,
          userId: booking.userId,
          userEmail: booking.userEmail,
          userName: booking.userName,
          bandName: booking.bandName,
          createdAt: booking.createdAt,
          cancelled: booking.cancelled,
          cancelledAt: booking.cancelledAt,
          cancelledBy: booking.cancelledBy,
          cancelledByEmail: booking.cancelledByEmail,
        };
      }
    });

    // Get cancellation requests for the current week
    const cancellationRequestsSnapshot = await adminDb.ref('cancellationRequests').once('value');
    const allCancellationRequests = cancellationRequestsSnapshot.val() as Record<string, Omit<CancellationRequest, 'id'>> | null;
    
    const cancellationRequests: CancellationRequest[] = [];
    if (allCancellationRequests) {
      Object.entries(allCancellationRequests).forEach(([id, request]) => {
        if (dates.includes(request.date)) {
          cancellationRequests.push({
            id,
            ...request,
          });
        }
      });
    }
    
    return NextResponse.json({ 
      dates, 
      bookings,
      dateSlotMap,
      cancellationRequests
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to load week';
    console.error('GET /api/week error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


