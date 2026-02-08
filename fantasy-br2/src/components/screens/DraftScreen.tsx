'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ref, set, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useStore, Player } from '@/store/useStore';
import { getCurrentPicker, getRemainingTime, DraftPick } from '@/lib/draft';

export default function DraftScreen() {
  const { user, draft, players, currentLeague, nickname, isAdmin } = useStore();

  const [timer, setTimer] = useState(0);
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [picking, setPicking] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const autoPickFiredRef = useRef(false);

  // ── Derived state ──

  const currentPicker = useMemo(() => {
    if (!draft || draft.status !== 'active') return null;
    return getCurrentPicker(draft.participants, draft.currentPick, draft.totalRounds);
  }, [draft]);

  const isMyTurn = !isAdmin && currentPicker?.nickname === nickname;

  const totalPicks = draft ? draft.participants.length * draft.totalRounds : 0;

  const pickedPlayerIds = useMemo(() => {
    if (!draft?.picks) return new Set<number>();
    return new Set(draft.picks.map((p: DraftPick) => p.playerId));
  }, [draft?.picks]);

  const availablePlayers = useMemo(() => {
    return players.filter((p) => {
      if (pickedPlayerIds.has(p.id)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.team.toLowerCase().includes(q)
        )
          return false;
      }
      if (posFilter && p.position !== posFilter) return false;
      return true;
    });
  }, [players, pickedPlayerIds, search, posFilter]);

  // ── League path helper ──

  const leaguePath = currentLeague ? `leagues/${currentLeague.id}` : null;

  // ── Timer countdown ──

  useEffect(() => {
    if (!draft || draft.status !== 'active') {
      setTimer(0);
      return;
    }

    const tick = () => {
      const remaining = getRemainingTime(draft.pickStartedAt, draft.pickTimerSeconds);
      setTimer(Math.ceil(remaining));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [draft?.pickStartedAt, draft?.pickTimerSeconds, draft?.status]);

  // ── Reset auto-pick guard when pick advances ──

  useEffect(() => {
    autoPickFiredRef.current = false;
  }, [draft?.currentPick]);

  // ── Auto-pick when timer runs out (only on current picker's client) ──

  useEffect(() => {
    if (!draft || draft.status !== 'active') return;
    if (!isMyTurn) return;
    if (picking) return;
    if (autoPickFiredRef.current) return;
    if (timer > 0) return;
    // Ensure there was actually a start time (avoid auto-pick on first render before data loads)
    if (!draft.pickStartedAt) return;

    autoPickFiredRef.current = true;
    handleAutoPick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, isMyTurn, draft?.status, picking]);

  // ── Pick handler ──

  const handlePick = useCallback(
    async (player: Player) => {
      if (!draft || !leaguePath || !nickname || !currentPicker || picking) return;
      if (isAdmin) return; // admin cannot pick
      if (currentPicker.nickname !== nickname) return;

      setPicking(true);
      setSelectedPlayer(null);

      try {
        const pick: DraftPick = {
          pickNumber: draft.currentPick,
          round: currentPicker.round,
          nickname,
          playerId: player.id,
          playerName: player.name,
          timestamp: Date.now(),
          wasAutoPick: false,
        };

        // Write the pick
        await set(ref(db, `${leaguePath}/draft/picks/${draft.currentPick}`), pick);

        // Advance draft
        const nextPick = draft.currentPick + 1;
        if (nextPick >= totalPicks) {
          await set(ref(db, `${leaguePath}/draft/status`), 'finished');
          await set(ref(db, `${leaguePath}/draft/currentPick`), nextPick);
        } else {
          await set(ref(db, `${leaguePath}/draft/currentPick`), nextPick);
          await set(ref(db, `${leaguePath}/draft/pickStartedAt`), Date.now());
        }

        // Add player to the picker's team
        const teamRef = ref(db, `${leaguePath}/members/${nickname}/team`);
        const teamSnap = await get(teamRef);
        const currentTeam: Player[] = teamSnap.val() || [];
        await set(teamRef, [...currentTeam, player]);
      } catch (err) {
        console.error('Erro ao fazer pick:', err);
      } finally {
        setPicking(false);
      }
    },
    [draft, leaguePath, nickname, currentPicker, picking, isAdmin, totalPicks]
  );

  // ── Auto-pick handler ──

  const handleAutoPick = useCallback(async () => {
    if (!draft || !leaguePath || !nickname || !currentPicker || picking) return;
    if (isAdmin) return;

    // Pick the highest-points available player
    const sorted = [...players]
      .filter((p) => !pickedPlayerIds.has(p.id))
      .sort((a, b) => b.points - a.points);
    const best = sorted[0];
    if (!best) return;

    setPicking(true);

    try {
      const pick: DraftPick = {
        pickNumber: draft.currentPick,
        round: currentPicker.round,
        nickname: currentPicker.nickname,
        playerId: best.id,
        playerName: best.name,
        timestamp: Date.now(),
        wasAutoPick: true,
      };

      await set(ref(db, `${leaguePath}/draft/picks/${draft.currentPick}`), pick);

      const nextPick = draft.currentPick + 1;
      if (nextPick >= totalPicks) {
        await set(ref(db, `${leaguePath}/draft/status`), 'finished');
        await set(ref(db, `${leaguePath}/draft/currentPick`), nextPick);
      } else {
        await set(ref(db, `${leaguePath}/draft/currentPick`), nextPick);
        await set(ref(db, `${leaguePath}/draft/pickStartedAt`), Date.now());
      }

      // Add player to picker's team
      const pickerNick = currentPicker.nickname;
      const teamRef = ref(db, `${leaguePath}/members/${pickerNick}/team`);
      const teamSnap = await get(teamRef);
      const currentTeam: Player[] = teamSnap.val() || [];
      await set(teamRef, [...currentTeam, best]);
    } catch (err) {
      console.error('Erro no auto-pick:', err);
    } finally {
      setPicking(false);
    }
  }, [draft, leaguePath, nickname, currentPicker, picking, isAdmin, totalPicks, players, pickedPlayerIds]);

  // ── Confirm pick (from selection) ──

  const confirmPick = useCallback(() => {
    if (selectedPlayer) handlePick(selectedPlayer);
  }, [selectedPlayer, handlePick]);

  // ── Helper: timer color ──

  const timerColor =
    timer <= 10 ? 'text-red-400' : timer <= 30 ? 'text-amber-400' : 'text-white';

  // ── Helper: format timer ──

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // =====================
  // WAITING STATE
  // =====================

  if (!draft || draft.status === 'waiting') {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white">Draft</h2>

        <div className="bg-zinc-800 rounded-2xl p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-zinc-300 font-bold">D</span>
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">Aguardando Draft</h3>
          <p className="text-zinc-400 text-sm">
            O administrador ira iniciar o draft em breve. Fique atento!
          </p>
          {isAdmin && (
            <p className="text-amber-400 text-xs mt-3">
              Voce e administrador. Configure e inicie o draft pelo painel admin.
            </p>
          )}
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-400 text-sm">Aguardando...</span>
          </div>
        </div>

        {/* Participants */}
        {draft?.participants && draft.participants.length > 0 && (
          <div className="bg-zinc-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-3">
              Participantes ({draft.participants.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {draft.participants.map((nick, i) => (
                <div
                  key={i}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    nick === nickname
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-zinc-700 text-zinc-400'
                  }`}
                >
                  {nick}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rules */}
        <div className="bg-zinc-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-3">Regras do Draft</h3>
          <ul className="space-y-2 text-zinc-400 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold shrink-0">1.</span>
              Ordem definida por sorteio (snake draft)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold shrink-0">2.</span>
              Cada pick tem tempo limite de{' '}
              {draft?.pickTimerSeconds || 90} segundos
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold shrink-0">3.</span>
              Se o tempo acabar, auto-pick do melhor jogador disponivel
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold shrink-0">4.</span>
              Ordem snake: 1-2-3...N, N...3-2-1, 1-2-3...N
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // =====================
  // FINISHED STATE
  // =====================

  if (draft.status === 'finished') {
    const myPicks = isAdmin
      ? []
      : (draft.picks || []).filter((p: DraftPick) => p.nickname === nickname);

    const picksByParticipant = draft.participants.map((nick) => ({
      nickname: nick,
      picks: (draft.picks || []).filter((p: DraftPick) => p.nickname === nick),
    }));

    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white">Draft Finalizado!</h2>

        <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-2xl p-5 text-center">
          <p className="text-emerald-300 font-semibold text-lg">Draft concluido!</p>
          <p className="text-zinc-400 text-sm mt-2">
            {(draft.picks || []).length} picks feitos por {draft.participants.length}{' '}
            participantes em {draft.totalRounds} rodadas
          </p>
        </div>

        {/* My picks (only for non-admin) */}
        {!isAdmin && myPicks.length > 0 && (
          <div className="bg-zinc-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-3">
              Seus picks ({myPicks.length})
            </h3>
            <div className="space-y-2">
              {myPicks.map((pick: DraftPick) => {
                const player = players.find((p) => p.id === pick.playerId);
                return (
                  <div
                    key={pick.pickNumber}
                    className="flex items-center gap-3 bg-zinc-700/50 rounded-xl p-2.5"
                  >
                    <span className="text-zinc-500 text-xs w-8 shrink-0">
                      #{pick.pickNumber + 1}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-zinc-600 flex items-center justify-center text-[10px] text-zinc-300 shrink-0">
                      {player?.position || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {pick.playerName}
                      </p>
                      <p className="text-zinc-500 text-xs truncate">
                        {player?.team || ''} - R{pick.round}
                      </p>
                    </div>
                    {pick.wasAutoPick && (
                      <span className="text-amber-400 text-[10px] bg-amber-400/10 px-1.5 py-0.5 rounded">
                        auto
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* All participants summary */}
        <div className="bg-zinc-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-3">Resumo por Participante</h3>
          <div className="space-y-3">
            {picksByParticipant.map(({ nickname: nick, picks }) => (
              <div key={nick} className="bg-zinc-700/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-sm font-medium ${
                      nick === nickname ? 'text-emerald-300' : 'text-white'
                    }`}
                  >
                    {nick}
                  </span>
                  <span className="text-zinc-500 text-xs">{picks.length} picks</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {picks.map((pick: DraftPick) => (
                    <span
                      key={pick.pickNumber}
                      className="text-[10px] bg-zinc-600/50 text-zinc-300 px-1.5 py-0.5 rounded truncate max-w-[120px]"
                    >
                      {pick.playerName.split(' ').pop()}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // =====================
  // ACTIVE STATE
  // =====================

  const picks = draft.picks || [];
  const recentPicks = [...picks].reverse().slice(0, 10);
  const myPicksSoFar = isAdmin
    ? []
    : picks.filter((p: DraftPick) => p.nickname === nickname);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Draft</h2>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-lg border border-amber-500/30">
              Modo Admin
            </span>
          )}
          <span className="text-zinc-400 text-sm">
            Rodada {currentPicker?.round || 1}/{draft.totalRounds}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-zinc-800 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${(draft.currentPick / totalPicks) * 100}%` }}
        />
      </div>
      <p className="text-zinc-500 text-[10px] text-right -mt-2">
        Pick {draft.currentPick + 1} de {totalPicks}
      </p>

      {/* Current Turn Banner */}
      <div
        className={`rounded-2xl p-4 text-center transition-colors ${
          isMyTurn
            ? 'bg-emerald-900/40 border-2 border-emerald-500'
            : 'bg-zinc-800 border border-zinc-700'
        }`}
      >
        <p className="text-zinc-400 text-xs mb-1">
          Pick #{draft.currentPick + 1} -{' '}
          {isMyTurn ? 'SUA VEZ!' : isAdmin ? 'Vez de:' : 'Vez de:'}
        </p>
        <p
          className={`font-bold text-lg ${
            isMyTurn ? 'text-emerald-300' : 'text-white'
          }`}
        >
          {currentPicker?.nickname || '...'}
        </p>

        {/* Timer */}
        <div className={`mt-3 text-3xl font-mono font-bold ${timerColor}`}>
          {formatTimer(timer)}
        </div>

        {timer <= 10 && timer > 0 && isMyTurn && (
          <p className="text-red-400 text-xs mt-1 animate-pulse">
            Tempo acabando! Escolha rapido!
          </p>
        )}
      </div>

      {/* Admin view - just observe */}
      {isAdmin && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-2xl p-4 text-center">
          <p className="text-amber-400 text-sm">
            Voce esta como administrador. Acompanhe o draft, mas nao participa das escolhas.
          </p>
        </div>
      )}

      {/* Player Search & Filter (only when it's my turn and not admin) */}
      {isMyTurn && !isAdmin && (
        <>
          <input
            type="text"
            placeholder="Buscar jogador ou time..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
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

          {/* Selected player confirmation */}
          {selectedPlayer && (
            <div className="bg-emerald-900/30 border border-emerald-600/50 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-700/50 flex items-center justify-center text-xs text-emerald-200 font-bold shrink-0">
                {selectedPlayer.position}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{selectedPlayer.name}</p>
                <p className="text-emerald-400/70 text-xs">{selectedPlayer.team}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmPick}
                  disabled={picking}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {picking ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}

          {/* Available Players */}
          <div className="space-y-1.5 max-h-[40vh] overflow-y-auto hide-scrollbar">
            {availablePlayers.length === 0 && (
              <p className="text-zinc-500 text-sm text-center py-4">
                Nenhum jogador encontrado
              </p>
            )}
            {availablePlayers.slice(0, 50).map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlayer(p)}
                disabled={picking}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors disabled:opacity-50 ${
                  selectedPlayer?.id === p.id
                    ? 'bg-emerald-800/40 border border-emerald-500/50'
                    : 'bg-zinc-800 hover:bg-zinc-700'
                }`}
              >
                {p.photo ? (
                  <img
                    src={p.photo}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-300 shrink-0">
                    {p.position}
                  </div>
                )}
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

      {/* When NOT my turn (or admin), show recent picks */}
      {(!isMyTurn || isAdmin) && (
        <div className="bg-zinc-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-3">Picks recentes</h3>
          <div className="space-y-2">
            {recentPicks.map((pick: DraftPick) => {
              const player = players.find((p) => p.id === pick.playerId);
              return (
                <div
                  key={pick.pickNumber}
                  className="flex items-center gap-3 bg-zinc-700/30 rounded-xl p-2.5"
                >
                  <span className="text-zinc-500 text-xs w-8 shrink-0">
                    #{pick.pickNumber + 1}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-zinc-600 flex items-center justify-center text-[10px] text-zinc-300 shrink-0">
                    {player?.position || '?'}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      pick.nickname === nickname
                        ? 'text-emerald-300'
                        : 'text-white'
                    }`}
                  >
                    {pick.nickname}
                  </span>
                  <span className="text-zinc-300 text-sm flex-1 text-right truncate">
                    {pick.playerName}
                  </span>
                  {pick.wasAutoPick && (
                    <span className="text-amber-400 text-[10px] bg-amber-400/10 px-1.5 py-0.5 rounded shrink-0">
                      auto
                    </span>
                  )}
                </div>
              );
            })}
            {picks.length === 0 && (
              <p className="text-zinc-500 text-sm text-center">
                Nenhum pick ainda...
              </p>
            )}
          </div>
        </div>
      )}

      {/* My picks so far (only for participants) */}
      {!isAdmin && myPicksSoFar.length > 0 && (
        <div className="bg-zinc-800 rounded-2xl p-4">
          <h3 className="text-white font-semibold mb-2 text-sm">
            Seus picks ({myPicksSoFar.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {myPicksSoFar.map((pick: DraftPick) => {
              const player = players.find((p) => p.id === pick.playerId);
              return (
                <div
                  key={pick.pickNumber}
                  className="flex items-center gap-1.5 bg-emerald-900/20 border border-emerald-700/30 px-2 py-1 rounded-lg"
                >
                  <span className="text-emerald-400 text-[10px]">
                    {player?.position || '?'}
                  </span>
                  <span className="text-white text-xs truncate max-w-[100px]">
                    {pick.playerName.split(' ').pop()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Snake draft order */}
      <div className="bg-zinc-800 rounded-2xl p-4">
        <h3 className="text-white font-semibold mb-2 text-sm">Ordem do Draft</h3>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {draft.participants.map((nick, i) => (
            <div
              key={i}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
                nick === currentPicker?.nickname
                  ? 'bg-emerald-500 text-white font-bold ring-2 ring-emerald-400/50'
                  : nick === nickname
                  ? 'bg-zinc-600 text-emerald-300 border border-emerald-500/30'
                  : 'bg-zinc-700 text-zinc-400'
              }`}
            >
              {nick}
            </div>
          ))}
        </div>
        <p className="text-zinc-600 text-[10px] mt-2">
          {currentPicker && currentPicker.round % 2 === 0
            ? 'Rodada par - ordem reversa'
            : 'Rodada impar - ordem normal'}
        </p>
      </div>
    </div>
  );
}
