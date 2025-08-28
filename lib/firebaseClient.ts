import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';

type ClientConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  databaseURL?: string;
};

const firebaseConfig: ClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: `https://slotbooking-ef3fc-default-rtdb.asia-southeast1.firebasedatabase.app`,
};

function assertClientConfig(cfg: ClientConfig): asserts cfg is Required<ClientConfig> {
  const missing = Object.entries(cfg)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `Firebase client config missing: ${missing.join(', ')}. Add them to .env.local (NEXT_PUBLIC_...)`
    );
  }
}

let cachedApp: FirebaseApp | undefined;
export function getClientApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  if (!getApps().length) {
    assertClientConfig(firebaseConfig);
    cachedApp = initializeApp(firebaseConfig);
  } else {
    cachedApp = getApp();
  }
  return cachedApp!;
}

let cachedAuth: Auth | undefined;
export function getClientAuth(): Auth {
  if (!cachedAuth) cachedAuth = getAuth(getClientApp());
  return cachedAuth;
}

let cachedDb: Database | undefined;
export function getClientDb(): Database {
  if (!cachedDb) cachedDb = getDatabase(getClientApp());
  return cachedDb;
}

export const googleProvider = new GoogleAuthProvider();

export const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || '';



