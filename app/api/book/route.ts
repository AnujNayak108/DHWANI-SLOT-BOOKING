import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, isAdminEmail } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

interface BookingData {
  userId: string;
  userEmail: string;
  userName: string;
  date: string;
  slot: number;
  bandName: string;
  createdAt: number;
  weekKey: string;
}

interface FirebaseBooking {
  date: string;
  slot: number;
  cancelled?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const { uid, email, name } = {
      uid: decoded.uid,
      email: decoded.email || '',
      name: decoded.name || decoded.email || 'User',
    };

    const body = await req.json();
    const { date, slot, bandName } = body as { date?: string; slot?: number; bandName?: string };
    if (!date || typeof slot !== 'number' || !bandName) {
      return NextResponse.json({ error: 'date, slot, and bandName are required' }, { status: 400 });
    }

    // Ensure user doc exists and role
    const role = email && isAdminEmail(email) ? 'admin' : 'user';
    const userRef = adminDb.ref(`users/${uid}`);
    await userRef.set({
      email, 
      name, 
      role, 
      createdAt: Date.now() 
    });

    // Enforce one booking per day per user (instead of per week)
    const existingBookings = await adminDb
      .ref('bookings')
      .orderByChild('userId')
      .equalTo(uid)
      .once('value');
    
    const existingBookingsData = existingBookings.val() as Record<string, FirebaseBooking> | null;
    const hasExistingBookingOnDate = existingBookingsData ? 
      Object.values(existingBookingsData).some((booking: FirebaseBooking) => 
        booking.date === date && !booking.cancelled
      ) : 
      false;
    
    if (hasExistingBookingOnDate) {
      return NextResponse.json({ error: 'You already booked a slot on this date' }, { status: 400 });
    }

    // Ensure slot not taken (excluding cancelled bookings)
    const slotTaken = await adminDb
      .ref('bookings')
      .orderByChild('date')
      .equalTo(date)
      .once('value');
    
    const slotTakenData = slotTaken.val() as Record<string, FirebaseBooking> | null;
    const isSlotTaken = slotTakenData ? 
      Object.values(slotTakenData).some((booking: FirebaseBooking) => 
        booking.slot === slot && !booking.cancelled
      ) : 
      false;
    
    if (isSlotTaken) {
      return NextResponse.json({ error: 'Slot already booked' }, { status: 400 });
    }

    // Create booking with band name
    const booking: BookingData = {
      userId: uid,
      userEmail: email,
      userName: name,
      date,
      slot,
      bandName,
      createdAt: Date.now(),
      weekKey: new Date(date).toISOString().slice(0, 10), // Simple week key
    };
    
    const newBookingRef = adminDb.ref('bookings').push();
    await newBookingRef.set(booking);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Booking error';
    console.error('POST /api/book error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


