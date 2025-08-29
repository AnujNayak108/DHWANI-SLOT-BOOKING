import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

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
  status: 'pending';
  createdAt: number;
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
        (req: any) => req.status === 'pending'
      );
      if (hasPendingRequest) {
        return NextResponse.json({ error: 'You already have a pending cancellation request for this booking' }, { status: 400 });
      }
    }

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
      status: 'pending',
      createdAt: Date.now(),
    };
    
    const newRequestRef = adminDb.ref('cancellationRequests').push();
    await newRequestRef.set(cancellationRequest);

    return NextResponse.json({ ok: true, requestId: newRequestRef.key });
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
    const { uid, email, name } = {
      uid: decoded.uid,
      email: decoded.email || '',
      name: decoded.name || decoded.email || 'User',
    };

    // Verify admin role
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
    if (email !== adminEmail) {
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
