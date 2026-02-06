'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import { useStore } from '@/store/useStore';
import LoginScreen from '@/components/LoginScreen';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, isLoading, isLoggedIn } = useStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Get nickname from uidToNick
          const nickSnap = await get(ref(db, `uidToNick/${firebaseUser.uid}`));
          const nickname = nickSnap.val();

          if (nickname) {
            // Get user data
            const userSnap = await get(ref(db, `users/${nickname}`));
            const userData = userSnap.val() || {};

            // Check admin
            const adminSnap = await get(ref(db, `adminUids/${firebaseUser.uid}`));
            const isAdmin = adminSnap.val() === true;

            setUser({
              nickname,
              team: userData.team || [],
              formation: userData.formation || '4-3-3',
              budget: userData.budget ?? 100,
              totalPoints: userData.totalPoints ?? 0,
              isAdmin,
            });
          } else {
            setUser(null);
          }
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
      setReady(true);
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);

  if (!ready || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center font-bold text-white text-xl animate-pulse">
            FB
          </div>
          <p className="text-zinc-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
