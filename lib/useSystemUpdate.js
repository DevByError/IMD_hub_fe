'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { SYSTEM_UPDATE_CONFIG, SYSTEM_UPDATE_STORAGE_KEY } from './systemUpdate.config';

// Entirely client-side — no backend involved. "Has this user agreed to the
// CURRENT version in SYSTEM_UPDATE_CONFIG" is answered by comparing that
// version string against what's saved in localStorage under a key scoped to
// their user id. Bump the version in systemUpdate.config.js and every user
// is "pending" again on their next load, everywhere the app is open.
export function useSystemUpdateStatus() {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);

  const storageKey = user ? `${SYSTEM_UPDATE_STORAGE_KEY}:${user.id}` : null;

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      setPending(false);
      return;
    }
    const accepted = window.localStorage.getItem(storageKey);
    setPending(accepted !== SYSTEM_UPDATE_CONFIG.version);
  }, [storageKey]);

  const agree = useCallback(() => {
    if (!storageKey || typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, SYSTEM_UPDATE_CONFIG.version);
    setPending(false);
  }, [storageKey]);

  return { pending, config: SYSTEM_UPDATE_CONFIG, agree };
}
