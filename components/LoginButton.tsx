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
        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
      </button>
    );
  }

  const isAdmin = user.email ? isAdminEmail(user.email) : false;

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-3">
        {user.photoURL && (
          <img 
            src={user.photoURL} 
            alt={user.displayName || 'User'} 
            className="w-10 h-10 rounded-full border-2 border-indigo-200 dark:border-indigo-700"
          />
        )}
        <div className="text-sm">
          <div className="font-medium text-slate-700 dark:text-slate-200">
            {user.displayName || user.email}
          </div>
          {isAdmin && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
              ⭐ Admin
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => signOut(getClientAuth())}
        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium transition-all"
      >
        Sign out
      </button>
    </div>
  );
}
