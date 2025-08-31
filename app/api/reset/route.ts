import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, isAdminEmail } from '@/lib/firebaseAdmin';
import { getCurrentWeekDates } from '@/lib/week';

export const runtime = 'nodejs';

interface FirebaseBooking {
  date: string;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || '';
    
    if (!email || !isAdminEmail(email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const dates = getCurrentWeekDates();
    
    // Get all bookings and filter by current week dates
    const bookingsSnapshot = await adminDb.ref('bookings').once('value');
    const allBookings = bookingsSnapshot.val() as Record<string, FirebaseBooking> | null;
    
    // Find bookings to delete (those in current week)
    const bookingsToDelete: string[] = [];
    if (allBookings) {
      Object.entries(allBookings).forEach(([key, booking]) => {
        if (dates.includes(booking.date)) {
          bookingsToDelete.push(key);
        }
      });
    }
    
    // Delete each booking
    const deletePromises = bookingsToDelete.map(key => 
      adminDb.ref(`bookings/${key}`).remove()
    );
    await Promise.all(deletePromises);
    
    return NextResponse.json({ ok: true, deletedCount: bookingsToDelete.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Reset failed';
    console.error('POST /api/reset error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


