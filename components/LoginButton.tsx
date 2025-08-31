"use client";
import { getClientAuth, googleProvider, isAdminEmail } from '@/lib/firebaseClient';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState } from 'react';

export default function LoginButton() {
  const [user, setUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setIsSigningIn(false);
      if (u) {
        // ensure user doc exists via booking API on demand; no-op here
      }
    });
  }, []);

  const handleSignIn = async () => {
    if (isSigningIn) return; // Prevent multiple popup requests
    
    setIsSigningIn(true);
    try {
      const auth = getClientAuth();
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      console.error('Sign in error:', error);
      setIsSigningIn(false);
      
      // Handle specific Firebase errors
      const firebaseError = error as { code?: string };
      if (firebaseError.code === 'auth/cancelled-popup-request') {
        // User cancelled the popup, this is normal
        return;
      } else if (firebaseError.code === 'auth/popup-closed-by-user') {
        // User closed the popup, this is normal
        return;
      } else if (firebaseError.code === 'auth/popup-blocked') {
        alert('Please allow popups for this site to sign in with Google');
      } else {
        alert('Sign in failed. Please try again.');
      }
    }
  };

  if (!user) {
    return (
      <button
        onClick={handleSignIn}
        disabled={isSigningIn}
        className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
      </button>
    );
  }

  const isAdmin = user.email ? isAdminEmail(user.email) : false;

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



