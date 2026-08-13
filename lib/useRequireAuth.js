'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';

// Drop this into any page that requires a logged-in user. Redirects to
// /login once we know for sure there's no session (waits for the initial
// silent-refresh check in AuthContext to finish first, so it doesn't bounce
// someone who's actually logged in but whose token just hasn't resolved yet).
export function useRequireAuth() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  return { user, loading };
}
