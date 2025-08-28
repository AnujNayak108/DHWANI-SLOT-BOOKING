import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getCurrentWeekDates } from '@/lib/week';

export const runtime = 'nodejs';

interface Booking {
  userId: string;
  userEmail: string;
  userName: string;
  date: string;
  slot: number;
  bandName: string;
  createdAt: number;
}

interface FirebaseBooking {
  userId: string;
  userEmail: string;
  userName: string;
  date: string;
  slot: number;
  bandName: string;
  createdAt: number;
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
      Object.values(allBookings).forEach((booking) => {
        if (dates.includes(booking.date)) {
          bookings.push(booking);
        }
      });
    }
    
    // Create a map of date -> slot -> booking for easy lookup
    const dateSlotMap: Record<string, Record<number, Omit<Booking, 'date' | 'slot'>>> = {};
    dates.forEach(date => {
      dateSlotMap[date] = {};
    });
    
    bookings.forEach((booking: Booking) => {
      if (dateSlotMap[booking.date]) {
        dateSlotMap[booking.date][booking.slot] = {
          userId: booking.userId,
          userEmail: booking.userEmail,
          userName: booking.userName,
          bandName: booking.bandName,
          createdAt: booking.createdAt
        };
      }
    });
    
    return NextResponse.json({ 
      dates, 
      bookings,
      dateSlotMap 
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to load week';
    console.error('GET /api/week error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


