import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirebase, clearLegacyAuthCookie } from './firebase-client.mjs';

export function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    clearLegacyAuthCookie();
    try {
      return onAuthStateChanged(getFirebase().auth, current => {
        // Identity comes exclusively from the Firebase SDK, never an auth cookie.
        setUser(current ? { id: current.uid, email: current.email } : null);
        setLoading(false);
      }, () => {
        setUser(null);
        setError('Sign-in is unavailable. Please try again later.');
        setLoading(false);
      });
    } catch {
      setError('Sign-in is unavailable. Please try again later.');
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(getFirebase().auth);
      clearLegacyAuthCookie();
      await router.push('/auth');
    } catch {
      setError('Unable to sign out. Please try again.');
    }
  }, [router]);

  return { user, loading, error, logout };
}
