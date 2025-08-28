"use client";
import { getClientAuth, googleProvider, ADMIN_EMAIL } from '@/lib/firebaseClient';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState } from 'react';

export default function LoginButton() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // ensure user doc exists via booking API on demand; no-op here
      }
    });
  }, []);

  if (!user) {
    return (
      <button
        onClick={() => signInWithPopup(getClientAuth(), googleProvider)}
        className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
      >
        Sign in with Google
      </button>
    );
  }

  const isAdmin = user.email === ADMIN_EMAIL;

  return (
    <div className="flex items-center gap-3">
      <div className="text-sm">
        Signed in as <span className="font-medium">{user.displayName || user.email}</span>
        {isAdmin ? ' (admin)' : ''}
      </div>
      <button
        onClick={() => signOut(getClientAuth())}
        className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-800"
      >
        Sign out
      </button>
    </div>
  );
}



