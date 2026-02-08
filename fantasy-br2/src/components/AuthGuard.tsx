'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, get, onValue } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import { useStore } from '@/store/useStore';
import { DEFAULT_APPEARANCE } from '@/lib/appearance';
import { DEFAULT_SCORING } from '@/lib/scoring';
import LoginScreen from '@/components/LoginScreen';
import LeagueSelector from '@/components/LeagueSelector';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const {
    setAuth, setUser, setLoading, isLoading, isLoggedIn, uid, nickname,
    currentLeague, setCurrentLeague, setPlayers, setAppearance,
    setRound, setSettings, setMessages, setUnreadCount, setTrades, setDraft,
  } = useStore();
  const [ready, setReady] = useState(false);

  // Firebase Auth listener
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const nickSnap = await get(ref(db, `uidToNick/${firebaseUser.uid}`));
          const nick = nickSnap.val();
          if (nick) {
            setAuth(firebaseUser.uid, nick, false);
          } else {
            setAuth(null, null, false);
          }
        } catch {
          setAuth(null, null, false);
        }
      } else {
        setAuth(null, null, false);
        setCurrentLeague(null);
        setUser(null);
      }
      setLoading(false);
      setReady(true);
    });
    return () => unsubscribe();
  }, [setAuth, setLoading, setCurrentLeague, setUser]);

  // When entering a league, load all league data with real-time listeners
  useEffect(() => {
    if (!currentLeague || !uid || !nickname) return;

    const leagueId = currentLeague.id;
    const isAdmin = currentLeague.adminUid === uid;

    // Set admin status in store
    setAuth(uid, nickname, isAdmin);

    const unsubs: (() => void)[] = [];

    // 1. Load players (shared globally)
    const playersRef = ref(db, 'gameData/players/players');
    const unsubPlayers = onValue(playersRef, (snap) => {
      const data = snap.val();
      if (Array.isArray(data)) setPlayers(data);
    });
    unsubs.push(unsubPlayers);

    // 2. League appearance
    const appearRef = ref(db, `leagues/${leagueId}/appearance`);
    const unsubAppear = onValue(appearRef, (snap) => {
      const data = snap.val();
      setAppearance(data ? { ...DEFAULT_APPEARANCE, ...data } : DEFAULT_APPEARANCE);
    });
    unsubs.push(unsubAppear);

    // 3. Round state
    const roundRef = ref(db, `leagues/${leagueId}/round`);
    const unsubRound = onValue(roundRef, (snap) => {
      const data = snap.val();
      if (data) {
        setRound({
          number: data.number || 1,
          status: data.status || 'waiting',
          deadline: data.deadline || null,
          nextGameDate: data.nextGameDate || null,
        });
      }
    });
    unsubs.push(unsubRound);

    // 4. League settings
    const settingsRef = ref(db, `leagues/${leagueId}/settings`);
    const unsubSettings = onValue(settingsRef, (snap) => {
      const data = snap.val();
      if (data) {
        setSettings({
          draftRounds: data.draftRounds || 16,
          draftTimerSeconds: data.draftTimerSeconds || 90,
          maxTradesPerMonth: data.maxTradesPerMonth || 3,
          marketOpen: data.marketOpen ?? false,
          captainMultiplier: data.captainMultiplier || 2,
          scoringRules: data.scoringRules || DEFAULT_SCORING,
        });
      }
    });
    unsubs.push(unsubSettings);

    // 5. User data (members only, admin doesn't play)
    if (!isAdmin) {
      const userRef = ref(db, `leagues/${leagueId}/members/${nickname}`);
      const unsubUser = onValue(userRef, (snap) => {
        const data = snap.val();
        if (data) {
          setUser({
            nickname: data.nickname || nickname,
            team: data.team || [],
            formation: data.formation || '4-3-3',
            totalPoints: data.totalPoints ?? 0,
            confirmed: data.confirmed ?? false,
            captain: data.captain ?? null,
          });
        }
      });
      unsubs.push(unsubUser);
    } else {
      setUser(null);
    }

    // 6. Draft state
    const draftRef = ref(db, `leagues/${leagueId}/draft`);
    const unsubDraft = onValue(draftRef, (snap) => {
      const data = snap.val();
      if (data && data.status) {
        setDraft({
          status: data.status,
          participants: data.participants || [],
          currentPick: data.currentPick || 0,
          totalRounds: data.totalRounds || 16,
          pickTimerSeconds: data.pickTimerSeconds || 90,
          pickStartedAt: data.pickStartedAt || 0,
          picks: data.picks ? Object.values(data.picks) : [],
          availablePlayers: data.availablePlayers || [],
        });
      } else {
        setDraft(null);
      }
    });
    unsubs.push(unsubDraft);

    // 7. Trades
    const tradesRef = ref(db, `leagues/${leagueId}/trades`);
    const unsubTrades = onValue(tradesRef, (snap) => {
      const data = snap.val();
      if (!data) { setTrades([]); return; }
      const all = Object.entries(data).map(([id, val]) => ({
        ...(val as Record<string, unknown>),
        id,
      }));
      setTrades(all as never[]);
    });
    unsubs.push(unsubTrades);

    // 8. Chat
    const chatRef = ref(db, `leagues/${leagueId}/chat`);
    const unsubChat = onValue(chatRef, (snap) => {
      const data = snap.val();
      if (!data) { setMessages([]); return; }
      const msgs = Object.entries(data).map(([id, val]) => ({
        ...(val as Record<string, unknown>),
        id,
      }));
      (msgs as { timestamp?: number }[]).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setMessages(msgs as never[]);
      setUnreadCount(0);
    });
    unsubs.push(unsubChat);

    return () => unsubs.forEach((fn) => fn());
  }, [currentLeague, uid, nickname, setAuth, setPlayers, setAppearance, setRound, setSettings, setUser, setDraft, setTrades, setMessages, setUnreadCount]);

  // Loading
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

  // Not logged in
  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  // No league selected
  if (!currentLeague) {
    return <LeagueSelector />;
  }

  return <>{children}</>;
}
