"use client";
import { LOGO_PATH } from '@/lib/config';
import Image from 'next/image';

export default function LoadingScreen() {
  const logoPath = LOGO_PATH;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950 flex items-center justify-center z-50">
      <div className="text-center">
        {/* Animated Logo */}
        <div className="mb-8 relative">
          <div className="animate-bounce">
            <div className="relative w-32 h-32 mx-auto">
              {/* Outer spinning ring */}
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-400 border-r-purple-400 animate-spin" style={{ animationDuration: '3s' }}></div>
              {/* Inner spinning ring (reverse) */}
              <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-indigo-400 border-l-purple-400 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>
              {/* Logo in center */}
              <div className="absolute inset-0 flex items-center justify-center">
                {logoPath ? (
                  <div className="relative w-20 h-20 animate-pulse">
                    <Image
                      src={logoPath}
                      alt="Logo"
                      fill
                      className="object-contain"
                      priority
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="text-6xl animate-pulse">🎵</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Loading Text */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="h-2 w-2 bg-indigo-400 rounded-full animate-pulse"></div>
            <div className="h-2 w-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="h-2 w-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
          <p className="text-lg font-medium text-slate-200 dark:text-slate-300 animate-pulse">
            Loading Music Room...
          </p>
        </div>
      </div>
    </div>
  );
}
