import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getDatabase as getAdminDatabase } from 'firebase-admin/database';

let adminApp: App;

if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || '';
    if (!projectId || !clientEmail || !privateKeyRaw) {
      throw new Error('Missing FIREBASE_* admin env vars. Check .env.local');
    }
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
      }),
      databaseURL: `https://slotbooking-ef3fc-default-rtdb.asia-southeast1.firebasedatabase.app`,
    });
} else {
	adminApp = getApps()[0]!;
}

export const adminAuth = getAdminAuth(adminApp);
export const adminDb = getAdminDatabase(adminApp);

// Utility function to check if an email is an admin
export const isAdminEmail = (email: string): boolean => {
  const adminEmailsString = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
  const adminEmails = adminEmailsString
    .split(',')
    .map(email => email.trim())
    .filter(email => email.length > 0);
  
  return adminEmails.includes(email);
};



