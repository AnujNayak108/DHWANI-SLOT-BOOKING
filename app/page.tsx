"use client";
import { useEffect, useState } from 'react';
import LoginButton from '@/components/LoginButton';
import WeekCalendar from '@/components/WeekCalendar';
import CancellationRequests from '@/components/CancellationRequests';
import LoadingScreen from '@/components/LoadingScreen';

export default function Home() {
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    // Show loading screen for a short duration on initial load
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1500); // Show for 1.5 seconds

    return () => clearTimeout(timer);
  }, []);

  if (isInitialLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950">

      <div className="relative z-10 p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 dark:from-blue-800 dark:via-blue-600 dark:to-blue-400 bg-clip-text text-transparent">
              <img src={process.env.NEXT_PUBLIC_LOGO_PATH} alt="Music Room" className="w-12 h-12 mr-2 inline-block" /> Music Room
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm sm:text-base">
              Book your practice slot for the week
            </p>
          </div>
          <LoginButton />
        </header>

        {/* Main content */}
        <main className="space-y-10">
          <WeekCalendar />
          <CancellationRequests />
        </main>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-700 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>Dhwani Music Room Booking System</p>
        </footer>
      </div>
    </div>
  );
}
