import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, isAdminEmail } from '@/lib/firebaseAdmin';
import { toZonedTime } from 'date-fns-tz';
import { APP_CONFIG } from '@/lib/config';

export const runtime = 'nodejs';

interface CancellationRequestData {
  bookingId: string;
  userId: string;
  userEmail: string;
  userName: string;
  date: string;
  slot: number;
  bandName: string;
  reason: string;
  status: 'pending' | 'approved';
  createdAt: number;
  autoApproved?: boolean;
  adminResponse?: string;
  adminResponseAt?: number;
}

// Check if the cancellation is requested at least 2 hours before the slot time
function isAutoApprovalEligible(bookingDate: string, slot: number): boolean {
  const now = new Date();
  const zonedNow = toZonedTime(now, APP_CONFIG.TIMEZONE);
  
  // Create the slot datetime
  // Slot is the hour (e.g., 17 = 5:30 PM, 27 = 3:30 AM next day)
  const slotDate = new Date(bookingDate);
  const actualHour = slot % 24;
  const isNextDay = slot >= 24;
  
  if (isNextDay) {
    slotDate.setDate(slotDate.getDate() + 1);
  }
  slotDate.setHours(actualHour, 30, 0, 0); // Slots start at :30
  
  // Convert slot time to zoned time for comparison
  const slotZonedTime = toZonedTime(slotDate, APP_CONFIG.TIMEZONE);
  
  // Calculate difference in milliseconds
  const diffMs = slotZonedTime.getTime() - zonedNow.getTime();
  const twoHoursMs = 2 * 60 * 60 * 1000;
  
  return diffMs >= twoHoursMs;
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
    const { bookingId, reason } = body as { bookingId?: string; reason?: string };
    if (!bookingId || !reason) {
      return NextResponse.json({ error: 'bookingId and reason are required' }, { status: 400 });
    }

    // Verify the booking exists and belongs to the user
    const bookingSnapshot = await adminDb.ref(`bookings/${bookingId}`).once('value');
    const booking = bookingSnapshot.val();
    
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.userId !== uid) {
      return NextResponse.json({ error: 'You can only request cancellation for your own bookings' }, { status: 403 });
    }

    // Check if there's already a pending cancellation request for this booking
    const existingRequestSnapshot = await adminDb
      .ref('cancellationRequests')
      .orderByChild('bookingId')
      .equalTo(bookingId)
      .once('value');
    
    const existingRequests = existingRequestSnapshot.val();
    if (existingRequests) {
      const hasPendingRequest = Object.values(existingRequests).some(
        (req: unknown) => (req as { status: string }).status === 'pending'
      );
      if (hasPendingRequest) {
        return NextResponse.json({ error: 'You already have a pending cancellation request for this booking' }, { status: 400 });
      }
    }

    // Check if auto-approval is eligible (2+ hours before slot time)
    const shouldAutoApprove = isAutoApprovalEligible(booking.date, booking.slot);

    // Create cancellation request
    const cancellationRequest: CancellationRequestData = {
      bookingId,
      userId: uid,
      userEmail: email,
      userName: name,
      date: booking.date,
      slot: booking.slot,
      bandName: booking.bandName,
      reason: reason.trim(),
      status: shouldAutoApprove ? 'approved' : 'pending',
      createdAt: Date.now(),
      ...(shouldAutoApprove && {
        autoApproved: true,
        adminResponse: 'Auto-approved: Cancellation requested more than 2 hours before slot time',
        adminResponseAt: Date.now(),
      }),
    };
    
    const newRequestRef = adminDb.ref('cancellationRequests').push();
    await newRequestRef.set(cancellationRequest);

    // If auto-approved, also mark the booking as cancelled
    if (shouldAutoApprove) {
      await adminDb.ref(`bookings/${bookingId}`).update({
        cancelled: true,
        cancelledAt: Date.now(),
        cancelledBy: uid,
        cancelledByEmail: email,
      });
    }

    return NextResponse.json({ 
      ok: true, 
      requestId: newRequestRef.key,
      autoApproved: shouldAutoApprove,
      message: shouldAutoApprove 
        ? 'Your cancellation has been automatically approved (requested 2+ hours before slot time)'
        : 'Cancellation request submitted. Waiting for admin approval.'
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Cancellation request error';
    console.error('POST /api/cancel-request error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const { uid, email } = {
      uid: decoded.uid,
      email: decoded.email || '',
    };

    // Verify admin role
    if (!isAdminEmail(email)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { requestId, action, adminResponse } = body as { 
      requestId?: string; 
      action?: 'approve' | 'reject'; 
      adminResponse?: string;
    };
    
    if (!requestId || !action) {
      return NextResponse.json({ error: 'requestId and action are required' }, { status: 400 });
    }

    // Get the cancellation request
    const requestSnapshot = await adminDb.ref(`cancellationRequests/${requestId}`).once('value');
    const request = requestSnapshot.val();
    
    if (!request) {
      return NextResponse.json({ error: 'Cancellation request not found' }, { status: 404 });
    }

    if (request.status !== 'pending') {
      return NextResponse.json({ error: 'Request has already been processed' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    // Update the cancellation request
    await adminDb.ref(`cancellationRequests/${requestId}`).update({
      status: newStatus,
      adminResponse: adminResponse?.trim() || '',
      adminResponseAt: Date.now(),
      adminId: uid,
      adminEmail: email,
    });

    // If approved, mark the booking as cancelled instead of deleting it
    if (action === 'approve') {
      await adminDb.ref(`bookings/${request.bookingId}`).update({
        cancelled: true,
        cancelledAt: Date.now(),
        cancelledBy: uid,
        cancelledByEmail: email,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Admin action error';
    console.error('PUT /api/cancel-request error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
