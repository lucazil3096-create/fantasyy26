'use client';

import { useEffect, useState, useCallback } from 'react';
import { ref, onValue, set, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useStore, Player } from '@/store/useStore';
import { getCurrentPicker, getRemainingTime, DraftPick } from '@/lib/draft';

export default function DraftScreen() {
  const { user, draft, setDraft, players } = useStore();
  const [timer, setTimer] = useState(0);
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [picking, setPicking] = useState(false);

  // Listen to draft state from Firebase
  useEffect(() => {
    const draftRef = ref(db, 'draft');
    const unsub = onValue(draftRef, (snap) => {
      const data = snap.val();
      if (data) {
        setDraft({
          status: data.status || 'waiting',
          participants: data.participants || [],
          currentPick: data.currentPick || 0,
          totalRounds: data.totalRounds || 16,
          pickTimerSeconds: data.pickTimerSeconds || 90,
          pickStartedAt: data.pickStartedAt || 0,
          picks: data.picks ? Object.values(data.picks) : [],
          availablePlayers: data.availablePlayers || [],
        });
      }
    });
    return () => unsub();
  }, [setDraft]);

  // Countdown timer
  useEffect(() => {
    if (!draft || draft.status !== 'active') return;

    const interval = setInterval(() => {
      const remaining = getRemainingTime(draft.pickStartedAt, draft.pickTimerSeconds);
      setTimer(Math.ceil(remaining));

      // Auto-pick when time runs out (only the current picker's client does this)
      if (remaining <= 0 && currentPicker?.nickname === user?.nickname) {
        handleAutoPick();
      }
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.pickStartedAt, draft?.status]);

  const currentPicker = draft
    ? getCurrentPicker(draft.participants, draft.currentPick, draft.totalRounds)
    : null;

  const isMyTurn = currentPicker?.nickname === user?.nickname;

  const availablePlayers = players.filter((p) => {
    if (draft?.picks?.some((pick: DraftPick) => pick.playerId === p.id)) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.team.toLowerCase().includes(search.toLowerCase())) return false;
    if (posFilter && p.position !== posFilter) return false;
    return true;
  });

  const handlePick = useCallback(async (player: Player) => {
    if (!draft || !user || !isMyTurn || picking) return;
    setPicking(true);

    try {
      const pick: DraftPick = {
        pickNumber: draft.currentPick,
        round: currentPicker!.round,
        nickname: user.nickname,
        playerId: player.id,
        playerName: player.name,
        timestamp: Date.now(),
        wasAutoPick: false,
      };

      const pickRef = ref(db, `draft/picks/${draft.currentPick}`);
      await set(pickRef, pick);

      // Advance to next pick
      const totalPicks = draft.participants.length * draft.totalRounds;
      const nextPick = draft.currentPick + 1;

      if (nextPick >= totalPicks) {
        await set(ref(db, 'draft/status'), 'finished');
        await set(ref(db, 'draft/currentPick'), nextPick);
      } else {
        await set(ref(db, 'draft/currentPick'), nextPick);
        await set(ref(db, 'draft/pickStartedAt'), Date.now());
      }

      // Save player to user's team in Firebase
      const userTeamRef = ref(db, `users/${user.nickname}/team`);
      const teamSnap = await get(userTeamRef);
      const currentTeam = teamSnap.val() || [];
      await set(userTeamRef, [...currentTeam, player]);
    } catch (err) {
      console.error('Erro ao fazer pick:', err);
    } finally {
      setPicking(false);
    }
  }, [draft, user, isMyTurn, picking, currentPicker]);

  const handleAutoPick = useCallback(async () => {
    if (!draft || !user || picking) return;

    // Pick the first available player (sorted by points)
    const best = [...availablePlayers].sort((a, b) => b.points - a.points)[0];
    if (!best) return;

    setPicking(true);
    try {
      const pick: DraftPick = {
        pickNumber: draft.currentPick,
        round: currentPicker!.round,
        nickname: currentPicker!.nickname,
        playerId: best.id,
        playerName: best.name,
        timestamp: Date.now(),
        wasAutoPick: true,
      };

      await set(ref(db, `draft/picks/${draft.currentPick}`), pick);

      const totalPicks = draft.participants.length * draft.totalRounds;
      const nextPick = draft.currentPick + 1;

      if (nextPick >= totalPicks) {
        await set(ref(db, 'draft/status'), 'finished');
        await set(ref(db, 'draft/currentPick'), nextPick);
      } else {
        await set(ref(db, 'draft/currentPick'), nextPick);
        await set(ref(db, 'draft/pickStartedAt'), Date.now());
      }

      const userTeamRef = ref(db, `users/${currentPicker!.nickname}/team`);
      const teamSnap = await get(userTeamRef);
      const currentTeam = teamSnap.val() || [];
      await set(userTeamRef, [...currentTeam, best]);
    } catch (err) {
      console.error('Erro no auto-pick:', err);
    } finally {
      setPicking(false);
    }
  }, [draft, user, picking, availablePlayers, currentPicker]);

  // WAITING state
  if (!draft || draft.status === 'waiting') {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white">Draft</h2>
        <div className="bg-zinc-800 rounded-2xl p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">D</span>
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">Aguardando Draft</h3>
          <p className="text-zinc-400 text-sm">
            O administrador ira iniciar o draft em breve.
            Fique atento!
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-400 text-sm">Aguardando...</span>
          </div>
        </div>

        <div className="bg-zinc-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-3">Regras</h3>
          <ul className="space-y-2 text-zinc-400 text-sm">
            <li>1. Ordem definida por sorteio (snake draft)</li>
            <li>2. Cada pick tem tempo limite</li>
            <li>3. Se o tempo acabar, auto-pick do melhor disponivel</li>
            <li>4. Ordem: 1-2-3...3-2-1...1-2-3</li>
          </ul>
        </div>
      </div>
    );
  }

  // FINISHED state
  if (draft.status === 'finished') {
    const myPicks = draft.picks.filter((p: DraftPick) => p.nickname === user?.nickname);
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white">Draft Finalizado!</h2>
        <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-2xl p-5 text-center">
          <p className="text-emerald-300 font-semibold text-lg">Draft concluido!</p>
          <p className="text-zinc-400 text-sm mt-2">
            {draft.picks.length} picks feitos por {draft.participants.length} participantes
          </p>
        </div>

        <div className="bg-zinc-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-3">Seus picks ({myPicks.length})</h3>
          <div className="space-y-2">
            {myPicks.map((pick: DraftPick) => (
              <div key={pick.pickNumber} className="flex items-center gap-3 bg-zinc-700/50 rounded-xl p-2">
                <span className="text-zinc-500 text-xs w-8">#{pick.pickNumber + 1}</span>
                <span className="text-white text-sm flex-1">{pick.playerName}</span>
                {pick.wasAutoPick && (
                  <span className="text-amber-400 text-xs">auto</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE state
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Draft</h2>
        <span className="text-zinc-400 text-sm">
          Rodada {currentPicker?.round}/{draft.totalRounds}
        </span>
      </div>

      {/* Current Turn Banner */}
      <div className={`rounded-2xl p-4 text-center ${
        isMyTurn
          ? 'bg-emerald-900/40 border-2 border-emerald-500 animate-pulse'
          : 'bg-zinc-800'
      }`}>
        <p className="text-zinc-400 text-xs mb-1">
          Pick #{draft.currentPick + 1} - {isMyTurn ? 'SUA VEZ!' : 'Vez de:'}
        </p>
        <p className={`font-bold text-lg ${isMyTurn ? 'text-emerald-300' : 'text-white'}`}>
          {currentPicker?.nickname || '...'}
        </p>

        {/* Timer */}
        <div className={`mt-3 text-3xl font-mono font-bold ${
          timer <= 10 ? 'text-red-400' : timer <= 30 ? 'text-amber-400' : 'text-white'
        }`}>
          {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
        </div>
      </div>

      {/* Player Search & Filter (only when it's my turn) */}
      {isMyTurn && (
        <>
          <input
            type="text"
            placeholder="Buscar jogador ou time..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />

          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {['', 'G', 'D', 'M', 'A'].map((pos) => (
              <button
                key={pos}
                onClick={() => setPosFilter(pos)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  posFilter === pos
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {pos || 'Todos'}
              </button>
            ))}
          </div>

          {/* Available Players */}
          <div className="space-y-1.5 max-h-[40vh] overflow-y-auto hide-scrollbar">
            {availablePlayers.slice(0, 50).map((p) => (
              <button
                key={p.id}
                onClick={() => handlePick(p)}
                disabled={picking}
                className="w-full flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-300 shrink-0">
                  {p.position}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-white text-sm font-medium truncate">{p.name}</p>
                  <p className="text-zinc-500 text-xs truncate">{p.team}</p>
                </div>
                <span className="text-emerald-400 text-sm font-bold shrink-0">
                  {p.points} pts
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* When NOT my turn, show recent picks */}
      {!isMyTurn && (
        <div className="bg-zinc-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-3">Picks recentes</h3>
          <div className="space-y-2">
            {[...draft.picks].reverse().slice(0, 8).map((pick: DraftPick) => (
              <div key={pick.pickNumber} className="flex items-center gap-3 bg-zinc-700/30 rounded-xl p-2">
                <span className="text-zinc-500 text-xs w-8">#{pick.pickNumber + 1}</span>
                <span className={`text-sm flex-1 ${pick.nickname === user?.nickname ? 'text-emerald-300' : 'text-white'}`}>
                  {pick.nickname}
                </span>
                <span className="text-zinc-300 text-sm">{pick.playerName}</span>
                {pick.wasAutoPick && (
                  <span className="text-amber-400 text-[10px]">auto</span>
                )}
              </div>
            ))}
            {draft.picks.length === 0 && (
              <p className="text-zinc-500 text-sm">Nenhum pick ainda...</p>
            )}
          </div>
        </div>
      )}

      {/* Draft order */}
      <div className="bg-zinc-800 rounded-2xl p-4">
        <h3 className="text-white font-semibold mb-2 text-sm">Ordem</h3>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {draft.participants.map((nick, i) => (
            <div
              key={i}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${
                nick === currentPicker?.nickname
                  ? 'bg-emerald-500 text-white'
                  : nick === user?.nickname
                  ? 'bg-zinc-600 text-emerald-300'
                  : 'bg-zinc-700 text-zinc-400'
              }`}
            >
              {nick}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
