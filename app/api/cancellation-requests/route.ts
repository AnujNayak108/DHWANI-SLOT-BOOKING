import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, isAdminEmail } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

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

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const { email } = {
      email: decoded.email || '',
    };

    // Verify admin role
    if (!isAdminEmail(email)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all cancellation requests
    const requestsSnapshot = await adminDb.ref('cancellationRequests').once('value');
    const allRequests = requestsSnapshot.val() as Record<string, Omit<CancellationRequest, 'id'>> | null;
    
    const requests: CancellationRequest[] = [];
    if (allRequests) {
      Object.entries(allRequests).forEach(([id, request]) => {
        requests.push({
          id,
          ...request,
        });
      });
    }

    // Sort by creation date (newest first)
    requests.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({ requests });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to load cancellation requests';
    console.error('GET /api/cancellation-requests error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
