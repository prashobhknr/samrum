/**
 * Phase 4: Next.js App Component
 * 
 * Main application wrapper with global providers
 */

import type { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAppStore } from '@/lib/store';
import { getStoredUser, initializeAuth } from '@/lib/auth';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const { setUser, setIsAuthenticated } = useAppStore();

  useEffect(() => {
    // Initialize auth on app load
    initializeAuth();
    const user = getStoredUser();

    if (user) {
      setUser(user);
      setIsAuthenticated(true);
    } else if (router.pathname !== '/login' && router.pathname !== '/') {
      router.push('/login');
    }

    setIsReady(true);
  }, [setUser, setIsAuthenticated, router]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <Component {...pageProps} />;
}
