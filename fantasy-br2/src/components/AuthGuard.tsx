'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, get, onValue } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import { useStore } from '@/store/useStore';
import { DEFAULT_APPEARANCE } from '@/lib/appearance';
import LoginScreen from '@/components/LoginScreen';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, isLoading, isLoggedIn, setPlayers, setAppearance, setCurrentRound, setNextGameDate, setRoundStatus, setNextRoundNumber } = useStore();
  const [ready, setReady] = useState(false);

  // Auth listener
  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const nickSnap = await get(ref(db, `uidToNick/${firebaseUser.uid}`));
          const nickname = nickSnap.val();

          if (nickname) {
            const userSnap = await get(ref(db, `users/${nickname}`));
            const userData = userSnap.val() || {};

            // Check both paths for admin status
            const adminSnap = await get(ref(db, `adminUids/${firebaseUser.uid}`));
            const adminSnap2 = await get(ref(db, `gameData/adminList/${firebaseUser.uid}`));
            const isAdmin = adminSnap.val() === true || adminSnap2.val() === true;

            setUser({
              nickname,
              team: userData.team || [],
              formation: userData.formation || '4-3-3',
              budget: userData.budget ?? 100,
              totalPoints: userData.totalPoints ?? 0,
              isAdmin,
              confirmed: userData.confirmed ?? false,
              captain: userData.captain ?? null,
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

  // Load players from Firebase (real-time)
  useEffect(() => {
    const playersRef = ref(db, 'gameData/players/players');
    const unsub = onValue(playersRef, (snap) => {
      const data = snap.val();
      if (Array.isArray(data)) {
        setPlayers(data);
      }
    });
    return () => unsub();
  }, [setPlayers]);

  // Load appearance config
  useEffect(() => {
    const appearanceRef = ref(db, 'config/appearance');
    const unsub = onValue(appearanceRef, (snap) => {
      const data = snap.val();
      if (data) {
        setAppearance({ ...DEFAULT_APPEARANCE, ...data });
      }
    });
    return () => unsub();
  }, [setAppearance]);

  // Load game state
  useEffect(() => {
    const gameStateRef = ref(db, 'gameState');
    const unsub = onValue(gameStateRef, (snap) => {
      const data = snap.val();
      if (data) {
        if (data.currentRound) setCurrentRound(data.currentRound);
        if (data.nextGameDate) setNextGameDate(data.nextGameDate);
        if (data.roundStatus) setRoundStatus(data.roundStatus);
        if (data.nextRoundNumber) setNextRoundNumber(data.nextRoundNumber);
      }
    });
    return () => unsub();
  }, [setCurrentRound, setNextGameDate, setRoundStatus, setNextRoundNumber]);

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
